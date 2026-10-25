import {seaLevelAt} from './elevation.js';
const $=id=>document.getElementById(id);
export function syncAdvanced(kit){
  const c=kit.config,cam=kit.getCamera();
  $('detail-enabled').checked=c.detail.enabled;$('target-lat').value=cam.lat.toFixed(5);$('target-lon').value=(((cam.lon+540)%360)-180).toFixed(5);
  $('altitude').value=Math.log10(cam.altitudeKm??Math.max(100,(3/cam.zoom-1)*6371));
  $('altitude-value').textContent=cam.altitudeKm!==undefined?cam.altitudeKm.toLocaleString('id-ID',{maximumFractionDigits:2})+' km':'Mode globe';
  $('pitch').value=cam.pitch??0;$('pitch-value').textContent=(cam.pitch??0).toFixed(0)+'°';
  $('surface-mode').value=c.effects.surface;$('sea-enabled').checked=c.effects.seaLevel.enabled;$('sea-static').value=Math.round(seaLevelAt(c,kit.time));
  $('waves').value=c.effects.waves;$('waves-value').textContent=c.effects.waves.toFixed(1);$('animation-duration').value=c.duration;
  $('animation-type').value=c.animationPreset??(c.camera.keyframes.length?'orbit':'none');
  const keys=c.effects.seaLevel.keyframes;if(keys.length){$('sea-from').value=keys[0].value;$('sea-to').value=keys.at(-1).value;}
}
export function installAdvanced({kit,apply,mutate,cameraChange,sync,stop,error}){
  async function edit(fn){stop();const c=kit.getConfig();fn(c);try{await apply(c);}catch(e){error(e);}}
  $('detail-enabled').addEventListener('change',()=>edit(c=>{c.detail.enabled=$('detail-enabled').checked;if(c.detail.enabled){c.camera={...kit.getCamera(),altitudeKm:kit.getCamera().altitudeKm??300,keyframes:[]};}else if(c.camera.altitudeKm!==undefined){c.camera.keyframes=[];}}));
  for(const [id,key] of [['target-lat','lat'],['target-lon','lon']])$(id).addEventListener('change',()=>cameraChange(cam=>cam[key]=Number($(id).value)));
  $('altitude').addEventListener('input',()=>cameraChange(cam=>cam.altitudeKm=10**Number($('altitude').value)));
  $('pitch').addEventListener('input',()=>cameraChange(cam=>{cam.pitch=Number($('pitch').value);cam.altitudeKm??=300;}));
  $('location').addEventListener('change',()=>{
    const locations={bali:[-8.55,115.8,250],sanur:[-8.704,115.265,4],jakarta:[-6.18,106.83,12],tokyo:[35.68,139.76,12],tambrauw:[-.45,132.42,25]};
    const point=locations[$('location').value];if(!point)return;
    edit(c=>{c.detail.enabled=true;c.camera={lat:point[0],lon:point[1],zoom:1,roll:0,altitudeKm:point[2],pitch:0,keyframes:[]};c.effects.profile.enabled=false;});
  });
  $('surface-mode').addEventListener('change',()=>edit(c=>{c.effects.surface=$('surface-mode').value;if(c.effects.surface==='atlas')c.detail.enabled=false;}));
  $('sea-enabled').addEventListener('change',()=>edit(c=>c.effects.seaLevel.enabled=$('sea-enabled').checked));
  $('sea-static').addEventListener('change',()=>edit(c=>{c.effects.seaLevel={enabled:true,level:Number($('sea-static').value),keyframes:[]};}));
  let waveTimer;
  $('waves').addEventListener('input',()=>{clearTimeout(waveTimer);$('waves-value').textContent=Number($('waves').value).toFixed(1);waveTimer=setTimeout(()=>edit(c=>c.effects.waves=Number($('waves').value)),100);});
  $('animation-type').addEventListener('change',()=>{if($('animation-type').value==='sea-rise')$('sea-to').value=100;else if(['sea-drain','cross-section'].includes($('animation-type').value))$('sea-to').value=-120;});
  $('apply-animation').addEventListener('click',async()=>{
    const type=$('animation-type').value,duration=Number($('animation-duration').value),cam=kit.getCamera();
    await edit(c=>{
      c.duration=duration;c.camera={...cam,keyframes:[]};c.effects.profile.enabled=false;c.effects.seaLevel.keyframes=[];c.effects.waves=0;
      c.effects.seaLevel.enabled=false;
      if(type==='orbit'){
        const step=cam.altitudeKm!==undefined?Math.max(.005,Math.min(16,cam.altitudeKm/111*.16)):16;
        c.camera.keyframes=[{...cam,time:0},{...cam,time:duration,lon:cam.lon+step}];
      }else if(type==='fly-in'){
        c.detail.enabled=true;c.camera.altitudeKm=cam.altitudeKm??30;
        c.camera.keyframes=[{...cam,altitudeKm:20000,pitch:0,time:0},{...cam,altitudeKm:cam.altitudeKm??30,pitch:0,time:duration}];
      }else if(['sea-drain','sea-rise','cross-section'].includes(type)){
        c.detail.enabled=false;c.effects.surface='atlas';
        c.effects.seaLevel={enabled:true,level:0,keyframes:[{time:0,value:Number($('sea-from').value)},{time:duration,value:Number($('sea-to').value)}]};
        c.effects.profile.enabled=type==='cross-section';
      }else if(type==='waves'){c.effects.waves=1;}
      c.animationPreset=type;
    });
    kit.setTime(0);sync();
  });
}
