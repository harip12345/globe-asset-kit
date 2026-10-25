import {readFile,writeFile} from 'node:fs/promises';
const base=JSON.parse(await readFile('scenes/pasifik.json','utf8'));
const make=()=>({...structuredClone(base),duration:10,camera:{lat:-8.55,lon:115.75,zoom:1,roll:0,altitudeKm:450,pitch:0,keyframes:[]},labels:[{text:'BALI',lat:-8.42,lon:115.15,color:'#ffffff'},{text:'LOMBOK',lat:-8.5,lon:116.3,color:'#ffffff'},{text:'NUSA PENIDA',lat:-8.74,lon:115.54,color:'#ffffff'}],effects:{surface:'satellite',waves:0,seaLevel:{enabled:false,level:0,keyframes:[]},profile:{enabled:false,from:[-8.55,115.35],to:[-8.55,116.35],fromLabel:'BALI',toLabel:'LOMBOK',maxDepth:2000}},detail:{enabled:false,maxLevel:18}});
const detail=make();detail.name='Bali–Lombok — Citra satelit detail';detail.detail.enabled=true;
const drain=make();drain.name='Laut menyurut — Bali–Lombok';drain.effects.surface='atlas';drain.effects.seaLevel={enabled:true,level:0,keyframes:[{time:0,value:0},{time:10,value:-120}]};drain.animationPreset='sea-drain';
const profile=structuredClone(drain);profile.name='Penampang Selat Lombok';profile.effects.profile.enabled=true;profile.labels=[];profile.animationPreset='cross-section';
const fly=make();fly.name='Globe → Pantai Sanur';fly.detail.enabled=true;fly.camera={lat:-8.704,lon:115.265,zoom:1,roll:0,altitudeKm:4,pitch:0,keyframes:[{time:0,lat:-8.704,lon:115.265,zoom:1,altitudeKm:20000,pitch:0},{time:10,lat:-8.704,lon:115.265,zoom:1,altitudeKm:4,pitch:0}]};fly.labels=[];fly.animationPreset='fly-in';
for(const [name,c] of Object.entries({'bali-lombok':detail,'laut-surut':drain,'penampang':profile,'fly-in':fly}))await writeFile(`scenes/${name}.json`,JSON.stringify(c,null,2)+'\n');
console.log('Four new presets written.');
