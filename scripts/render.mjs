// Render is frame-driven: no screen recording and no dependency on playback speed.
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createServer,root} from './serve.mjs';
const args=process.argv.slice(2),option=(key,fallback)=>{const i=args.indexOf('--'+key);return i<0?fallback:args[i+1];};
const scene=option('scene','pasifik'),format=option('format','png'),out=path.resolve(root,option('out',`exports/${scene}.${format==='frames'?'frames':format}`));
if(!['png','mp4','frames'].includes(format))throw new Error('Format: png, mp4, frames.');
let playwright;
try{playwright=await import('playwright');}catch{
  const bundled=path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const custom=process.env.GLOBE_PLAYWRIGHT_PATH;
  if(!existsSync(custom||bundled))throw new Error('Install render dependency: npm install --save-dev playwright; npx playwright install chromium');
  playwright=createRequire(import.meta.url)(custom||bundled);
}
const sceneFile=scene.endsWith('.json')?path.resolve(root,scene):path.join(root,'scenes',scene+'.json');
const c=JSON.parse(await readFile(sceneFile,'utf8'));
const width=Number(option('width',c.width)),height=Number(option('height',c.height)),fps=Number(option('fps',c.fps)),seconds=Number(option('seconds',c.duration));
for(const [n,v,min,max] of [['width',width,64,4096],['height',height,64,4096],['fps',fps,1,60],['seconds',seconds,.01,120]])if(!Number.isFinite(v)||v<min||v>max)throw new Error(`Invalid ${n}`);
if(!Number.isInteger(width)||!Number.isInteger(height))throw new Error('Dimensions must be integers.');
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port;let browser;
const faults=[];
try{
  let executablePath=process.env.GLOBE_CHROMIUM_PATH;
  if(!executablePath&&!existsSync(playwright.chromium.executablePath())){
    const cache=path.join(homedir(),'AppData/Local/ms-playwright');
    const versions=(await readdir(cache).catch(()=>[])).filter(x=>/^chromium-\d+$/.test(x)).sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1]));
    for(const version of versions){const p=path.join(cache,version,'chrome-win64/chrome.exe');if(existsSync(p)){executablePath=p;break;}}
  }
  browser=await playwright.chromium.launch({headless:true,executablePath,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  page.on('pageerror',e=>faults.push(e.message));page.on('console',m=>{if(m.type()==='error')faults.push(m.text());});
  await page.goto(`http://127.0.0.1:${port}/?render=1&width=${width}&height=${height}`);
  await page.waitForFunction(()=>window.__GLOBE_READY__===true,null,{timeout:60000});
  c.width=width;c.height=height;c.fps=fps;if(args.includes('--transparent'))c.transparent=true;
  if(args.includes('--clean')){c.labels=[];c.title='';c.subtitle='';}
  if(format==='mp4'&&c.transparent)throw new Error('MP4/H.264 has no alpha channel. Use PNG or frames for transparency.');
  if(format==='mp4'&&(width%2||height%2))throw new Error('MP4 width and height must be even.');
  await page.evaluate(async config=>{await window.globeKit.applyConfig(config);window.globeKit.resize(config.width,config.height);},c);
  async function frame(t){return await page.evaluate(async time=>{await window.globeKit.prepareFrame(time);return window.globeKit.exportPNG().split(',')[1];},t);}
  await mkdir(path.dirname(out),{recursive:true});
  if(format==='png'){
    const time=Number(option('time','0'));if(!Number.isFinite(time)||time<0)throw new Error('Invalid --time');
    await writeFile(out,Buffer.from(await frame(time),'base64'));console.log(`PNG: ${out}`);
  }else if(format==='frames'){
    await mkdir(out,{recursive:true});const total=Math.ceil(seconds*fps);
    for(let i=0;i<total;i++){await writeFile(path.join(out,`frame-${String(i).padStart(5,'0')}.png`),Buffer.from(await frame(i/fps),'base64'));if(i%fps===0)console.log(`${i}/${total} frames`);}
    console.log(`PNG sequence: ${out}`);
  }else{
    const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
    const enc=spawn(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate',String(fps),'-i','pipe:0','-an','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart',out],{windowsHide:true});
    let log='',pipeError;enc.stderr.on('data',d=>log+=d);enc.stdin.on('error',e=>pipeError=e);
    const closed=new Promise((resolve,reject)=>{enc.on('close',code=>code===0?resolve():reject(new Error(`FFmpeg: ${log||pipeError?.message||code}`)));enc.on('error',reject);});
    // Attach rejection handler immediately while frames are generated.
    closed.catch(()=>{});const total=Math.ceil(seconds*fps);
    for(let i=0;i<total;i++){
      if(pipeError)throw pipeError;
      const data=Buffer.from(await frame(i/fps),'base64');
      if(!enc.stdin.write(data))await new Promise((resolve,reject)=>{const done=()=>{enc.stdin.off('error',bad);resolve();};const bad=e=>{enc.stdin.off('drain',done);reject(e);};enc.stdin.once('drain',done);enc.stdin.once('error',bad);});
      if(i%fps===0)console.log(`${i}/${total} frames`);
    }
    enc.stdin.end();await closed;console.log(`MP4: ${out}`);
  }
  if(faults.length)throw new Error(`Browser errors: ${faults.join('\n')}`);
  await writeFile(out+'.render.json',JSON.stringify({scene:path.relative(root,sceneFile),width,height,fps,duration:format==='png'?null:seconds,transparent:c.transparent,time:format==='png'?Number(option('time','0')):null,config:c},null,2));
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
