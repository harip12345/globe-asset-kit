import * as THREE from 'three';
export const EARTH_KM=6371;
export const lerp=(a,b,t)=>a+(b-a)*t;
export function seaLevelAt(config,time){
  const s=config.effects.seaLevel,keys=s.keyframes;
  if(!s.enabled)return 0;
  if(!keys.length)return s.level;
  if(time<=keys[0].time)return keys[0].value;
  for(let i=1;i<keys.length;i++)if(time<=keys[i].time){const a=keys[i-1],b=keys[i];let t=(time-a.time)/(b.time-a.time);t=t*t*(3-2*t);return lerp(a.value,b.value,t);}
  return keys.at(-1).value;
}
export function distanceKm(a,b){const d=Math.PI/180,lat=(b[0]-a[0])*d,lon=(b[1]-a[1])*d;return 2*EARTH_KM*Math.asin(Math.min(1,Math.sqrt(Math.sin(lat/2)**2+Math.cos(a[0]*d)*Math.cos(b[0]*d)*Math.sin(lon/2)**2)));}
export class ElevationStore {
  constructor(){this.grids=[];this.promise=null;}
  async load(){
    if(this.promise)return this.promise;
    this.promise=Promise.all(['etopo-global','bali-lombok-etopo'].map(async name=>{
      const res=await fetch(`assets/elevation/${name}.json`);if(!res.ok)throw new Error('Metadata elevasi tidak tersedia.');const meta=await res.json();
      const img=new Image();img.src=`assets/elevation/${name}.png`;await img.decode();
      const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
      const data=ctx.getImageData(0,0,img.width,img.height).data;
      const texture=new THREE.Texture(img);texture.colorSpace=THREE.NoColorSpace;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
      return {name,meta,data,texture};
    })).then(grids=>{this.grids=grids;return this;}).catch(e=>{this.promise=null;throw e;});
    return this.promise;
  }
  sample(lat,lon){
    lon=((lon+540)%360)-180;
    const g=[...this.grids].reverse().find(({meta:m})=>lon>=m.west&&lon<=m.east&&lat>=m.south&&lat<=m.north);
    if(!g)throw new Error('Elevasi belum dimuat atau titik berada di luar data.');
    const {meta:m,data}=g;
    const x=Math.max(0,Math.min(m.width-1,(lon-m.west)/(m.east-m.west)*(m.width-1)));
    const y=Math.max(0,Math.min(m.height-1,(m.north-lat)/(m.north-m.south)*(m.height-1)));
    const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(x0+1,m.width-1),y1=Math.min(y0+1,m.height-1);
    const value=(xx,yy)=>{const i=(yy*m.width+xx)*4;return data[i]*256+data[i+1]-12000;};
    return lerp(lerp(value(x0,y0),value(x1,y0),x-x0),lerp(value(x0,y1),value(x1,y1),x-x0),y-y0);
  }
  profile(from,to,count=256){const points=[];let lonDelta=((to[1]-from[1]+540)%360)-180;for(let i=0;i<count;i++){const t=i/(count-1),lat=lerp(from[0],to[0],t),lon=from[1]+lonDelta*t;points.push({distance:distanceKm(from,to)*t,elevation:this.sample(lat,lon)});}return points;}
}
export const ELEVATION_GLSL=`
uniform sampler2D uDemGlobal;uniform sampler2D uDemRegional;
uniform vec2 uDemSize;uniform vec2 uRegionalSize;uniform vec4 uRegionalBounds;
uniform float uElevationEnabled;uniform float uSeaLevel;uniform float uSeaEnabled;uniform float uSurface;uniform float uWaves;uniform float uTime;
float unpackHeight(vec4 c){return c.r*65280.0+c.g*255.0-12000.0;}
vec2 gridPixel(vec2 uv,vec2 size){return (clamp(uv,0.0,1.0)*(size-1.0)+.5)/size;}
float terrainHeight(vec2 uv){
 float h=unpackHeight(texture2D(uDemGlobal,gridPixel(uv,uDemSize)));
 vec2 ll=vec2(uv.x*360.0-180.0,uv.y*180.0-90.0);
 if(ll.x>=uRegionalBounds.x&&ll.x<=uRegionalBounds.z&&ll.y>=uRegionalBounds.y&&ll.y<=uRegionalBounds.w){
  vec2 p=(ll-uRegionalBounds.xy)/(uRegionalBounds.zw-uRegionalBounds.xy);h=unpackHeight(texture2D(uDemRegional,gridPixel(p,uRegionalSize)));
 }
 return h;
}
vec3 effectSurface(vec3 original,vec2 uv){
 if(uElevationEnabled<.5)return original;
 float h=terrainHeight(uv),level=uSeaEnabled>.5?uSeaLevel:0.0;
 float feather=max(fwidth(h)*.6,2.0),land=smoothstep(level-feather,level+feather,h);
 float d=max(0.0,level-h);
 vec3 shallow=vec3(.10,.36,.47),deep=vec3(.012,.055,.15);
 vec3 ocean=mix(shallow,deep,smoothstep(0.0,4500.0,d));
 vec3 earth=mix(vec3(.34,.23,.10),vec3(.20,.37,.13),smoothstep(-3500.0,100.0,h));
 vec2 delta=vec2(.0000463,.0000926);
 float east=terrainHeight(uv+vec2(delta.x,0.0))-terrainHeight(uv-vec2(delta.x,0.0));
 float north=terrainHeight(uv+vec2(0.0,delta.y))-terrainHeight(uv-vec2(0.0,delta.y));
 float slope=clamp(-east*.00035+north*.0005,-.3,.3);earth*=1.0+slope;
 if(uSurface>.5){
  earth=mix(vec3(.09,.28,.06),vec3(.38,.36,.18),smoothstep(1200.0,4000.0,h));earth*=1.0+slope;
  ocean=mix(vec3(.006,.026,.09),vec3(.04,.22,.32),exp(-d/700.0));
  float bands=.97+.03*sin(d*.018);ocean*=bands;
 }
 float wave=sin(uv.x*800.0+uTime*1.4+sin(uv.y*600.0))*sin(uv.y*900.0-uTime*.6);
 ocean*=1.0+wave*uWaves*.1;
 if(uSurface<.5){
  // Existing dry land retains its satellite imagery; newly exposed seabed is illustrative terrain colour.
  earth=mix(earth,original,smoothstep(-5.0,12.0,h));
  ocean=mix(original,ocean,.55);
 }
 vec3 result=mix(ocean,earth,land);
 float coast=1.0-smoothstep(feather,feather*3.0+8.0,abs(h-level));
 if(uSurface>.5)result=mix(result,vec3(.025,.07,.09),coast*.72);
 else if(abs(level)>1.0)result=mix(result,vec3(.68,.60,.31),coast*.5);
 return result;
}`;
