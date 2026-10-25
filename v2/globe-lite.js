import {cameraAt,clamp,unit,validateScene,EARTH_KM} from './navigation.js';
const ROOT=new URL('./',import.meta.url);
const FOV=38*Math.PI/180;
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const vertex=`#version 300 es
layout(location=0) in vec2 position;
out vec2 screen;
void main(){screen=position;gl_Position=vec4(position,0.0,1.0);}`;
const fragment=`#version 300 es
precision highp float;
in vec2 screen;out vec4 outputColor;
uniform sampler2D worldMask;uniform sampler2D indonesiaMask;
uniform vec3 cameraPosition;uniform vec3 front;uniform vec3 right;uniform vec3 up;
uniform float aspect;uniform float tanHalfFov;uniform float halo;uniform float coast;uniform bool transparent;
uniform vec3 landColor;uniform vec3 oceanColor;uniform vec3 airColor;uniform vec3 backgroundColor;
const float PI=3.141592653589793;
float landAt(vec3 p){
 float lon=atan(-p.z,p.x)*180.0/PI,lat=asin(clamp(p.y,-1.0,1.0))*180.0/PI;
 vec2 uv=vec2(lon/360.0+.5,lat/180.0+.5);
 float mask=texture(worldMask,uv).r;
 if(lon>92.0&&lon<143.0&&lat>-13.0&&lat<9.0){
  vec2 regional=vec2((lon-92.0)/51.0,(lat+13.0)/22.0);
  float edge=min(min(regional.x,1.0-regional.x),min(regional.y,1.0-regional.y));
  mask=mix(mask,texture(indonesiaMask,regional).r,smoothstep(0.0,.003,edge));
 }
 return mask;
}
void main(){
 vec3 ray=normalize(-front+right*screen.x*aspect*tanHalfFov+up*screen.y*tanHalfFov);
 float b=dot(cameraPosition,ray),disc=b*b-dot(cameraPosition,cameraPosition)+1.0;
 float footprint=max(fwidth(disc),.0000001);
 float impact=length(cross(cameraPosition,ray));
 float glow=exp(-max(0.0,impact-1.0)*70.0)*halo*.55;
 glow*=1.0-smoothstep(1.035,1.08,impact);
 if(disc<0.0){
  if(transparent)outputColor=vec4(airColor,clamp(glow,0.0,.8));
  else outputColor=vec4(mix(backgroundColor,airColor,clamp(glow,0.0,.8)),1.0);
  return;
 }
 float distance=-b-sqrt(max(0.0,disc));
 if(distance<0.0){outputColor=vec4(backgroundColor,transparent?0.0:1.0);return;}
 vec3 p=normalize(cameraPosition+ray*distance);
 float mask=landAt(p),land=smoothstep(.2,.8,mask);
 vec3 color=mix(oceanColor,landColor,land);
 vec3 light=normalize(front*.85+up*.65-right*.4);
 color*=.64+.36*max(dot(p,light),0.0);
 float shoreline=4.0*mask*(1.0-mask);
 color*=1.0-shoreline*coast*.32;
 float rim=pow(1.0-max(dot(p,-ray),0.0),4.0);
 color=mix(color,airColor,rim*.26*halo);
 float coverage=smoothstep(0.0,footprint,disc);
 if(transparent)outputColor=vec4(color,coverage);
 else outputColor=vec4(mix(mix(backgroundColor,airColor,glow),color,coverage),1.0);
}`;

