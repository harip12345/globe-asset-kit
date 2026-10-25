export const PRESETS = ['pasifik','indonesia','rute','orbit','bali-lombok','laut-surut','penampang','fly-in'];
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
  for(const l of c.labels){point([l.lat,l.lon]);if(typeof l.text!=='string'||l.text.length>100)throw new Error('Label maksimal 100 karakter.');color(l.color,'Warna label');}
  for(const r of c.routes){point(r.from);point(r.to);color(r.color,'Warna rute');finite(r.start,'Awal rute',0,c.duration);finite(r.end,'Akhir rute',0,c.duration);if(r.end<=r.start)throw new Error('Akhir rute harus setelah awal.');finite(r.altitude,'Ketinggian rute',0.005,1);}
  for(const o of c.objects){if(!['satellite','ship','glb'].includes(o.type))throw new Error('Tipe objek: satellite, ship, glb.');point([o.lat,o.lon]);finite(o.altitude,'Ketinggian objek',0.01,3);finite(o.scale,'Skala objek',0.001,1);finite(o.orbitSpeed??0,'Kecepatan orbit',-180,180);finite(o.inclination??0,'Inklinasi',-90,90);if(o.type==='glb')localAsset(o.asset);}
  for(const k of ['title','subtitle'])if(typeof c[k]!=='string'||c[k].length>200)throw new Error(`${k} maksimal 200 karakter.`);
  c.detail={enabled:false,maxLevel:18,...c.detail};
  if(typeof c.detail.enabled!=='boolean')throw new Error('detail.enabled harus true/false.');finite(c.detail.maxLevel,'Detail level',1,18);
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
  if(!keys.length)return {...c.camera};
  if(time<=keys[0].time)return {...keys[0],roll:c.camera.roll};
  for(let i=1;i<keys.length;i++)if(time<=keys[i].time){
    const a=keys[i-1],b=keys[i];let t=(time-a.time)/(b.time-a.time);t=t*t*(3-2*t);
    const lonDelta=((b.lon-a.lon+540)%360)-180;
    const result={lat:a.lat+(b.lat-a.lat)*t,lon:a.lon+lonDelta*t,zoom:a.zoom+(b.zoom-a.zoom)*t,roll:c.camera.roll};
    if(a.altitudeKm!==undefined||b.altitudeKm!==undefined){const aa=a.altitudeKm??c.camera.altitudeKm??15000,bb=b.altitudeKm??c.camera.altitudeKm??15000;result.altitudeKm=Math.exp(Math.log(aa)+(Math.log(bb)-Math.log(aa))*t);}
    if(a.pitch!==undefined||b.pitch!==undefined)result.pitch=(a.pitch??0)+((b.pitch??0)-(a.pitch??0))*t;
    return result;
  }
  return {...keys.at(-1),roll:c.camera.roll};
}
