import {seaLevelAt} from './elevation.js';
export function drawProfile(ctx,w,h,c,store,time){
  const p=c.effects.profile,points=store.profile(p.from,p.to,320),sea=seaLevelAt(c,time),unit=Math.min(w,h)/1080;
  const left=w*.13,right=w*.92,top=h*.23,bottom=h*.78,plotW=right-left,plotH=bottom-top;
  const highest=Math.max(250,...points.map(p=>p.elevation))*1.15;
  const maxDepth=Math.max(p.maxDepth,Math.abs(Math.min(...points.map(p=>p.elevation)))*1.08,Math.abs(sea)*1.15);
  const Y=e=>top+(highest-e)/(highest+maxDepth)*plotH,X=i=>left+plotW*i/(points.length-1),seaY=Y(sea);
  ctx.clearRect(0,0,w,h);if(!c.transparent){ctx.fillStyle=c.background;ctx.fillRect(0,0,w,h);}
  const label=(text,x,y,size=20,color='#c5d8f1',align='left')=>{ctx.fillStyle=color;ctx.font=`600 ${size*unit}px Arial,sans-serif`;ctx.textAlign=align;ctx.fillText(text,x,y);};
  label('PENAMPANG KEDALAMAN',left,h*.11,21,'#87b8f5');
  label(p.fromLabel+' — '+p.toLabel,left,h*.15,37,'#f4f0df');
  ctx.save();ctx.beginPath();ctx.rect(left,top,plotW,plotH);ctx.clip();
  const water=ctx.createLinearGradient(0,top,0,bottom);water.addColorStop(0,'#459cc3');water.addColorStop(1,'#102744');
  ctx.fillStyle=water;ctx.fillRect(left,Math.max(top,seaY),plotW,bottom-Math.max(top,seaY));
  ctx.beginPath();ctx.moveTo(left,bottom);points.forEach((p,i)=>ctx.lineTo(X(i),Y(p.elevation)));ctx.lineTo(right,bottom);ctx.closePath();
  const land=ctx.createLinearGradient(0,top,0,bottom);land.addColorStop(0,'#9f9d65');land.addColorStop(1,'#4d3e30');ctx.fillStyle=land;ctx.fill();
  ctx.beginPath();points.forEach((p,i)=>{if(i===0)ctx.moveTo(X(i),Y(p.elevation));else ctx.lineTo(X(i),Y(p.elevation));});ctx.strokeStyle='#d9c897';ctx.lineWidth=3*unit;ctx.stroke();
  ctx.setLineDash([9*unit,8*unit]);ctx.strokeStyle='#8cd2ed';ctx.lineWidth=2*unit;ctx.beginPath();ctx.moveTo(left,seaY);ctx.lineTo(right,seaY);ctx.stroke();ctx.setLineDash([]);
  ctx.restore();
  const step=maxDepth>3000?1000:maxDepth>1500?500:250;
  for(let depth=0;depth<=maxDepth;depth+=step){const y=Y(-depth);ctx.strokeStyle='rgba(160,190,220,.16)';ctx.lineWidth=unit;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();label(depth+' m',left-12*unit,y+6*unit,17,'#9db0c6','right');}
  label('Muka laut '+(sea>0?'+':'')+Math.round(sea)+' m',right,Math.max(top-18*unit,seaY-18*unit),21,'#9edcf7','right');
  label(p.fromLabel,left,bottom+40*unit,23,'#f2e8cb');label(p.toLabel,right,bottom+40*unit,23,'#f2e8cb','right');
  label(Math.round(points.at(-1).distance)+' km',right,bottom+76*unit,18,'#9db0c6','right');
  label('Elevasi NOAA ETOPO1 · profil mengikuti koordinat transek',left,h*.89,16,'#71869f');
  label('Ilustrasi ambang elevasi · skala vertikal diperbesar',left,h*.915,16,'#71869f');
}
