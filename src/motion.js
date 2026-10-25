import * as THREE from 'three';
const D=Math.PI/180;
export const geo=(lat,lon,r=1)=>new THREE.Vector3(Math.cos(lat*D)*Math.cos(lon*D)*r,Math.sin(lat*D)*r,-Math.cos(lat*D)*Math.sin(lon*D)*r);
export const coordinates=p=>({lat:Math.asin(THREE.MathUtils.clamp(p.clone().normalize().y,-1,1))/D,lon:Math.atan2(-p.z,p.x)/D});
export const reference=(items,ref)=>typeof ref==='number'?items[ref]:items.find(item=>item.id===ref);
export const smooth=t=>t*t*t*(t*(t*6-15)+10);

// Both the tube and its traveller sample this exact great-circle curve.
export class RouteCurve extends THREE.Curve {
  constructor(route){
    super();this.route=route;this.a=geo(...route.from);const b=geo(...route.to);
    this.axis=new THREE.Vector3().crossVectors(this.a,b);
    this.angle=Math.atan2(this.axis.length(),THREE.MathUtils.clamp(this.a.dot(b),-1,1));
    if(this.axis.lengthSq()<1e-24){this.axis.crossVectors(this.a,new THREE.Vector3(0,1,0));if(this.axis.lengthSq()<1e-6)this.axis.crossVectors(this.a,new THREE.Vector3(1,0,0));}
    this.axis.normalize();
  }
  getPoint(t,target=new THREE.Vector3()){
    return target.copy(this.a).applyAxisAngle(this.axis,this.angle*THREE.MathUtils.clamp(t,0,1)).multiplyScalar(1+this.route.altitude);
  }
  getTangent(t,target=new THREE.Vector3()){
    return target.crossVectors(this.axis,this.getPoint(t).normalize()).normalize();
  }
}

export function objectPose(object,routes,curves,time){
  const f=object.followRoute;
  if(f){
    const route=reference(routes,f.route),index=routes.indexOf(route),curve=curves[index];
    const start=f.start??route.start,end=f.end??route.end;
    let progress=THREE.MathUtils.clamp((time-start)/(end-start),0,1);
    if(f.easing==='smooth')progress=smooth(progress);
    progress=(f.from??0)+((f.to??1)-(f.from??0))*progress;
    const position=curve.getPoint(progress),normal=position.clone().normalize();
    position.addScaledVector(normal,f.altitudeOffset??0);
    const tangent=curve.getTangent(progress).multiplyScalar((f.to??1)>=(f.from??0)?1:-1);
    return {position,normal,tangent,...coordinates(position),progress};
  }
  const lon=object.lon+(object.orbitSpeed??0)*time,lat=object.lat+Math.sin((lon-object.lon)*D)*(object.inclination??0);
  const normal=geo(lat,lon),nextLon=lon+((object.orbitSpeed??0)<0?-.001:.001);
  const nextLat=object.lat+Math.sin((nextLon-object.lon)*D)*(object.inclination??0);
  const tangent=geo(nextLat,nextLon).sub(normal).projectOnPlane(normal).normalize();
  return {position:normal.clone().multiplyScalar(1+object.altitude),normal,tangent,lat,lon};
}

export function followAt(follow,time){
  const keys=follow.keyframes??[];
  if(!keys.length)return follow;
  if(time<=keys[0].time)return {...follow,...keys[0]};
  for(let i=1;i<keys.length;i++)if(time<=keys[i].time){
    const a=keys[i-1],b=keys[i],t=smooth((time-a.time)/(b.time-a.time));
    return {...follow,distanceKm:Math.exp(Math.log(a.distanceKm)+(Math.log(b.distanceKm)-Math.log(a.distanceKm))*t),pitch:(a.pitch??follow.pitch??0)+((b.pitch??follow.pitch??0)-(a.pitch??follow.pitch??0))*t};
  }
  return {...follow,...keys.at(-1)};
}

// Local +Y is outward and local -Z is forward; rotation corrects model authoring axes.
export function orientTraveller(mesh,pose,rotation=[0,0,0]){
  const side=new THREE.Vector3().crossVectors(pose.tangent,pose.normal).normalize();
  const forward=new THREE.Vector3().crossVectors(pose.normal,side).normalize();
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side,pose.normal,forward.negate()));
  mesh.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation.map(v=>v*D))));
}
