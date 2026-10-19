// Synthetic local A/B fixture. No credentials or Notion requests.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, mkdtemp, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildPages } from '../../../scripts/build-pages.mjs';
const root = await mkdtemp(path.join(tmpdir(), 't27-native-'));
const eventsFile = new URL('./browser-events.jsonl', import.meta.url);
await writeFile(eventsFile, '');
let release = 'A';
for (const version of ['A', 'B']) {
  const out = path.join(root, version);
  await buildPages({ outputDir: out });
  const html = `<!doctype html><meta charset="utf-8"><title>T27 build ${version}</title>
    <h1>Running build ${version}</h1><p id="status">Starting</p><fieldset id="edit">
    <label>Draft <input id="draft"></label><button id="clear">Clear draft</button>
    <button id="update">Publish B and check</button><button id="inspect">Inspect safety</button></fieldset>
    <pre id="result"></pre><script type="module" src="./app.mjs"></script>`;
  const app = `import { createAppLifecycle } from './platform/app-lifecycle.mjs';
import { createSubmissionState } from './state/submission-state.mjs';
const build = '${version}';
const state = { dirty: false, pending: false };
let frozen = false;
const status = document.querySelector('#status');
const report = (event, extra = {}) => { navigator.sendBeacon('/__fixture__/event', JSON.stringify({build,event,frozen,dirty:state.dirty,...extra})); };
function render(){ status.textContent = 'Build '+build+'; dirty='+state.dirty+'; frozen='+frozen+'; controlled='+Boolean(navigator.serviceWorker.controller); }
const registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
const lifecycle = createAppLifecycle({ getState: () => state, submissionState: createSubmissionState(), serviceWorker: navigator.serviceWorker,
  setFrozen(value, details) { frozen=value; document.querySelector('#edit').disabled=value; render(); report('freeze', {value,generation:details.generation}); return true; },
  navigate(details) { report('safe-navigation', details); location.replace(location.href); return true; }
});
await lifecycle.start(); render(); report('loaded');
navigator.serviceWorker.addEventListener('controllerchange', () => { render(); report('controllerchange'); });
document.querySelector('#draft').addEventListener('input', event => { state.dirty=Boolean(event.target.value); render(); lifecycle.notifyStateChange(); report('draft'); });
document.querySelector('#clear').onclick = () => { document.querySelector('#draft').value='';state.dirty=false;render();lifecycle.notifyStateChange();report('clear'); };
document.querySelector('#update').onclick = async () => { await fetch('/__fixture__/B', {method:'POST'}); await registration.update(); render(); report('checked-B'); };
document.querySelector('#inspect').onclick = async () => { const locks=await navigator.locks.query(); document.querySelector('#result').textContent=JSON.stringify({build,dirty:state.dirty,frozen,locks},null,2); };
`;
  await writeFile(path.join(out, 'index.html'), html);
  await writeFile(path.join(out, 'app.mjs'), app);
  let sw = await readFile(path.join(out, 'sw.js'), 'utf8');
  sw = sw.replace(/const BUILD_VERSION = '[a-f0-9]+';/, `const BUILD_VERSION = '${version}';`);
  await writeFile(path.join(out, 'sw.js'), sw);
}
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/__fixture__/B'){ release='B';res.end('B');return; }
    if(url.pathname==='/__fixture__/event'){
      let body='';for await(const chunk of req)body+=chunk;
      await appendFile(eventsFile,body+'\n');res.end('ok');return;
    }
    if(!url.pathname.startsWith('/bean-pocket/')){res.writeHead(404);res.end();return;}
    const relative=url.pathname.slice('/bean-pocket/'.length)||'index.html';
    const file=path.join(root,release,relative);
    const data=await readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  }catch(error){res.writeHead(404);res.end('missing');}
});
server.listen(4197,'127.0.0.1',()=>console.log('T27 native A/B fixture: http://127.0.0.1:4197/bean-pocket/'));
