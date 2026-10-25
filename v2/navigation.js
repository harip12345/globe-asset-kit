const D=Math.PI/180;
export const EARTH_KM=6371;
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const unit=(lat,lon)=>[Math.cos(lat*D)*Math.cos(lon*D),Math.sin(lat*D),-Math.cos(lat*D)*Math.sin(lon*D)];
export const smooth=t=>t*t*t*(t*(t*6-15)+10);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const norm=a=>{const r=Math.hypot(...a);return a.map(x=>x/r);};
export function interpolateCamera(a,b,t){
  const p=smooth(clamp(t,0,1)),u=unit(a.lat,a.lon),v=unit(b.lat,b.lon),angle=Math.acos(clamp(dot(u,v),-1,1));
  let q;
  if(angle<1e-6)q=u;
  else if(Math.PI-angle<1e-5){
    const tangent=norm(Math.abs(u[1])<.9?[-u[2],0,u[0]]:[0,-u[2],u[1]]);
    q=u.map((x,i)=>x*Math.cos(Math.PI*p)+tangent[i]*Math.sin(Math.PI*p));
  }else q=u.map((x,i)=>(x*Math.sin((1-p)*angle)+v[i]*Math.sin(p*angle))/Math.sin(angle));
  q=norm(q);
  const base=Math.exp(Math.log(a.altitudeKm)*(1-p)+Math.log(b.altitudeKm)*p);
  // Pull back gently for long hops; nearby islands keep their close framing.
  const arc=Math.max(0,angle*EARTH_KM-250)*.5*Math.sin(Math.PI*p)**2;
  return {lat:Math.asin(clamp(q[1],-1,1))/D,lon:Math.atan2(-q[2],q[0])/D,altitudeKm:clamp(base+arc,120,50000)};
}
export function cameraAt(scene,time){
  const keys=scene.keyframes;
  if(!keys.length)return {...scene.camera};
  if(time<=keys[0].time)return {lat:keys[0].lat,lon:keys[0].lon,altitudeKm:keys[0].altitudeKm};
  for(let i=1;i<keys.length;i++)if(time<=keys[i].time)return interpolateCamera(keys[i-1],keys[i],(time-keys[i-1].time)/(keys[i].time-keys[i-1].time));
  const k=keys.at(-1);return {lat:k.lat,lon:k.lon,altitudeKm:k.altitudeKm};
}
export function validateScene(input){
  const s=structuredClone(input);
  const number=(v,name,lo,hi)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw new Error(`${name}: gunakan angka ${lo}–${hi}.`);};
  const camera=c=>{if(!c)throw new Error('Kamera belum ada.');number(c.lat,'Latitude',-85,85);number(c.lon,'Longitude',-720,720);number(c.altitudeKm,'Ketinggian kamera',120,50000);};
  if(s.version!==2)throw new Error('Gunakan scene Globe Lite versi 2.');
  if(typeof s.name!=='string'||s.name.length>100)throw new Error('Nama maksimal 100 karakter.');
  number(s.width,'Lebar',64,4096);number(s.height,'Tinggi',64,4096);if(!Number.isInteger(s.width)||!Number.isInteger(s.height))throw new Error('Ukuran harus bilangan bulat.');
  number(s.duration,'Durasi',.1,120);camera(s.camera);
  if(!s.style)throw new Error('Gaya belum ada.');
  for(const key of ['land','ocean','atmosphere','background'])if(!/^#[0-9a-f]{6}$/i.test(s.style[key]))throw new Error(`Warna ${key} harus #RRGGBB.`);
  number(s.style.halo,'Halo',0,1.5);number(s.style.coast,'Garis pantai',0,1);if(typeof s.style.transparent!=='boolean')throw new Error('transparent harus true/false.');
  if(!Array.isArray(s.keyframes)||s.keyframes.length>100)throw new Error('Keyframes maksimal 100.');
  let prev=-1;for(const k of s.keyframes){camera(k);number(k.time,'Waktu keyframe',0,s.duration);if(k.time<=prev)throw new Error('Urutkan waktu keyframe dari kecil ke besar.');prev=k.time;}
  return s;
}
