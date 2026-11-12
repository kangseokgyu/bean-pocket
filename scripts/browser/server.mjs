import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const modulePath = fileURLToPath(import.meta.url);
const types = { '.html':'text/html', '.mjs':'text/javascript', '.css':'text/css', '.png':'image/png', '.webmanifest':'application/manifest+json' };

export function createBrowserServer(roots) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname === '/harness.mjs') {
        res.writeHead(200, { 'content-type':'text/javascript', 'cache-control':'no-store' })
          .end(await readFile(new URL('./harness.mjs', import.meta.url)));
        return;
      }
      const [, kind, ...segments] = url.pathname.split('/');
      const root = roots[kind] ? path.resolve(roots[kind]) : null;
      if (!root) { res.writeHead(404).end(); return; }
      const relative = segments.join('/');
      const file = path.resolve(root, relative);
      if (!file.startsWith(root + path.sep) || !(/^(pwa|lib|test\/fixtures)\//.test(relative))) {
        res.writeHead(403).end();
        return;
      }
      let body = await readFile(file);
      if (relative === 'pwa/index.html') {
        body = body.toString().replace('src="./app.mjs"', 'src="/harness.mjs?base=/' + kind + '"');
      }
      res.writeHead(200, { 'content-type':types[path.extname(file)] ?? 'application/octet-stream', 'cache-control':'no-store' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  const cwd = process.cwd();
  const roots = {
    baseline: path.resolve(process.argv[2] ?? cwd),
    candidate: path.resolve(process.argv[3] ?? cwd),
    regression: path.resolve(process.argv[4] ?? cwd),
  };
  const port = Number(process.env.BEAN_BROWSER_PORT ?? 4216);
  const server = createBrowserServer(roots);
  server.listen(port, '127.0.0.1', () => console.log('browser harness http://127.0.0.1:' + port));
}
