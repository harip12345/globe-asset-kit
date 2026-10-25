import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {cameraAt,localAsset,validateConfig} from './config.js';
import {makeSatellite,makeShip} from './models.js';
import {ElevationStore,ELEVATION_GLSL,seaLevelAt,EARTH_KM} from './elevation.js';
import {DetailLayer} from './detail.js';
import {drawProfile} from './profile.js';
import {geo,coordinates,reference,RouteCurve,objectPose,orientTraveller,followAt} from './motion.js';
const D=Math.PI/180;
export {geo};
const vertex=`varying vec2 vUv;varying vec2 vGeo;varying vec3 vN;varying vec3 vV;varying vec3 vWorld;
#ifdef USE_GEO_UV
attribute vec2 geoUv;
#endif
void main(){vUv=uv;
#ifdef USE_GEO_UV
vGeo=geoUv;
#else
vGeo=uv;
#endif
vec4 p=modelViewMatrix*vec4(position,1.0);vWorld=(modelMatrix*vec4(position,1.0)).xyz;vN=normalize(normalMatrix*normal);vV=-p.xyz;gl_Position=projectionMatrix*p;}`;
const fragment=`
uniform sampler2D uMap;uniform vec3 uOcean;uniform vec3 uAir;uniform float uExposure;uniform float uSaturation;uniform float uOceanMix;uniform float uFill;uniform float uSatelliteTile;
varying vec2 vUv;varying vec2 vGeo;varying vec3 vN;varying vec3 vV;
${ELEVATION_GLSL}
void main(){
 vec3 c=texture2D(uMap,vUv).rgb;
 float lum=dot(c,vec3(.2126,.7152,.0722));
 float sum=c.r+c.g+c.b+.0001;
 float water=smoothstep(.03,.22,(c.b-c.r)/sum)*smoothstep(-.04,.05,(c.b-c.g)/sum);
 vec3 sea=uOcean*(.75+2.6*sqrt(max(lum,0.0)));
 c=mix(c,sea,water*uOceanMix*(1.0-uSatelliteTile));
 c=effectSurface(c,vGeo);
 c=mix(vec3(dot(c,vec3(.2126,.7152,.0722))),c,uSaturation);
 vec3 n=normalize(vN),v=normalize(vV),light=normalize(vec3(-.45,.65,1.0));
 float diffuse=max(dot(n,light),0.0);
 c*=uFill+(1.0-uFill)*diffuse;
 c*=uExposure;
 float edge=pow(1.0-max(dot(n,v),0.0),4.0);
 c=mix(c,uAir,edge*.28);
 gl_FragColor=vec4(c,1.0);
 #include <colorspace_fragment>
}`;
const airFragment=`uniform vec3 uColor;uniform vec3 uCam;uniform float uStrength;varying vec3 vWorld;void main(){vec3 ray=normalize(vWorld-uCam);float b=length(cross(ray,uCam));if(b<.999)discard;float alpha=exp(-max(0.0,b-1.0)*58.0)*smoothstep(1.085,1.01,b)*uStrength;gl_FragColor=vec4(uColor,alpha);
#include <colorspace_fragment>
}`;
function disposeGroup(g){const textures=new Set();g.traverse(o=>{o.userData.mixer?.stopAllAction();for(const t of o.userData.ownedTextures??[])textures.add(t);o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});textures.forEach(t=>t.dispose());g.clear();}
export class GlobeKit {
  constructor(canvas){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.config=null;this.time=0;this.assets=new Map();this.objectItems=[];this.routeItems=[];
    this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(1);this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(42,1,.01,100);this.camera.up.set(0,1,0);
    this.material=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms:{uMap:{value:null},uOcean:{value:new THREE.Color()},uAir:{value:new THREE.Color()},uExposure:{value:1},uSaturation:{value:1},uOceanMix:{value:.5},uFill:{value:.65}}});
    Object.assign(this.material.uniforms,{uSatelliteTile:{value:0},uDemGlobal:{value:null},uDemRegional:{value:null},uDemSize:{value:new THREE.Vector2(1,1)},uRegionalSize:{value:new THREE.Vector2(1,1)},uRegionalBounds:{value:new THREE.Vector4(114,-9.2,117.5,-7.8)},uElevationEnabled:{value:0},uSeaEnabled:{value:0},uSeaLevel:{value:0},uSurface:{value:0},uWaves:{value:0},uTime:{value:0}});
    this.elevation=new ElevationStore();this.detailLayer=new DetailLayer(this.scene,this.material,()=>this.render());
    this.earth=new THREE.Mesh(new THREE.SphereGeometry(1,192,128),this.material);this.scene.add(this.earth);
    this.air=new THREE.Group();
    for(const [scale,strength] of [[1.085,.9]]){
      const m=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:airFragment,uniforms:{uColor:{value:new THREE.Color('#5aa9ff')},uCam:{value:new THREE.Vector3()},uStrength:{value:strength}},transparent:true,side:THREE.BackSide,depthWrite:false,blending:THREE.NormalBlending});
      const shell=new THREE.Mesh(new THREE.SphereGeometry(scale,128,80),m);this.air.add(shell);
    }
    this.scene.add(this.air);this.routeGroup=new THREE.Group();this.scene.add(this.routeGroup);this.objects=new THREE.Group();this.scene.add(this.objects);
    this.scene.add(new THREE.AmbientLight('#d8e7ff',2));this.key=new THREE.DirectionalLight('#ffffff',3);this.scene.add(this.key);
  }
  async loadTexture(file){
    const url=localAsset(file);
    if(!this.assets.has(url))this.assets.set(url,new THREE.TextureLoader().loadAsync(url).then(t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());return t;}).catch(e=>{this.assets.delete(url);throw e;}));
    return this.assets.get(url);
  }
  async applyConfig(raw){
    const token=this.loadId=(this.loadId??0)+1;
    const c=validateConfig(raw);const texture=await this.loadTexture(c.texture);
    if(c.effects.seaLevel.enabled||c.effects.surface==='atlas'||c.effects.profile.enabled||c.effects.waves>0){
      await this.elevation.load();const [global,regional]=this.elevation.grids,u=this.material.uniforms;
      u.uDemGlobal.value=global.texture;u.uDemRegional.value=regional.texture;u.uDemSize.value.set(global.meta.width,global.meta.height);u.uRegionalSize.value.set(regional.meta.width,regional.meta.height);
    }
    const results=await Promise.allSettled(c.objects.map(async o=>{
      if(o.type==='satellite')return makeSatellite();if(o.type==='ship')return makeShip();
      if(['sprite','bird'].includes(o.type)){
        const frames=await Promise.all(o.frames.map(file=>this.loadTexture(file)));
        const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:frames[0],transparent:true,depthWrite:false}));
        if(o.aspect!==undefined)sprite.scale.set(o.aspect,1,1);
        const holder=new THREE.Group();holder.add(sprite);holder.userData.sprite=sprite;holder.userData.frames=frames;return holder;
      }
      const gltf=await new GLTFLoader().loadAsync(localAsset(o.asset));
      const box=new THREE.Box3().setFromObject(gltf.scene),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
      gltf.scene.position.sub(center);const wrapper=new THREE.Group();wrapper.add(gltf.scene);wrapper.scale.setScalar(1/Math.max(size.x,size.y,size.z,1e-5));
      const outer=new THREE.Group();outer.add(wrapper);outer.userData.mixer=new THREE.AnimationMixer(gltf.scene);
      const textures=new Set();gltf.scene.traverse(node=>{for(const m of Array.isArray(node.material)?node.material:node.material?[node.material]:[])for(const value of Object.values(m))if(value?.isTexture)textures.add(value);});outer.userData.ownedTextures=[...textures];
      if(gltf.animations.length){const clip=o.animationClip===undefined?gltf.animations[0]:typeof o.animationClip==='number'?gltf.animations[o.animationClip]:gltf.animations.find(clip=>clip.name===o.animationClip);if(!clip){disposeGroup(outer);throw new Error(`Clip GLB tidak ditemukan: ${o.animationClip}`);}outer.userData.mixer.clipAction(clip).play();}
      else if(o.animationClip!==undefined){disposeGroup(outer);throw new Error('GLB ini tidak memiliki clip animasi.');}
      return outer;
    }));
    const loaded=results.filter(result=>result.status==='fulfilled').map(result=>result.value),failure=results.find(result=>result.status==='rejected');
    if(token!==this.loadId||failure){for(const m of loaded)disposeGroup(m);if(token!==this.loadId)return null;throw failure.reason;}
    this.config=c;this.material.uniforms.uMap.value=texture;
    const s=c.style,u=this.material.uniforms;u.uExposure.value=s.exposure;u.uSaturation.value=s.saturation;u.uOceanMix.value=s.oceanMix;u.uFill.value=s.fill;u.uOcean.value.set(s.ocean);u.uAir.value.set(s.atmosphere);
    this.air.children.forEach(shell=>{shell.material.uniforms.uColor.value.set(s.atmosphere);shell.material.uniforms.uStrength.value=.9*s.halo;});
    disposeGroup(this.routeGroup);disposeGroup(this.objects);this.routeItems=[];this.objectItems=[];
    for(const r of c.routes){
      const curve=new RouteCurve(r);
      const meshes=[];
      const lineWidth=r.width??.0022;
      for(const [radius,opacity] of [[lineWidth*3.18,.13],[lineWidth,1]]){
        const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,160,radius,6,false),new THREE.MeshBasicMaterial({color:r.color,transparent:true,opacity,depthWrite:false}));
        this.routeGroup.add(mesh);meshes.push(mesh);
      }
      this.routeItems.push({r,meshes,curve});
    }
    c.objects.forEach((o,i)=>{const m=loaded[i],size=new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());const extent=Math.max(size.x,size.y,size.z,1e-6);m.scale.setScalar(o.scale);this.objects.add(m);this.objectItems.push({o,m,extent});});
    this.setTime(Math.min(this.time,c.duration));return this.getConfig();
  }
  getConfig(){return structuredClone(this.config);}
  resize(w,h){this.canvas.width=w;this.canvas.height=h;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.render();}
  setTime(seconds){this.time=Math.min(this.config?.duration??0,Math.max(0,seconds));this.render();return this.time;}
  async prepareFrame(seconds){this.setTime(seconds);await this.detailLayer.waitForReady(this.config.detail.failureMode);this.render();return this.time;}
  poseAt(object,time=this.time){return objectPose(object,this.config.routes,this.routeItems.map(item=>item.curve),time);}
  getCamera(){const cam=cameraAt(this.config,this.time);if(this.config.camera.follow&&this.camera.position.length()>1)return {...cam,...coordinates(this.camera.position),altitudeKm:(this.camera.position.length()-1)*EARTH_KM,pitch:0};return cam;}
  render(){
    const c=this.config;if(!c)return;const {width:w,height:h}=this.canvas;if(!w||!h)return;
    const cam=cameraAt(c,this.time),aspect=w/h;
    const fit=Math.sqrt(1+1/(Math.tan(21*D)*Math.min(aspect,1)*.94)**2);
    let radius=cam.altitudeKm!==undefined?1+cam.altitudeKm/EARTH_KM:Math.max(1.12,fit/cam.zoom);
    this.camera.position.copy(geo(cam.lat,cam.lon,radius));
    this.camera.up.set(0,1,0);
    if(cam.altitudeKm!==undefined&&(cam.pitch??0)>0){const n=geo(cam.lat,cam.lon),north=geo(cam.lat+.01,cam.lon).sub(n).normalize();this.camera.position.addScaledVector(north,-(radius-1)*Math.tan(cam.pitch*D));this.camera.lookAt(n);}else this.camera.lookAt(0,0,0);
    let nearDistance=radius-1;
    if(c.camera.follow){
      const f=followAt(c.camera.follow,this.time),o=reference(c.objects,f.object),pose=this.poseAt(o),ahead=this.poseAt(o,this.time+f.lookAheadSeconds);
      const distance=f.distanceKm/EARTH_KM;
      this.camera.position.copy(pose.position).addScaledVector(pose.normal,distance*Math.cos(f.pitch*D)).addScaledVector(pose.tangent,-distance*Math.sin(f.pitch*D));
      const north=new THREE.Vector3(0,1,0).projectOnPlane(pose.normal);if(north.lengthSq()<1e-8)north.set(1,0,0).projectOnPlane(pose.normal);north.normalize();
      this.camera.up.copy(f.heading==='route'?pose.tangent:north);this.camera.lookAt(ahead.position);
      nearDistance=Math.min(distance,this.camera.position.length()-1);radius=this.camera.position.length();
    }
    this.camera.near=Math.max(.00000001,Math.min(.01,nearDistance*.02));this.camera.updateProjectionMatrix();this.camera.rotateZ(cam.roll*D);this.camera.updateMatrixWorld();
    const ground=coordinates(this.camera.position);
    this.detailLayer.update(c.detail.enabled&&!c.effects.profile.enabled,{...ground,altitudeKm:(radius-1)*EARTH_KM,pitch:cam.pitch??0},w,h,c.detail.maxLevel,this.camera);
    const u=this.material.uniforms;
    u.uElevationEnabled.value=(c.effects.seaLevel.enabled||c.effects.surface==='atlas'||c.effects.waves>0)&&this.elevation.grids.length?1:0;
    u.uSeaEnabled.value=c.effects.seaLevel.enabled?1:0;u.uSeaLevel.value=seaLevelAt(c,this.time);u.uSurface.value=c.effects.surface==='atlas'?1:0;u.uWaves.value=c.effects.waves;u.uTime.value=this.time;
    if(c.effects.profile.enabled){drawProfile(this.ctx,w,h,c,this.elevation,this.time);this.canvas.dataset.frame=String(Math.round(this.time*c.fps));this.canvas.dataset.ready='true';return;}
    for(const shell of this.air.children)shell.material.uniforms.uCam.value.copy(this.camera.position);
    this.key.position.copy(this.camera.position).add(new THREE.Vector3(-2,3,1));
    for(const [i,{meshes}] of this.routeItems.entries()){const r=c.routes[i],p=THREE.MathUtils.clamp((this.time-r.start)/(r.end-r.start),0,1);for(const m of meshes){m.visible=r.visible!==false;m.geometry.setDrawRange(0,Math.floor(160*p)*6*6);}}
    for(const [i,{m,extent}] of this.objectItems.entries()){
      const o=c.objects[i];
      const pose=this.poseAt(o);m.position.copy(pose.position);
      if(o.followRoute?.orient!==false&&o.followRoute)orientTraveller(m,pose,o.rotation);
      else {m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),pose.normal);if(o.rotation)m.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...o.rotation.map(v=>v*D))));}
      let scale=o.scale;
      if(o.screenSize!==undefined){const depth=-pose.position.clone().applyMatrix4(this.camera.matrixWorldInverse).z;scale=Math.max(0,2*depth*Math.tan(21*D)*o.screenSize/extent);}
      m.scale.setScalar(scale);
      m.userData.mixer?.setTime((this.time+(o.animationOffset??0))*(o.animationSpeed??1));
      if(m.userData.sprite){
        const {sprite,frames}=m.userData,index=Math.floor((this.time+(o.animationOffset??0))*(o.frameRate??4)*(o.animationSpeed??1))%frames.length;
        sprite.material.map=frames[index];const image=frames[index].image;if(o.aspect!==undefined)sprite.scale.set(o.aspect,1,1);else sprite.scale.set(image.width/Math.max(image.width,image.height),image.height/Math.max(image.width,image.height),1);
        const p=pose.position.clone().project(this.camera),q=pose.position.clone().addScaledVector(pose.tangent,.001).project(this.camera);
        // Sprite artwork faces right at zero degrees; rotate its screen tangent, not its billboard quaternion.
        sprite.material.rotation=Math.atan2((q.y-p.y)*h,(q.x-p.x)*w)+(o.rotation?.[2]??0)*D;
      }
    }
    this.renderer.setClearColor(c.background,c.transparent?0:1);this.renderer.render(this.scene,this.camera);
    const ctx=this.ctx;ctx.clearRect(0,0,w,h);ctx.drawImage(this.renderer.domElement,0,0);
    const unit=Math.min(w,h)/1080;
    for(const l of c.labels){
      const p=geo(l.lat,l.lon,1+Math.min(.006,Math.max(.0000001,(radius-1)*.01))),toward=this.camera.position.clone().sub(p).normalize();if(p.clone().normalize().dot(toward)<.12)continue;
      const screen=p.clone().project(this.camera);if(screen.z>1||Math.abs(screen.x)>1.1||Math.abs(screen.y)>1.1)continue;
      const x=(screen.x*.5+.5)*w,y=(-screen.y*.5+.5)*h;
      ctx.save();ctx.fillStyle='#74d4ff';ctx.shadowColor='#65bbff';ctx.shadowBlur=12*unit;ctx.beginPath();ctx.arc(x,y,4*unit,0,Math.PI*2);ctx.fill();
      ctx.font=`800 ${Math.max(13,22*unit)}px Arial, sans-serif`;ctx.textAlign='left';ctx.textBaseline='middle';ctx.lineWidth=5*unit;ctx.strokeStyle='rgba(0,0,0,.65)';ctx.shadowBlur=0;ctx.strokeText(l.text,x+13*unit,y);ctx.fillStyle=l.color;ctx.fillText(l.text,x+13*unit,y);ctx.restore();
    }
    if(c.title)this.drawText(c.title,w*.5,h*.12,46*unit,'#fff6df',w*.88);
    if(c.subtitle)this.drawText(c.subtitle,w*.5,h*.83,48*unit,'#ffffff',w*.9);
    if(c.effects.seaLevel.enabled){this.ctx.save();this.ctx.font=`600 ${22*unit}px Arial,sans-serif`;this.ctx.textAlign='left';this.ctx.fillStyle='#c0e6ff';this.ctx.fillText(`MUKA LAUT ${u.uSeaLevel.value>0?'+':''}${Math.round(u.uSeaLevel.value)} m`,w*.055,h*.085);this.ctx.font=`${14*unit}px Arial,sans-serif`;this.ctx.fillStyle='#97acc6';this.ctx.fillText('Ilustrasi elevasi · NOAA ETOPO1',w*.055,h*.085+28*unit);this.ctx.restore();}
    if(this.detailLayer.visible){this.ctx.save();this.ctx.fillStyle='rgba(3,8,14,.7)';this.ctx.fillRect(0,h-35*unit,w,35*unit);this.ctx.font=`${Math.max(9,12*unit)}px Arial,sans-serif`;this.ctx.fillStyle='#d6dfeb';this.ctx.textAlign='center';this.ctx.fillText('Imagery © Esri, Vantor, Earthstar Geographics, GIS User Community',w*.5,h-13*unit);this.ctx.restore();}
    // Ready flag is only set after WebGL and the 2D overlay have finished.
    this.canvas.dataset.frame=String(Math.round(this.time*c.fps));
    this.canvas.dataset.ready='true';
    this.canvas.dataset.detailStatus=this.detailLayer.status;
  }
  drawText(text,x,y,size,color,maxWidth){
    const ctx=this.ctx;ctx.save();ctx.font=`900 ${size}px Arial, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
    const lines=[];let line='';for(const word of text.split(/\s+/)){const next=line?line+' '+word:word;if(ctx.measureText(next).width>maxWidth&&line){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);
    lines.forEach((s,i)=>{const py=y+(i-(lines.length-1)/2)*size*1.15;ctx.lineWidth=size*.16;ctx.strokeStyle='#05070c';ctx.strokeText(s,x,py);ctx.fillStyle=color;ctx.fillText(s,x,py);});ctx.restore();
  }
  exportPNG(){this.render();return this.canvas.toDataURL('image/png');}
}