export class GlobeLite{
  constructor(canvas){
    this.canvas=canvas;this.scene=null;this.camera=null;this.time=0;this.lost=false;
    this.gl=canvas.getContext('webgl2',{alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:false,preserveDrawingBuffer:false,powerPreference:'low-power'});
    if(!this.gl)throw new Error('Globe Lite memerlukan browser dengan WebGL 2.');
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;this.onStatus?.('Grafik dijeda oleh browser.');});
    canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;this.ready=this.initialize().then(()=>{this.render();this.onStatus?.('Globe siap');});this.ready.catch(e=>this.onStatus?.(e.message));});
    this.ready=this.initialize();
  }
  shader(type,source){const gl=this.gl,s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error('Shader tidak dapat dibuat: '+message);}return s;}
  async initialize(){
    const gl=this.gl,program=gl.createProgram(),vs=this.shader(gl.VERTEX_SHADER,vertex),fs=this.shader(gl.FRAGMENT_SHADER,fragment);
    gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Renderer tidak dapat dibuat: '+gl.getProgramInfoLog(program));
    this.program=program;this.uniforms={};
    for(const name of ['worldMask','indonesiaMask','cameraPosition','front','right','up','aspect','tanHalfFov','halo','coast','transparent','landColor','oceanColor','airColor','backgroundColor'])this.uniforms[name]=gl.getUniformLocation(program,name);
    this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    this.textures=[];
    // One-channel GPU textures; decoded source images are released immediately.
    for(const [index,file] of ['world-land.png','indonesia-land.png'].entries()){
      const res=await fetch(new URL('assets/'+file,ROOT));if(!res.ok)throw new Error('Mask daratan tidak tersedia: '+file);
      const image=await createImageBitmap(await res.blob(),{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'});
      try{
        const texture=gl.createTexture();this.textures.push(texture);gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,gl.RED,gl.UNSIGNED_BYTE,image);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.generateMipmap(gl.TEXTURE_2D);
      }finally{image.close();}
    }
    this.render();return this;
  }
  applyScene(raw){this.scene=validateScene(raw);this.time=0;this.camera=cameraAt(this.scene,0);this.render();return this.getScene();}
  getScene(){return structuredClone(this.scene);}
  setTime(seconds){if(!Number.isFinite(seconds))throw new Error('Waktu harus berupa angka.');this.time=clamp(seconds,0,this.scene.duration);this.camera=cameraAt(this.scene,this.time);this.render();return this.time;}
  setCamera(camera){const c=validateScene({...this.scene,camera,keyframes:[]}).camera;this.camera={...c};this.scene.camera={...c};this.scene.keyframes=[];this.time=0;this.render();}
  startFlight(target,duration=3){
    const next={...this.scene,camera:{...this.camera},duration,keyframes:[{...this.camera,time:0},{...target,time:duration}]};
    return this.applyScene(next);
  }
  setStyle(patch){const s=validateScene({...this.scene,style:{...this.scene.style,...patch}});this.scene.style=s.style;this.render();}
  resize(width,height){if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>4096||height>4096)throw new Error('Ukuran canvas harus 1–4096 px.');this.canvas.width=width;this.canvas.height=height;this.render();}
  fitAltitude(fill=.84){const aspect=this.canvas.width/this.canvas.height;const d=Math.sqrt(1+1/(Math.tan(FOV/2)*Math.min(aspect,1)*fill)**2);return clamp((d-1)*EARTH_KM,120,50000);}
  render(){
    if(!this.scene||!this.program||this.textures?.length!==2||this.lost)return;
    const gl=this.gl,u=this.uniforms,c=this.camera,s=this.scene.style,D=Math.PI/180;
    const front=unit(c.lat,c.lon),right=[-Math.sin(c.lon*D),0,-Math.cos(c.lon*D)],up=[-Math.sin(c.lat*D)*Math.cos(c.lon*D),Math.cos(c.lat*D),Math.sin(c.lat*D)*Math.sin(c.lon*D)];
    gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.useProgram(this.program);gl.bindVertexArray(this.vao);
    for(let i=0;i<2;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,this.textures[i]);}
    gl.uniform1i(u.worldMask,0);gl.uniform1i(u.indonesiaMask,1);gl.uniform3fv(u.front,front);gl.uniform3fv(u.right,right);gl.uniform3fv(u.up,up);gl.uniform3fv(u.cameraPosition,front.map(x=>x*(1+c.altitudeKm/EARTH_KM)));
    gl.uniform1f(u.aspect,this.canvas.width/this.canvas.height);gl.uniform1f(u.tanHalfFov,Math.tan(FOV/2));gl.uniform1f(u.halo,s.halo);gl.uniform1f(u.coast,s.coast);gl.uniform1i(u.transparent,s.transparent?1:0);
    gl.uniform3fv(u.landColor,rgb(s.land));gl.uniform3fv(u.oceanColor,rgb(s.ocean));gl.uniform3fv(u.airColor,rgb(s.atmosphere));gl.uniform3fv(u.backgroundColor,rgb(s.background));
    gl.drawArrays(gl.TRIANGLES,0,6);this.canvas.dataset.ready='true';this.canvas.dataset.time=String(this.time);
  }
  exportPNG(width=this.scene.width,height=this.scene.height){const w=this.canvas.width,h=this.canvas.height;try{this.resize(width,height);this.render();return this.canvas.toDataURL('image/png');}finally{this.resize(w,h);}}
  destroy(){for(const t of this.textures??[])this.gl.deleteTexture(t);this.gl.deleteBuffer(this.buffer);this.gl.deleteVertexArray(this.vao);this.gl.deleteProgram(this.program);this.scene=null;}
}
