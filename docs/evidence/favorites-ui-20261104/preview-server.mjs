import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
http.createServer(async (request, response) => {
  let pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/') pathname = '/docs/evidence/favorites-ui-20261104/preview.html';
  if (pathname === '/domain.mjs') pathname = '/lib/domain.mjs';
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  try { const content = await readFile(file); response.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(content); }
  catch { response.writeHead(404).end(); }
}).listen(4194, '127.0.0.1', () => console.log('http://127.0.0.1:4194/'));
