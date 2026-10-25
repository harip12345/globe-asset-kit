import * as THREE from 'three';
const material=(color,metalness=0.2)=>new THREE.MeshStandardMaterial({color,metalness,roughness:0.48});
function box(group,size,pos,mat){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);m.position.set(...pos);group.add(m);return m;}
export function makeSatellite(){
  const g=new THREE.Group(),gold=material('#b79a52',0.65),blue=material('#163b72',0.45),metal=material('#bbc5cc',0.7),dark=material('#222e42');
  box(g,[0.6,0.7,0.65],[0,0,0],gold);
  box(g,[3.8,0.045,0.06],[0,0,0],metal);
  for(const side of [-1,1]){
    box(g,[1.25,0.05,1.05],[side*1.2,0,0],blue);
    for(let j=-2;j<=2;j++)box(g,[0.012,0.01,1.05],[side*1.2+j*.22,.031,0],metal);
    for(let j=-1;j<=1;j++)box(g,[1.25,0.01,0.012],[side*1.2,.032,j*.32],metal);
  }
  const dish=new THREE.Mesh(new THREE.SphereGeometry(.34,24,12,0,Math.PI*2,0,Math.PI*.36),metal);dish.position.y=.36;g.add(dish);
  box(g,[.04,.5,.04],[0,.7,0],dark);
  return g;
}
export function makeShip(){
  const g=new THREE.Group(),hull=material('#303f4d'),deck=material('#d8d8cb');
  box(g,[.85,.25,2.8],[0,.18,0],hull);box(g,[.75,.06,2.6],[0,.34,0],deck);
  const bow=new THREE.Mesh(new THREE.ConeGeometry(.43,.65,3),hull);bow.rotation.x=Math.PI/2;bow.position.set(0,.18,-1.62);g.add(bow);
  box(g,[.7,.55,.4],[0,.6,1],deck);box(g,[.52,.16,.18],[0,.9,1],material('#7f9da4'));
  const mats=['#d56644','#315d7f','#bca05f','#4a735d'].map(x=>material(x));
  for(let i=0;i<5;i++)for(let j=0;j<2;j++)box(g,[.3,.26,.34],[j*.34-.17,.5,.55-i*.39],mats[(i+j)%4]);
  return g;
}
