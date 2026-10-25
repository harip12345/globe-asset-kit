import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export const root = fileURLToPath(new URL('../', import.meta.url));
const mime = {'.html':'text/html; charset=utf-8','.md':'text/plain; charset=utf-8','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.bin':'application/octet-stream','.mp4':'video/mp4','.woff2':'font/woff2'};
export function createServer() {
  return http.createServer(async (req,res) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') {res.writeHead(405).end(); return;}
      const url = new URL(req.url,'http://localhost');
      const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
      const file = path.resolve(root,rel);
      if (!file.startsWith(root) || rel.split(/[\\/]/).some(p=>p.startsWith('.')) ||
          (rel.startsWith('node_modules/') && !rel.startsWith('node_modules/three/'))) {res.writeHead(403).end();return;}
      if (!(await stat(file)).isFile()) throw new Error('not file');
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
      res.end(req.method === 'HEAD' ? undefined : await readFile(file));
    } catch {res.writeHead(404).end('File not found');}
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  createServer().listen(port,'127.0.0.1',()=>console.log(`Globe Kit: http://127.0.0.1:${port}\nKeep this window open. Press Ctrl+C to stop.`));
}
