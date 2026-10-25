// Optional standalone server. The original npm start also serves this folder at /v2/.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.md':'text/plain; charset=utf-8'};
const port=Number(process.env.PORT||4174);
const server=http.createServer(async(req,res)=>{
  try{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
    const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '')||'index.html';
    const file=path.resolve(root,rel);
    if(!file.startsWith(root)||rel.split(/[\\/]/).some(p=>p.startsWith('.'))||rel.startsWith('source/')){res.writeHead(403).end();return;}
    const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404).end('File not found');}
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`Port ${port} sudah digunakan. Buka http://127.0.0.1:${port} atau pilih PORT lain.`:e.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Globe Lite: http://127.0.0.1:${port}\nTidak memerlukan npm install. Tekan Ctrl+C untuk berhenti.`));
