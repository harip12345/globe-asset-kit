import * as THREE from 'three';
const D=Math.PI/180,MAX_LAT=85.05112878;
export const tileX=(lon,z)=>(lon+180)/360*2**z;
export const tileY=(lat,z)=>(1-Math.asinh(Math.tan(Math.max(-MAX_LAT,Math.min(MAX_LAT,lat))*D))/Math.PI)/2*2**z;
export const tileLat=(y,z)=>Math.atan(Math.sinh(Math.PI*(1-2*y/2**z)))/D;
const sphere=(lat,lon,r)=>[Math.cos(lat*D)*Math.cos(lon*D)*r,Math.sin(lat*D)*r,-Math.cos(lat*D)*Math.sin(lon*D)*r];
const keyOf=t=>`${t.z}/${t.y}/${t.x}`;
const wrap=lon=>((lon+180)%360+360)%360-180;

function footprint(cam,w,h,camera){
  const alt=cam.altitudeKm,cos=Math.max(.08,Math.cos(cam.lat*D));
  let halfLat=alt*Math.tan(21*D)*1.45/111.32,halfLon=Math.min(179,halfLat*w/h/cos),center=cam.lon,lat=cam.lat;
  if(camera){
    // Intersect a screen grid with the sphere. This covers pitched and follow cameras,
    // instead of treating every shot as a vertical camera over the target latitude.
    const points=[],ray=new THREE.Raycaster(),surface=new THREE.Sphere(new THREE.Vector3(),1);
    for(let j=0;j<=6;j++)for(let i=0;i<=6;i++){
      ray.setFromCamera(new THREE.Vector2(i/3-1,j/3-1),camera);
      const hit=ray.ray.intersectSphere(surface,new THREE.Vector3());if(!hit)continue;
      const hitLat=Math.asin(THREE.MathUtils.clamp(hit.y,-1,1))/D,hitLon=Math.atan2(-hit.z,hit.x)/D;
      points.push([hitLat,cam.lon+wrap(hitLon-cam.lon)]);
    }
    if(!points.length)return null;
    const north=Math.max(...points.map(p=>p[0])),south=Math.min(...points.map(p=>p[0]));
    const east=Math.max(...points.map(p=>p[1])),west=Math.min(...points.map(p=>p[1]));
    lat=(north+south)/2;center=(east+west)/2;halfLat=Math.max(.00001,(north-south)*.58);halfLon=Math.max(.00001,Math.min(179,(east-west)*.58));
  }
  return {north:Math.min(MAX_LAT,lat+halfLat),south:Math.max(-MAX_LAT,lat-halfLat),west:center-halfLon,east:center+halfLon,lat,lon:center};
}
export function selectTiles(cam,w,h,maxLevel=18,camera=null){
  if((cam.altitudeKm??Infinity)>1800)return [];
  const box=footprint(cam,w,h,camera);if(!box||box.north<box.south)return [];
  // Esri's service tiles are 256 pixels; one level too low visibly blurs close-ups.
  const spanX=(box.east-box.west)*111.32*Math.max(.08,Math.cos(box.lat*D));
  const spanY=(box.north-box.south)*111.32;
  let z=Math.min(maxLevel,Math.max(0,Math.ceil(Math.log2(40075*Math.max(.08,Math.cos(box.lat*D))*Math.max(w,h)/(Math.max(spanX,spanY,.001)*256)))));
  let result;
  do{
    const n=2**z,x0=Math.floor(tileX(box.west,z)),x1=Math.floor(tileX(box.east,z));
    const y0=Math.max(0,Math.floor(tileY(box.north,z))),y1=Math.min(n-1,Math.floor(tileY(box.south,z)));
    const unique=new Map();
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const tile={z,x:((x%n)+n)%n,y,priority:Math.hypot(x+.5-tileX(box.lon,z),y+.5-tileY(box.lat,z))};unique.set(keyOf(tile),tile);
    }
    result=[...unique.values()];if(result.length<=64||z===0)break;z--;
  }while(z>=0);
  return result.sort((a,b)=>a.priority-b.priority);
}
function geometry({z,x,y}){
  const n=2**z,segments=Math.max(8,Math.ceil(256/n)),p=[],uv=[],ll=[],indices=[];
  for(let j=0;j<=segments;j++)for(let i=0;i<=segments;i++){
    const lon=(x+i/segments)/n*360-180,lat=tileLat(y+j/segments,z);
    p.push(...sphere(lat,lon,1.000001));uv.push(i/segments,1-j/segments);ll.push((lon+180)/360,(lat+90)/180);
  }
  for(let j=0;j<segments;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;indices.push(a,b,a+1,b,b+1,a+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('geoUv',new THREE.Float32BufferAttribute(ll,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function loadImage(url,signal){
  return new Promise((resolve,reject)=>{
    const image=new Image();image.crossOrigin='anonymous';
    const clean=()=>{clearTimeout(timer);image.onload=null;image.onerror=null;signal.removeEventListener('abort',abort);};
    const fail=error=>{clean();image.src='';reject(error);};
    const abort=()=>fail(new DOMException('Tile tidak lagi diperlukan.','AbortError'));
    const timer=setTimeout(()=>fail(new Error('Citra satelit tidak merespons (15 detik).')),15000);
    image.onload=()=>{clean();resolve(image);};image.onerror=()=>fail(new Error('Citra satelit gagal dimuat. Periksa koneksi internet.'));
    if(signal.aborted){abort();return;}signal.addEventListener('abort',abort,{once:true});image.src=url;
  });
}
export class DetailLayer{
  constructor(scene,baseMaterial,onChange){
    this.group=new THREE.Group();scene.add(this.group);this.baseMaterial=baseMaterial;this.onChange=onChange;this.cache=new Map();this.activeKey='';this.ready=Promise.resolve();this.status='';this.queue=[];this.running=0;this.wanted=new Set();this.high=[];this.generation=0;this.revision=0;this.error=null;
  }
  load(tile){
    const key=keyOf(tile),cached=this.cache.get(key);if(cached&&!cached.controller.signal.aborted)return cached;
    const entry={key,tile,mesh:null,state:'queued',used:++this.revision,controller:new AbortController()};
    entry.promise=new Promise(resolve=>entry.resolve=resolve);
    this.cache.set(key,entry);this.queue.push(entry);return entry;
  }
  async run(entry){
    entry.state='loading';
    try{
      let image,lastError;
      for(const host of ['services.arcgisonline.com','server.arcgisonline.com']){
        try{image=await loadImage(`https://${host}/ArcGIS/rest/services/World_Imagery/MapServer/tile/${entry.key}`,entry.controller.signal);lastError=null;break;}catch(e){if(e.name==='AbortError')throw e;lastError=e;}
      }
      if(lastError)throw lastError;
      if(!this.wanted.has(entry.key))throw new DOMException('Obsolete tile','AbortError');
      const texture=new THREE.Texture(image);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;texture.needsUpdate=true;
      const uniforms={...this.baseMaterial.uniforms,uMap:{value:texture},uSatelliteTile:{value:1}};
      const mat=new THREE.ShaderMaterial({vertexShader:this.baseMaterial.vertexShader,fragmentShader:this.baseMaterial.fragmentShader,defines:{USE_GEO_UV:1},uniforms,polygonOffset:true,polygonOffsetFactor:-(entry.tile.z+1),polygonOffsetUnits:-(entry.tile.z+1)});
      entry.mesh=new THREE.Mesh(geometry(entry.tile),mat);entry.mesh.renderOrder=entry.tile.z+1;entry.mesh.visible=false;this.group.add(entry.mesh);entry.state='ready';
    }catch(e){entry.state=e.name==='AbortError'?'cancelled':'error';entry.error=e;}
    finally{
      entry.resolve();if(entry.state==='cancelled'&&this.cache.get(entry.key)===entry)this.cache.delete(entry.key);
      if(this.wanted.has(entry.key)){this.refresh();this.onChange();}
    }
  }
  pump(){while(this.running<6&&this.queue.length){const entry=this.queue.shift();if(!this.wanted.has(entry.key)||this.cache.get(entry.key)!==entry||entry.controller.signal.aborted){entry.state='cancelled';entry.resolve();if(this.cache.get(entry.key)===entry)this.cache.delete(entry.key);continue;}this.running++;this.run(entry).finally(()=>{this.running--;this.pump();});}}
  update(enabled,cam,w,h,maxLevel=18,camera=null){
    const tiles=enabled?selectTiles(cam,w,h,maxLevel,camera):[],key=tiles.map(keyOf).sort().join(',');
    if(key===this.activeKey){if(!tiles.length)this.status=enabled?'Globe · zoom mendekat untuk citra detail':'';return;}
    this.activeKey=key;this.generation++;this.high=tiles.map(keyOf);this.error=null;
    const parents=new Map();for(const tile of tiles){const dz=Math.min(2,tile.z),p={z:tile.z-dz,x:Math.floor(tile.x/2**dz),y:Math.floor(tile.y/2**dz)};if(dz)parents.set(keyOf(p),p);}
    const required=[...parents.values(),...tiles];this.wanted=new Set(required.map(keyOf));
    // Cancel old network work so a new location is not stuck behind the previous view.
    for(const entry of this.cache.values())if(!this.wanted.has(entry.key)&&['queued','loading'].includes(entry.state))entry.controller.abort();
    const entries=required.map(t=>this.load(t));entries.forEach(e=>e.used=++this.revision);
    const generation=this.generation;
    this.refresh();this.pump();
    this.ready=Promise.all(entries.map(e=>e.promise)).then(()=>{
      if(generation!==this.generation)return;
      this.refresh();this.prune();this.onChange();
      if(this.error)throw this.error;
    });this.ready.catch(()=>{});
  }
  refresh(){
    const high=this.high.map(key=>this.cache.get(key)),complete=high.length&&high.every(e=>e?.state==='ready');
    const failed=high.filter(e=>e?.state==='error').length,loaded=high.filter(e=>e?.state==='ready').length;
    for(const entry of this.cache.values())if(entry.mesh){
      // Preserve the last completed view until replacement tiles arrive; parents fill gaps.
      if(!this.wanted.size||complete)entry.mesh.visible=this.wanted.has(entry.key)&&entry.state==='ready';
      else if(this.wanted.has(entry.key)&&entry.state==='ready')entry.mesh.visible=true;
    }
    this.error=failed?new Error(`${failed} tile detail gagal. Coba muat ulang citra atau pilih fallback saat ekspor.`):null;
    if(!high.length)this.status='';
    else if(failed)this.status=`${loaded}/${high.length} tile detail · ${failed} gagal · memakai citra yang tersedia`;
    else this.status=complete?`Citra satelit · level ${high[0].tile.z} · ${high.length} tile`:`Memuat citra detail · ${loaded}/${high.length} tile`;
  }
  async waitForReady(failureMode='strict'){
    // A scene switch may supersede an outstanding request; do not export that old view.
    for(;;){const generation=this.generation;try{await this.ready;}catch(e){if(generation!==this.generation)continue;if(failureMode==='strict')throw e;}if(generation===this.generation)return;}
  }
  prune(){
    const inactive=[...this.cache.values()].filter(e=>!this.wanted.has(e.key)&&!['queued','loading'].includes(e.state)).sort((a,b)=>a.used-b.used);
    while(this.cache.size>192&&inactive.length){const e=inactive.shift();if(e.mesh){e.mesh.geometry.dispose();e.mesh.material.uniforms.uMap.value.dispose();e.mesh.material.dispose();this.group.remove(e.mesh);}this.cache.delete(e.key);}
  }
  get visible(){return this.group.children.some(m=>m.visible);}
  retry(){for(const [key,e] of this.cache)if(['error','cancelled'].includes(e.state))this.cache.delete(key);this.activeKey=null;this.onChange();}
}
