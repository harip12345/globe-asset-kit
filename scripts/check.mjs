import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer,root} from './serve.mjs';
import {validateConfig,cameraAt} from '../src/config.js';
import {geo} from '../src/globe.js';
import path from 'node:path';
globalThis.location=new URL('http://127.0.0.1:4173/');
const scenes={};
for(const name of ['pasifik','indonesia','rute','orbit']){
  scenes[name]=validateConfig(JSON.parse(await readFile(path.join(root,'scenes',name+'.json'),'utf8')));
}
assert.ok(geo(0,0).distanceTo({x:1,y:0,z:0})<1e-9,'Greenwich must align with texture center');
assert.ok(Math.abs(geo(0,90).z+1)<1e-9,'East longitude must follow the texture convention');
const c=structuredClone(scenes.pasifik);
c.camera.keyframes=[{time:0,lat:0,lon:179,zoom:1},{time:10,lat:0,lon:-179,zoom:2}];
assert.equal(cameraAt(c,0).lon,179);assert.equal(cameraAt(c,10).lon,181);assert.equal(cameraAt(c,5).lon,180);
assert.deepEqual(cameraAt(c,4),cameraAt(c,4),'Frame time must be deterministic');
assert.equal(cameraAt(c,5).zoom,1.5);
assert.throws(()=>validateConfig({...c,texture:'https://other.example/earth.jpg'}),/folder assets/);
assert.throws(()=>validateConfig({...c,width:Infinity}),/angka/);
assert.throws(()=>validateConfig({...c,labels:[{text:'BAD',lat:91,lon:0,color:'#ffffff'}]}),/Latitude/);
const bad=structuredClone(c);bad.camera.keyframes.reverse();assert.throws(()=>validateConfig(bad),/meningkat/);
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{
  const base=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base+'/.git/config')).status,403);
  assert.equal((await fetch(base+'/node_modules/other/private.js')).status,403);
  assert.equal((await fetch(base+'/node_modules/three/build/three.module.js')).status,200);
  assert.equal((await fetch(base+'/assets/textures/earth-nasa-5400.jpg')).headers.get('content-type'),'image/jpeg');
  assert.equal((await fetch(base+'/scenes/pasifik.json')).status,200);
}finally{await new Promise(r=>server.close(r));}
console.log('PASS — four scene presets, geographic alignment, dateline camera motion, deterministic time, validation, and local asset serving.');
