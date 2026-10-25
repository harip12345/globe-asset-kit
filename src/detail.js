import * as THREE from 'three';
const D=Math.PI/180,MAX_LAT=85.05112878;
export const tileX=(lon,z)=>(lon+180)/360*2**z;
export const tileY=(lat,z)=>(1-Math.asinh(Math.tan(Math.max(-MAX_LAT,Math.min(MAX_LAT,lat))*D))/Math.PI)/2*2**z;
export const tileLat=(y,z)=>Math.atan(Math.sinh(Math.PI*(1-2*y/2**z)))/D;
const sphere=(lat,lon,r)=>[Math.cos(lat*D)*Math.cos(lon*D)*r,Math.sin(lat*D)*r,-Math.cos(lat*D)*Math.sin(lon*D)*r];
export function selectTiles(cam,w,h,maxLevel=18){
  const alt=cam.altitudeKm??Infinity;if(alt>1800)return [];
  const lat=Math.max(-84.8,Math.min(84.8,cam.lat)),lon=((cam.lon+540)%360)-180;
  const spanY=alt*Math.tan(21*D)*2*1.45,spanX=spanY*w/h;
  const north=Math.min(MAX_LAT,lat+spanY/111.32/2),south=Math.max(-MAX_LAT,lat-spanY/111.32/2);
  const cos=Math.max(.08,Math.cos(lat*D)),halfLon=Math.min(179,spanX/111.32/cos/2);
  let z=Math.min(maxLevel,Math.max(1,Math.ceil(Math.log2(40075*cos*Math.max(w,h)/(Math.max(spanX,spanY)*512)))));
  let result;
  do{
    const n=2**z,x0=Math.floor(tileX(lon-halfLon,z)),x1=Math.floor(tileX(lon+halfLon,z));
    const y0=Math.max(0,Math.floor(tileY(north,z))),y1=Math.min(n-1,Math.floor(tileY(south,z)));
    result=[];
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)result.push({z,x:((x%n)+n)%n,y});
    if(result.length<=64)break;z--;
  }while(z>=0);
  return result;
}
function geometry({z,x,y}){
  const n=2**z,segments=z<5?32:8,p=[],uv=[],ll=[],indices=[];
  for(let j=0;j<=segments;j++)for(let i=0;i<=segments;i++){
    const lon=(x+i/segments)/n*360-180,lat=tileLat(y+j/segments,z);
    p.push(...sphere(lat,lon,1.000001));uv.push(i/segments,1-j/segments);ll.push((lon+180)/360,(lat+90)/180);
  }
  for(let j=0;j<segments;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;indices.push(a,b,a+1,b,b+1,a+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('geoUv',new THREE.Float32BufferAttribute(ll,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
export class DetailLayer{
  constructor(scene,baseMaterial,onChange){this.group=new THREE.Group();scene.add(this.group);this.baseMaterial=baseMaterial;this.onChange=onChange;this.cache=new Map();this.activeKey='';this.ready=Promise.resolve();this.status='';this.errors=[];this.queue=[];this.running=0;}
  load(tile){
    const key=`${tile.z}/${tile.y}/${tile.x}`;
    if(this.cache.has(key))return this.cache.get(key);
    const entry={key,mesh:null,state:'loading',used:Date.now()};
    entry.promise=new Promise((resolve,reject)=>{this.queue.push(async()=>{
      try{
        let image,lastError;
        for(const host of ['services.arcgisonline.com','server.arcgisonline.com']){
          image=new Image();image.crossOrigin='anonymous';
          try{await new Promise((ok,bad)=>{const timer=setTimeout(()=>{image.onload=null;image.onerror=null;image.src='';bad(new Error('Citra satelit tidak merespons.'));},20000);image.onload=()=>{clearTimeout(timer);ok();};image.onerror=()=>{clearTimeout(timer);bad(new Error('Citra satelit gagal dimuat. Periksa koneksi internet.'));};image.src=`https://${host}/ArcGIS/rest/services/World_Imagery/MapServer/tile/${key}`;});lastError=null;break;}catch(e){lastError=e;}
        }
        if(lastError)throw lastError;
        const texture=new THREE.Texture(image);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;texture.needsUpdate=true;
        const uniforms={...this.baseMaterial.uniforms,uMap:{value:texture},uSatelliteTile:{value:1}};
        const mat=new THREE.ShaderMaterial({vertexShader:this.baseMaterial.vertexShader,fragmentShader:this.baseMaterial.fragmentShader,defines:{USE_GEO_UV:1},uniforms,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
        entry.mesh=new THREE.Mesh(geometry(tile),mat);entry.mesh.renderOrder=1;entry.mesh.visible=false;this.group.add(entry.mesh);entry.state='ready';resolve();
      }catch(e){entry.state='error';entry.error=e;reject(e);}
    });this.pump();});
    entry.promise.catch(()=>{});this.cache.set(key,entry);return entry;
  }
  pump(){while(this.running<6&&this.queue.length){const job=this.queue.shift();this.running++;job().finally(()=>{this.running--;this.pump();});}}
  update(enabled,cam,w,h,maxLevel=18){
    const tiles=enabled?selectTiles(cam,w,h,maxLevel):[];
    const key=tiles.map(t=>`${t.z}/${t.y}/${t.x}`).join(',');
    if(key===this.activeKey)return;
    this.activeKey=key;for(const e of this.cache.values())if(e.mesh)e.mesh.visible=false;
    if(!tiles.length){this.status=enabled?'Globe · zoom mendekat untuk citra detail':'';this.ready=Promise.resolve();return;}
    const entries=tiles.map(t=>this.load(t));entries.forEach(e=>{e.used=Date.now();if(e.mesh)e.mesh.visible=true;});
    this.status=`Memuat citra detail · level ${tiles[0].z}`;
    this.ready=Promise.all(entries.map(e=>e.promise)).then(()=>{
      if(this.activeKey!==key)return;
      for(const e of entries)if(e.mesh)e.mesh.visible=true;
      this.status=`Citra satelit · level ${tiles[0].z} · ${entries.length} tile`;
      this.prune();this.onChange();
    }).catch(e=>{if(this.activeKey===key){this.status=e.message;this.onChange();}throw e;});this.ready.catch(()=>{});
  }
  prune(){
    const inactive=[...this.cache.values()].filter(e=>e.state==='ready'&&!e.mesh.visible).sort((a,b)=>a.used-b.used);
    while(this.cache.size>192&&inactive.length){const e=inactive.shift();e.mesh.geometry.dispose();e.mesh.material.uniforms.uMap.value.dispose();e.mesh.material.dispose();this.group.remove(e.mesh);this.cache.delete(e.key);}
  }
  get visible(){return this.group.children.some(m=>m.visible);}
  retry(){for(const [key,e] of this.cache)if(e.state==='error')this.cache.delete(key);this.activeKey='';this.onChange();}
}
