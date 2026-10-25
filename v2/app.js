import {GlobeLite} from './globe-lite.js';
import {clamp} from './navigation.js';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),renderMode=params.get('render')==='1';
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let core,presets,flightStart=0,moving=false,raf=0,hiddenAt=0,active='globe';
if(renderMode)document.body.classList.add('render-mode');
function notice(error){$('notice').textContent=error.message||String(error);$('notice').hidden=false;$('status').textContent='Periksa pengaturan';}
function download(name,url){const a=document.createElement('a');a.href=url;a.download=name;a.click();}
function stop(){moving=false;if(raf)cancelAnimationFrame(raf);raf=0;}
function frame(now){raf=0;if(!moving)return;core.setTime((now-flightStart)/1000);position();if(core.time>=core.scene.duration){moving=false;$('status').textContent='Globe diam · renderer beristirahat';}else schedule();}
function schedule(){if(!raf&&!document.hidden&&moving)raf=requestAnimationFrame(frame);}
function position(){const c=core.camera;$('position').textContent=`${Math.abs(c.lat).toFixed(2)}° ${c.lat<0?'S':'N'} · ${Math.abs(c.lon).toFixed(2)}° ${c.lon<0?'W':'E'}`;$('lat').value=c.lat.toFixed(3);$('lon').value=c.lon.toFixed(3);}
function settings(){for(const key of ['land','ocean','atmosphere','halo','transparent']){const el=$(key);if(el.type==='checkbox')el.checked=core.scene.style[key];else el.value=core.scene.style[key];}$('halo-value').textContent=core.scene.style.halo.toFixed(2);$('format').value=`${core.scene.width}x${core.scene.height}`;$('replay').disabled=!core.scene.keyframes.length;position();}
function resize(){
  if(!core?.scene)return;
  const c=core.scene,view=$('viewport');let w,h;
  if(renderMode){w=Number(params.get('width'))||c.width;h=Number(params.get('height'))||c.height;$('globe-lite').style.width=w+'px';$('globe-lite').style.height=h+'px';core.resize(w,h);return;}
  const ratio=c.width/c.height;
  w=Math.max(1,Math.min(view.clientWidth,view.clientHeight*ratio));h=w/ratio;
  $('globe-lite').style.width=w+'px';$('globe-lite').style.height=h+'px';
  const dpr=Math.min(devicePixelRatio||1,1.5,1600/Math.max(w,h));core.resize(Math.max(1,Math.round(w*dpr)),Math.max(1,Math.round(h*dpr)));
}
function play(){stop();core.setTime(0);if(reduced.matches){core.setTime(core.scene.duration);position();return;}moving=true;flightStart=performance.now();$('status').textContent='Kamera bergerak…';schedule();}
function go(target,name,id=''){
  stop();core.startFlight(target,Number($('duration').value));core.scene.name='Globe Lite — '+name;active=id;
  $('place').textContent=name;$('replay').disabled=false;
  for(const button of document.querySelectorAll('.location'))button.setAttribute('aria-pressed',String(button.dataset.id===active));
  play();
}
function locationTarget(location){return {lat:location.lat,lon:location.lon,altitudeKm:location.id==='globe'?core.fitAltitude():clamp(location.altitudeKm/Math.min(core.canvas.width/core.canvas.height,1),120,50000)};}
try{
  const responses=await Promise.all([fetch('presets.json'),fetch('scene.json')]);for(const res of responses)if(!res.ok)throw new Error('File scene lokal tidak tersedia.');
  presets=await responses[0].json();const scene=await responses[1].json();
  core=new GlobeLite($('globe-lite'));await core.ready;core.applyScene(scene);resize();
  if(!renderMode)core.setCamera({...core.camera,altitudeKm:core.fitAltitude()});
  else core.setTime(Number(params.get('t'))||0);
  core.onStatus=text=>$('status').textContent=text;
  window.globeLite=core;window.__GLOBE_LITE_READY__=true;$('loading').hidden=true;$('status').textContent='Globe siap · tanpa koneksi peta online';
  for(const location of presets.locations){const button=document.createElement('button');button.className='location';button.textContent=location.name;button.dataset.id=location.id;button.setAttribute('aria-pressed',String(location.id===active));button.addEventListener('click',()=>go(locationTarget(location),location.name,location.id));$('locations').append(button);}
  for(const palette of presets.palettes){const button=document.createElement('button');button.className='palette';const swatch=document.createElement('i');swatch.style.backgroundColor=palette.land;swatch.setAttribute('aria-hidden','true');button.append(swatch,document.createTextNode(palette.name));button.setAttribute('aria-pressed',String(palette.id==='atlas'));button.addEventListener('click',()=>{core.setStyle({land:palette.land,ocean:palette.ocean,atmosphere:palette.atmosphere,background:palette.background});settings();for(const other of document.querySelectorAll('.palette'))other.setAttribute('aria-pressed',String(other===button));});$('palettes').append(button);}
  settings();
}catch(error){notice(error);$('loading').textContent='Buka Globe Lite melalui npm start, lalu kunjungi /v2/.';}
if(core?.scene&&!renderMode){
  $('duration').addEventListener('input',()=>$('duration-value').textContent=Number($('duration').value).toFixed(1)+' dtk');
  $('replay').addEventListener('click',play);
  $('settings-toggle').addEventListener('click',()=>{const open=$('settings').hidden;$('settings').hidden=!open;$('settings-toggle').setAttribute('aria-expanded',String(open));});
  $('settings-close').addEventListener('click',()=>{$('settings').hidden=true;$('settings-toggle').setAttribute('aria-expanded','false');});
  for(const key of ['land','ocean','atmosphere','halo','transparent'])$(key).addEventListener('input',()=>{const el=$(key);core.setStyle({[key]:el.type==='checkbox'?el.checked:el.type==='range'?Number(el.value):el.value});$('halo-value').textContent=core.scene.style.halo.toFixed(2);$('viewport').classList.toggle('checker',core.scene.style.transparent);});
  $('go-coordinates').addEventListener('click',()=>{try{go({lat:Number($('lat').value),lon:Number($('lon').value),altitudeKm:core.camera.altitudeKm},'Koordinat pilihan');}catch(e){notice(e);}});
  for(const id of ['lat','lon'])$(id).addEventListener('focus',stop);
  $('format').addEventListener('change',()=>{const [width,height]=$('format').value.split('x').map(Number);core.scene.width=width;core.scene.height=height;resize();const target=presets.locations.find(l=>l.id===active);if(target)go(locationTarget(target),target.name,target.id);});
  $('png').addEventListener('click',()=>{try{download('globe-lite.png',core.exportPNG());$('status').textContent='PNG diekspor · globe tanpa elemen UI';}catch(e){notice(e);}});
  $('save-json').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(core.getScene(),null,2)+'\n'],{type:'application/json'}));download('globe-lite-scene.json',url);setTimeout(()=>URL.revokeObjectURL(url),1000);});
  $('open-json').addEventListener('click',()=>$('file').click());
  $('file').addEventListener('change',async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>1048576)throw new Error('Scene JSON maksimal 1 MB.');const scene=JSON.parse(await file.text());stop();core.applyScene(scene);resize();settings();$('place').textContent=scene.name;active='';for(const b of document.querySelectorAll('.location'))b.setAttribute('aria-pressed','false');$('viewport').classList.toggle('checker',scene.style.transparent);$('status').textContent='Scene dimuat';}catch(e){notice(e);}finally{$('file').value='';}});
  let drag;
  core.canvas.addEventListener('pointerdown',event=>{stop();drag={x:event.clientX,y:event.clientY,camera:{...core.camera}};core.canvas.setPointerCapture(event.pointerId);});
  core.canvas.addEventListener('pointermove',event=>{
    if(!drag)return;
    const span=2*Math.tan(19*Math.PI/180)*drag.camera.altitudeKm;
    const scale=span/Math.max(1,core.canvas.clientHeight)/111.32;
    const lat=clamp(drag.camera.lat+(event.clientY-drag.y)*scale,-85,85),lon=drag.camera.lon-(event.clientX-drag.x)*scale/Math.max(.15,Math.cos(lat*Math.PI/180));
    core.setCamera({lat,lon:((lon+540)%360)-180,altitudeKm:drag.camera.altitudeKm});position();$('replay').disabled=true;
  });
  for(const type of ['pointerup','pointercancel'])core.canvas.addEventListener(type,()=>drag=null);
  core.canvas.addEventListener('wheel',event=>{event.preventDefault();stop();core.setCamera({...core.camera,altitudeKm:clamp(core.camera.altitudeKm*Math.exp(event.deltaY*.0012),120,50000)});position();$('replay').disabled=true;},{passive:false});
  const observer=new ResizeObserver(resize);observer.observe($('viewport'));
  document.addEventListener('visibilitychange',()=>{if(document.hidden){hiddenAt=performance.now();if(raf)cancelAnimationFrame(raf);raf=0;}else{if(hiddenAt)flightStart+=performance.now()-hiddenAt;hiddenAt=0;schedule();}});
}
