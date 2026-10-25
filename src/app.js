import {GlobeKit} from './globe.js';
import {PRESETS,validateConfig} from './config.js';
import {syncAdvanced,installAdvanced} from './controls.js';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),renderMode=params.get('render')==='1';
let kit,preset=PRESETS.includes(params.get('scene'))?params.get('scene'):'pasifik',playing=false,last=0,loadVersion=0;
if(renderMode)document.body.classList.add('render-mode');
function error(e){console.error(e);$('toast').textContent=e.message||String(e);$('toast').hidden=false;$('status').textContent='Periksa pengaturan';setTimeout(()=>$('toast').hidden=true,8000);}
function download(name,data){const a=document.createElement('a');a.href=data;a.download=name;a.click();}
function downloadJSON(c){const url=URL.createObjectURL(new Blob([JSON.stringify(c,null,2)+'\n'],{type:'application/json'}));download('globe-scene.json',url);setTimeout(()=>URL.revokeObjectURL(url),1000);}
function clock(t){return `00:${Math.floor(t).toString().padStart(2,'0')}.${Math.floor(t%1*100).toString().padStart(2,'0')}`;}
function updateTime(){const c=kit.config;$('time').textContent=clock(kit.time);$('timeline').value=kit.time;$('duration').textContent=c.duration.toFixed(2)+' s';$('timeline').max=c.duration;$('timeline').step=1/c.fps;}
function resize(){
  if(!kit?.config)return;const c=kit.config,stage=$('stage');stage.style.aspectRatio=`${c.width}/${c.height}`;
  if(renderMode){const w=Number(params.get('width'))||c.width,h=Number(params.get('height'))||c.height;if(!Number.isInteger(w)||!Number.isInteger(h)||w<64||h<64||w>4096||h>4096)throw new Error('Ukuran render harus 64–4096 px.');stage.style.width=w+'px';stage.style.height=h+'px';kit.resize(w,h);}
  else {
    const wrap=stage.parentElement,available=wrap.clientWidth-44;
    const maxHeight=Math.min(innerHeight*.64,720);
    const width=Math.max(160,Math.min(available,maxHeight*c.width/c.height));
    stage.style.width=width+'px';stage.style.height=width*c.height/c.width+'px';
    const scale=Math.min(1,1000/Math.max(c.width,c.height));kit.resize(Math.round(c.width*scale),Math.round(c.height*scale));
  }
  stage.classList.toggle('checker',c.transparent);$('dimensions').textContent=`${c.width} × ${c.height}`;
}
function sync(){
  const c=kit.config;$('scene-name').textContent=c.name;document.title=`${c.name} — Atlas`;
  for(const input of document.querySelectorAll('[data-style]')){const key=input.dataset.style;input.value=c.style[key];const out=$(key+'-value');if(out)out.textContent=Number(c.style[key]).toFixed(2);}
  const cam=kit.getCamera();for(const input of document.querySelectorAll('[data-camera]')){const key=input.dataset.camera;let value=cam[key];if(key==='lon')value=((value+540)%360)-180;input.value=value;$(key+'-value').textContent=Number(value).toFixed(2);}
  $('background').value=c.background;$('transparent').checked=c.transparent;$('title').value=c.title;$('subtitle').value=c.subtitle;
  $('labels').value=c.labels.map(l=>`${l.text} | ${l.lat} | ${l.lon}`).join('\n');
  $('keyframe-info').textContent=c.camera.keyframes.length?`${c.camera.keyframes.length} keyframe · ${c.duration} detik · transisi halus`:'Kamera statis · siap dibuat animasi';
  $('format').value=`${c.width}x${c.height}`;
  $('object').value=c.objects.length?(c.objects[0].type==='glb'?'custom':c.objects[0].type):'none';
  for(const b of document.querySelectorAll('[data-preset]')){const active=b.dataset.preset===preset;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}
  syncAdvanced(kit);
  updateTime();resize();$('status').textContent='Aset siap · tersimpan lokal';
}
async function apply(c){playing=false;$('play').textContent='▶';$('play').setAttribute('aria-label','Putar animasi');if(await kit.applyConfig(c))sync();}
async function loadPreset(name){
  const version=++loadVersion;$('loading').hidden=false;
  try{const res=await fetch(`scenes/${name}.json`);if(!res.ok)throw new Error('Scene tidak dapat dimuat.');const c=await res.json();if(version!==loadVersion)return;preset=name;await apply(c);}
  finally{if(version===loadVersion)$('loading').hidden=true;}
}
function mutate(change){try{const c=kit.getConfig();change(c);const valid=validateConfig(c);kit.config=valid;kit.render();$('status').textContent='Perubahan belum diekspor';return true;}catch(e){error(e);return false;}}
function stop(){playing=false;$('play').textContent='▶';$('play').setAttribute('aria-label','Putar animasi');}
function cameraChange(change){stop();mutate(c=>{c.camera={...kit.getCamera(),keyframes:[]};change(c.camera);});sync();}
try{
  kit=new GlobeKit($('globe'));
  await loadPreset(preset);
  if(params.has('stored')){const saved=localStorage.getItem('atlas-preview');if(saved)await apply(JSON.parse(saved));}
  if(params.has('transparent')){kit.config.transparent=params.get('transparent')==='1';resize();}
  await document.fonts.ready;
  kit.setTime(Number(params.get('t'))||0);updateTime();
  window.globeKit=kit;window.__GLOBE_READY__=true;document.body.dataset.ready='true';
  $('loading').hidden=true;
}catch(e){error(e);$('loading').textContent='Tidak dapat memuat globe. Buka melalui start.cmd atau npm start.';document.body.dataset.error=e.message;}
if(kit?.config&&!renderMode){
  installAdvanced({kit,apply,mutate,cameraChange,sync,stop,error});
  for(const b of document.querySelectorAll('[data-preset]'))b.addEventListener('click',()=>loadPreset(b.dataset.preset).catch(error));
  for(const b of document.querySelectorAll('[role=tab]'))b.addEventListener('click',()=>{for(const x of document.querySelectorAll('[role=tab]')){const active=x===b;x.setAttribute('aria-selected',String(active));$(x.getAttribute('aria-controls')).hidden=!active;}});
  for(const input of document.querySelectorAll('[data-style]'))input.addEventListener('input',()=>{
    const key=input.dataset.style,value=input.type==='color'?input.value:Number(input.value);
    if(!mutate(c=>c.style[key]=value))return;
    const s=kit.config.style,u=kit.material.uniforms;
    u.uExposure.value=s.exposure;u.uSaturation.value=s.saturation;u.uOceanMix.value=s.oceanMix;u.uFill.value=s.fill;u.uOcean.value.set(s.ocean);u.uAir.value.set(s.atmosphere);
    kit.air.children.forEach(shell=>{shell.material.uniforms.uColor.value.set(s.atmosphere);shell.material.uniforms.uStrength.value=.9*s.halo;});kit.render();
    const out=$(key+'-value');if(out)out.textContent=Number(value).toFixed(2);
  });
  for(const input of document.querySelectorAll('[data-camera]'))input.addEventListener('input',()=>cameraChange(c=>c[input.dataset.camera]=Number(input.value)));
  $('background').addEventListener('input',()=>mutate(c=>c.background=$('background').value));
  $('transparent').addEventListener('change',()=>{mutate(c=>c.transparent=$('transparent').checked);resize();});
  for(const key of ['title','subtitle'])$(key).addEventListener('input',()=>mutate(c=>c[key]=$(key).value));
  $('apply-labels').addEventListener('click',()=>{mutate(c=>{c.labels=$('labels').value.split('\n').filter(x=>x.trim()).map(row=>{const parts=row.split('|').map(x=>x.trim());if(parts.length!==3||!parts[1]||!parts[2])throw new Error('Format label: NAMA | latitude | longitude');return {text:parts[0],lat:Number(parts[1]),lon:Number(parts[2]),color:'#ffffff'};});});});
  $('object').addEventListener('change',async()=>{const c=kit.getConfig(),type=$('object').value;const cam=kit.getCamera();c.objects=type==='none'?[]:[{type,lat:cam.lat,lon:cam.lon,altitude:type==='satellite'?.32:.025,scale:type==='satellite'?.10:.065,orbitSpeed:type==='satellite'?8:0,inclination:type==='satellite'?20:0}];try{await apply(c);}catch(e){error(e);sync();}});
  $('animate-camera').addEventListener('click',()=>{stop();const cam=kit.getCamera();mutate(c=>{c.duration=12;const step=cam.altitudeKm!==undefined?Math.min(16,cam.altitudeKm/111*.16):16;c.camera.keyframes=[{...cam,time:0},{...cam,time:12,lon:cam.lon+step}];c.animationPreset='orbit';});kit.setTime(0);sync();});
  $('format').addEventListener('change',()=>{const [w,h]=$('format').value.split('x').map(Number);mutate(c=>{c.width=w;c.height=h;});resize();});
  $('play').addEventListener('click',()=>{if(kit.time>=kit.config.duration)kit.setTime(0);playing=!playing;last=performance.now();$('play').textContent=playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',playing?'Jeda animasi':'Putar animasi');});
  $('timeline').addEventListener('input',()=>{stop();kit.setTime(Number($('timeline').value));updateTime();});
  $('reset').addEventListener('click',()=>{stop();kit.setTime(0);updateTime();});
  $('png').addEventListener('click',async()=>{stop();$('png').disabled=true;try{const w=kit.canvas.width,h=kit.canvas.height;kit.resize(kit.config.width,kit.config.height);await kit.prepareFrame(kit.time);download('atlas-globe.png',kit.exportPNG());kit.resize(w,h);$('status').textContent='PNG resolusi penuh diekspor';}catch(e){error(e);resize();}finally{$('png').disabled=false;}});
  $('save-json').addEventListener('click',()=>{downloadJSON(kit.getConfig());$('status').textContent='Scene JSON diekspor';});
  $('import-json').addEventListener('click',()=>$('json-file').click());
  $('json-file').addEventListener('change',async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>1024*1024)throw new Error('JSON maksimal 1 MB.');const c=JSON.parse(await file.text());preset='';await apply(c);}catch(e){error(e);}finally{$('json-file').value='';}});
  $('clean').addEventListener('click',()=>{localStorage.setItem('atlas-preview',JSON.stringify(kit.getConfig()));window.open(`?render=1&stored=preview&t=${kit.time}&width=720&height=${Math.round(720*kit.config.height/kit.config.width)}`,'_blank','noopener');});
  let drag=null;
  kit.canvas.addEventListener('pointerdown',e=>{stop();drag={x:e.clientX,y:e.clientY,cam:kit.getCamera()};kit.canvas.setPointerCapture(e.pointerId);});
  kit.canvas.addEventListener('pointermove',e=>{if(!drag)return;const scale=Math.min(1,(drag.cam.altitudeKm??1000)/1000);cameraChange(c=>{c.lon=drag.cam.lon-(e.clientX-drag.x)*.35*scale;c.lat=Math.max(-80,Math.min(80,drag.cam.lat+(e.clientY-drag.y)*.25*scale));});});
  kit.canvas.addEventListener('pointerup',()=>drag=null);kit.canvas.addEventListener('pointercancel',()=>drag=null);
  kit.canvas.addEventListener('wheel',e=>{e.preventDefault();cameraChange(c=>{if(c.altitudeKm!==undefined)c.altitudeKm=Math.max(.5,Math.min(30000,c.altitudeKm*Math.exp(e.deltaY*.001)));else c.zoom=Math.max(.3,Math.min(3,c.zoom*Math.exp(-e.deltaY*.001)));});},{passive:false});
  addEventListener('resize',resize);
  function tick(now){if(playing){const dt=Math.max(0,Math.min((now-last)/1000,.1));kit.setTime(kit.time+dt);updateTime();if(kit.time>=kit.config.duration)stop();}if(kit.config.detail.enabled&&kit.detailLayer.status)$('status').textContent=kit.detailLayer.status;last=now;requestAnimationFrame(tick);}requestAnimationFrame(tick);
}
