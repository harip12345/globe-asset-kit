export const HANDOFF_SCENES=['gw-s1','gw-B','gw-s2b','gw-D2b','gw-E2b','gw-s3b','gw-s4','gw-I2','gw-J2'];
export const PRESETS = ['pasifik','indonesia','rute','orbit','bali-lombok','laut-surut','penampang','fly-in','follow-ship','follow-satellite','follow-bird',...HANDOFF_SCENES];
const finite = (x,name,min,max) => {if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max)throw new Error(`${name}: gunakan angka ${min}–${max}.`);};
const color = (x,name) => {if(!/^#[0-9a-f]{6}$/i.test(x))throw new Error(`${name}: gunakan warna #RRGGBB.`);};
export function localAsset(x) {
  if(typeof x!=='string')throw new Error('Path aset harus berupa teks.');
  const u=new URL(x,location.href);
  if(u.origin!==location.origin || !u.pathname.startsWith('/assets/') || /(^|\/)\.\.(\/|$)/.test(x))throw new Error('Aset harus berada di folder assets/ proyek ini.');
  return u.href;
}
export function validateConfig(raw) {
  const c=structuredClone(raw);
  if(c.version!==1)throw new Error('Versi scene harus 1.');
  if(typeof c.name!=='string'||c.name.length>150)throw new Error('Nama scene maksimal 150 karakter.');
  finite(c.duration,'Durasi',1,120);finite(c.fps,'FPS',1,60);
  for(const k of ['width','height']) {finite(c[k],k,64,4096);if(!Number.isInteger(c[k]))throw new Error(`${k} harus bilangan bulat.`);}
  color(c.background,'Latar');
  if(typeof c.transparent!=='boolean')throw new Error('transparent harus true/false.');
  localAsset(c.texture);
  const s=c.style;
  if(!s)throw new Error('Pengaturan style belum ada.');
  finite(s.exposure,'Exposure',0.1,3);finite(s.saturation,'Saturasi',0,2);finite(s.oceanMix,'Campuran laut',0,1);
  finite(s.fill,'Cahaya isi',0,1);finite(s.halo,'Halo',0,2);color(s.ocean,'Laut');color(s.atmosphere,'Atmosfer');
  const checkCam = (k) => {finite(k.lat,'Latitude kamera',-85,85);finite(k.lon,'Longitude kamera',-720,720);finite(k.zoom,'Zoom',0.3,3);if(k.altitudeKm!==undefined)finite(k.altitudeKm,'Ketinggian kamera (km)',0.5,60000);if(k.pitch!==undefined)finite(k.pitch,'Sudut kamera',0,60);};
  if(!c.camera)throw new Error('Kamera belum ada.');
  checkCam(c.camera);finite(c.camera.roll,'Roll',-180,180);
  if(!Array.isArray(c.camera.keyframes)||c.camera.keyframes.length>100)throw new Error('Keyframe kamera tidak valid.');
  let prev=-1;
  for(const k of c.camera.keyframes){checkCam(k);finite(k.time,'Waktu keyframe',0,c.duration);if(k.time<=prev)throw new Error('Waktu keyframe harus meningkat.');prev=k.time;}
  const point = (p) => {if(!Array.isArray(p)||p.length!==2)throw new Error('Koordinat memakai [latitude, longitude].');finite(p[0],'Latitude',-90,90);finite(p[1],'Longitude',-180,180);};
  for(const key of ['labels','routes','objects']) if(!Array.isArray(c[key])||c[key].length>100)throw new Error(`${key} harus berupa array, maksimal 100.`);
  // Migrate the supplied bird handoff once, then save the same general schema as GLB travellers.
  for(const o of c.objects)if(o.type==='bird'&&!o.frames){
    point(o.from);point(o.to);finite(o.aspect??1.7,'Aspek sprite',0.2,6);finite(o.flap??0,'Kepakan',0,30);
    let index=c.routes.findIndex(r=>JSON.stringify(r.from)===JSON.stringify(o.from)&&JSON.stringify(r.to)===JSON.stringify(o.to));
    if(index<0){if(c.routes.length>=100)throw new Error('Maksimal 100 rute.');index=c.routes.length;c.routes.push({from:o.from,to:o.to,color:'#ff755a',start:o.start??0,end:o.end??c.duration,altitude:o.altitude??0.025,visible:false});}
    o.frames=[o.assetUp,o.assetDown];o.frameRate=o.flap??0;o.aspect??=1.7;
    o.followRoute??={route:index,start:o.start??0,end:o.end??c.duration,from:o.f0??0,to:o.f1??1,altitudeOffset:(o.altitude??0.025)-c.routes[index].altitude,orient:true,easing:'linear'};
    for(const key of ['from','to','f0','f1','start','end','assetUp','assetDown','flap'])delete o[key];
  }
  for(const l of c.labels){point([l.lat,l.lon]);if(typeof l.text!=='string'||l.text.length>100)throw new Error('Label maksimal 100 karakter.');color(l.color,'Warna label');}
  const ids=(items,label)=>{const seen=new Set();for(const item of items)if(item.id!==undefined){if(typeof item.id!=='string'||!item.id.length||item.id.length>100||seen.has(item.id))throw new Error(`ID ${label} harus unik, 1–100 karakter.`);seen.add(item.id);}};
  ids(c.routes,'rute');ids(c.objects,'objek');
  const resolve=(items,ref,label)=>{const item=Number.isInteger(ref)?items[ref]:typeof ref==='string'?items.find(x=>x.id===ref):null;if(!item)throw new Error(`Referensi ${label} tidak ditemukan: ${ref}`);return item;};
  for(const r of c.routes){point(r.from);point(r.to);color(r.color,'Warna rute');finite(r.start,'Awal rute',0,c.duration);finite(r.end,'Akhir rute',0,c.duration);if(r.end<=r.start)throw new Error('Akhir rute harus setelah awal.');finite(r.altitude,'Ketinggian rute',0,1);if(r.width!==undefined)finite(r.width,'Lebar rute',0.000001,0.05);if(r.visible!==undefined&&typeof r.visible!=='boolean')throw new Error('routes.visible harus true/false.');}
  for(const o of c.objects){
    if(!['satellite','ship','glb','sprite','bird'].includes(o.type))throw new Error('Tipe objek: satellite, ship, glb, sprite, bird.');
    if(!o.followRoute)point([o.lat,o.lon]);
    o.altitude??=0.025;finite(o.altitude,'Ketinggian objek',0,3);finite(o.scale,'Skala objek',0.000001,1);finite(o.orbitSpeed??0,'Kecepatan orbit',-180,180);finite(o.inclination??0,'Inklinasi',-90,90);
    if(o.type==='glb'){localAsset(o.asset);if(o.animationClip!==undefined&&!(typeof o.animationClip==='string'||Number.isInteger(o.animationClip)&&o.animationClip>=0))throw new Error('animationClip memakai nama atau indeks clip.');}
    finite(o.animationSpeed??1,'Kecepatan animasi',0,10);finite(o.animationOffset??0,'Offset animasi',0,120);
    if(o.screenSize!==undefined)finite(o.screenSize,'Ukuran subjek di layar',0.01,0.8);
    if(o.rotation!==undefined){if(!Array.isArray(o.rotation)||o.rotation.length!==3)throw new Error('rotation memakai [x,y,z] derajat.');o.rotation.forEach(v=>finite(v,'Rotasi model',-360,360));}
    if(['sprite','bird'].includes(o.type)){if(!Array.isArray(o.frames)||!o.frames.length||o.frames.length>16)throw new Error('Sprite/bird membutuhkan frames: 1–16 path gambar lokal.');o.frames.forEach(localAsset);finite(o.frameRate??4,'Frekuensi pose sprite',0,30);if(o.aspect!==undefined)finite(o.aspect,'Aspek sprite',0.2,6);}
    if(o.followRoute){
      const f=o.followRoute,r=resolve(c.routes,f.route,'rute objek');
      finite(f.start??r.start,'Awal perjalanan',0,c.duration);finite(f.end??r.end,'Akhir perjalanan',0,c.duration);if((f.end??r.end)<=(f.start??r.start))throw new Error('Akhir perjalanan harus setelah awal.');
      finite(f.from??0,'Progres awal',0,1);finite(f.to??1,'Progres akhir',0,1);finite(f.altitudeOffset??0,'Offset dari rute',-r.altitude,3);
      if(f.easing!==undefined&&!['linear','smooth'].includes(f.easing))throw new Error('Easing perjalanan: linear atau smooth.');
      if(f.orient!==undefined&&typeof f.orient!=='boolean')throw new Error('followRoute.orient harus true/false.');
    }
  }
  if(c.camera.follow){
    const f=c.camera.follow;resolve(c.objects,f.object,'objek kamera');f.distanceKm??=1500;f.pitch??=0;f.heading??='north';f.lookAheadSeconds??=0;f.keyframes??=[];
    finite(f.distanceKm,'Jarak kamera dari subjek (km)',0.05,60000);finite(f.pitch,'Sudut kamera follow',0,75);finite(f.lookAheadSeconds,'Lihat ke depan (detik)',0,10);
    if(!['north','route'].includes(f.heading))throw new Error('Heading kamera: north atau route.');
    if(!Array.isArray(f.keyframes)||f.keyframes.length>100)throw new Error('Keyframe follow tidak valid.');
    let last=-1;for(const k of f.keyframes){finite(k.time,'Waktu follow',0,c.duration);if(k.time<=last)throw new Error('Waktu follow harus meningkat.');last=k.time;finite(k.distanceKm,'Jarak kamera follow',0.05,60000);if(k.pitch!==undefined)finite(k.pitch,'Sudut follow',0,75);}
  }
  for(const k of ['title','subtitle'])if(typeof c[k]!=='string'||c[k].length>200)throw new Error(`${k} maksimal 200 karakter.`);
  c.detail={enabled:false,maxLevel:18,failureMode:'strict',...c.detail};
  if(typeof c.detail.enabled!=='boolean')throw new Error('detail.enabled harus true/false.');finite(c.detail.maxLevel,'Detail level',1,18);if(!Number.isInteger(c.detail.maxLevel))throw new Error('Level detail harus bilangan bulat.');
  if(!['strict','fallback'].includes(c.detail.failureMode))throw new Error('detail.failureMode: strict atau fallback.');
  const effects=c.effects??{};
  c.effects={surface:'satellite',waves:0,...effects,seaLevel:{enabled:false,level:0,keyframes:[],...effects.seaLevel},profile:{enabled:false,from:[-8.55,115.35],to:[-8.55,116.35],fromLabel:'BALI',toLabel:'LOMBOK',maxDepth:2000,...effects.profile}};
  const e=c.effects;if(!['satellite','atlas'].includes(e.surface))throw new Error('Surface: satellite atau atlas.');finite(e.waves,'Gelombang',0,2);
  if(typeof e.seaLevel.enabled!=='boolean'||typeof e.profile.enabled!=='boolean')throw new Error('Status efek tidak valid.');
  finite(e.seaLevel.level,'Muka laut',-11000,9000);
  if(!Array.isArray(e.seaLevel.keyframes)||e.seaLevel.keyframes.length>100)throw new Error('Keyframe muka laut tidak valid.');
  let seaPrev=-1;for(const k of e.seaLevel.keyframes){finite(k.time,'Waktu muka laut',0,c.duration);finite(k.value,'Muka laut',-11000,9000);if(k.time<=seaPrev)throw new Error('Waktu keyframe muka laut harus meningkat.');seaPrev=k.time;}
  point(e.profile.from);point(e.profile.to);finite(e.profile.maxDepth,'Kedalaman profil',250,11000);
  for(const key of ['fromLabel','toLabel'])if(typeof e.profile[key]!=='string'||e.profile[key].length>60)throw new Error('Label profil maksimal 60 karakter.');
  return c;
}
export function cameraAt(c,time) {
  const keys=c.camera.keyframes;
  const snapshot=key=>{const result={...c.camera,...key,roll:c.camera.roll};delete result.keyframes;delete result.follow;delete result.time;return result;};
  if(!keys.length)return snapshot({});
  if(time<=keys[0].time)return snapshot(keys[0]);
  for(let i=1;i<keys.length;i++)if(time<=keys[i].time){
    const a=keys[i-1],b=keys[i];let t=(time-a.time)/(b.time-a.time);t=t*t*(3-2*t);
    const lonDelta=((b.lon-a.lon+540)%360)-180;
    const result={...snapshot({}),lat:a.lat+(b.lat-a.lat)*t,lon:a.lon+lonDelta*t,zoom:a.zoom+(b.zoom-a.zoom)*t};
    if(a.altitudeKm!==undefined||b.altitudeKm!==undefined){const aa=a.altitudeKm??c.camera.altitudeKm??15000,bb=b.altitudeKm??c.camera.altitudeKm??15000;result.altitudeKm=Math.exp(Math.log(aa)+(Math.log(bb)-Math.log(aa))*t);}
    if(a.pitch!==undefined||b.pitch!==undefined){const aa=a.pitch??c.camera.pitch??0,bb=b.pitch??c.camera.pitch??0;result.pitch=aa+(bb-aa)*t;}
    return result;
  }
  return snapshot(keys.at(-1));
}

export function retimeScene(c,duration){
  const ratio=duration/c.duration;
  for(const k of c.camera.keyframes)k.time*=ratio;
  for(const k of c.camera.follow?.keyframes??[])k.time*=ratio;
  for(const r of c.routes){r.start*=ratio;r.end*=ratio;}
  for(const o of c.objects)if(o.followRoute){if(o.followRoute.start!==undefined)o.followRoute.start*=ratio;if(o.followRoute.end!==undefined)o.followRoute.end*=ratio;}
  for(const k of c.effects?.seaLevel?.keyframes??[])k.time*=ratio;
  c.duration=duration;
}
