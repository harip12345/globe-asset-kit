import {spawn} from 'node:child_process';
import {stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {root} from './serve.mjs';
// Explicit list keeps original reference footage, .git, and this ZIP out of delivery.
const files=['index.html','start.cmd','package.json','package-lock.json','AGENTS.md','.gitignore','src','scenes','assets','docs','after-effects','scripts','node_modules/three',
 'exports/globe-pasifik.png','exports/globe-pasifik.png.render.json','exports/globe-transparan.png','exports/globe-transparan.png.render.json','exports/globe-bersih-transparan.png','exports/globe-bersih-transparan.png.render.json','exports/satelit-orbit.png','exports/satelit-orbit.png.render.json','exports/demo-rute-pasifik.mp4','exports/demo-rute-pasifik.mp4.render.json','exports/demo-contact-sheet.jpg'];
const dest=path.join(root,'atlas-globe-kit.zip');
const proc=spawn('tar.exe',['-a','-c','-f',dest,...files],{cwd:root,windowsHide:true,stdio:'inherit'});
await new Promise((resolve,reject)=>{proc.on('close',c=>c===0?resolve():reject(new Error(`Archive failed: ${c}`)));proc.on('error',reject);});
console.log(`ZIP: ${dest} (${((await stat(dest)).size/1024/1024).toFixed(1)} MB)`);
