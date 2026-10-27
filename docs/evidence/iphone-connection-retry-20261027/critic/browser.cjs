const { chromium } = require('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const http = require('node:http'), fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const root = process.cwd(), evidence = __dirname;
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/pwa/styles.css"><link rel="icon" href="data:,"><main id="app-root"></main><script type="module">
import {createAppView} from '/pwa/ui/view.mjs';
import {createAppController} from '/pwa/ui/controller.mjs';
import {NotionClient} from '/pwa/data/notion-client.mjs';
import {createReadRepository} from '/pwa/data/read-repository.mjs';
import {createCommands} from '/pwa/commands/index.mjs';
import {createSubmissionState} from '/pwa/state/submission-state.mjs';
import {createConnectionFile} from '/pwa/platform/connection-file.mjs';
import {fakePwaNotion,testConnection} from '/test/fixtures/pwa-environment.mjs';
try {
const scenario = new URL(location.href).searchParams.get('scenario') || 'saved';
const directory=await (await navigator.storage.getDirectory()).getDirectoryHandle('bean-pocket-private-v1',{create:true});
const put=async(name,value)=>{const w=await (await directory.getFileHandle(name,{create:true})).createWritable();await w.write(value);await w.close()};
if(!sessionStorage.getItem('seeded')) {
 if(scenario!=='absent') {
  await put('connection.json',JSON.stringify(testConnection()));
  const journal={schemaVersion:1,activeConnectionRevision:testConnection().revision,connectionGuard:null,operations:[]};
  if(scenario==='guard') journal.connectionGuard={phase:'unknown',candidateRevision:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',targetFingerprint:'a'.repeat(64)};
  if(scenario==='mismatch') journal.activeConnectionRevision='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  if(['unknown','partial'].includes(scenario)) journal.operations.push({key:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',kind:'beans',connectionRevision:testConnection().revision,targetFingerprint:'a'.repeat(64),payloadFingerprint:'b'.repeat(64),status:scenario,createdPages:[],updatedAt:'2026-10-27T00:00:00.000Z'});
  await put('submission-journal.json',JSON.stringify(journal));
 }
 sessionStorage.setItem('seeded','true');
}
let storageBroken=scenario==='storage';
const storage={getDirectory:async()=>{if(storageBroken)throw new DOMException('PRIVATE-RAW-ERROR','NotAllowedError');return navigator.storage.getDirectory()}};
const file=createConnectionFile({storage}),fake=fakePwaNotion();let failure=scenario==='temporary'?503:/^http/.test(scenario)?Number(scenario.slice(4)):0;
fake.intercept=()=>failure?Response.json({message:'PRIVATE-RAW-ERROR test-only-credential'},{status:failure}):null;
const view=createAppView(document), app=createAppController({view,state:createSubmissionState({storage}),file,makeClient:c=>new NotionClient(c.token,{dataSources:c.dataSources,connectionRevision:c.revision,fetchImpl:fake.fetch}),makeRepository:createReadRepository,makeCommands:createCommands});
window.fixture={view,app,fake,restore(){failure=0;storageBroken=false},async snapshot(){const data={};for(const name of ['connection.json','submission-journal.json']){try{data[name]=await (await directory.getFileHandle(name)).getFile().then(f=>f.text())}catch{data[name]=null}}return data}};
app.bind();window.initial=await app.initialize();window.ready=true;
}catch(e){window.bootError=String(e.stack||JSON.stringify(e));window.ready=true}
</script>`;
(async()=>{
 const out={checks:[],errors:[],console:[],external:[]};let browser;
 const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');if(u.pathname==='/'){res.setHeader('content-type','text/html;charset=utf-8');return res.end(html)}const p=path.resolve(root,'.'+u.pathname);if(!p.startsWith(root+'/'))throw Error('path');res.setHeader('content-type',p.endsWith('.mjs')?'text/javascript':p.endsWith('.css')?'text/css':'text/plain');res.end(await fs.readFile(p))}catch{res.writeHead(404).end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const origin='http://127.0.0.1:'+server.address().port;
  for(const scenario of ['saved','temporary','http401','http403','http404','http429','absent','storage','guard','mismatch','unknown','partial']) {
   const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
   await context.route('**/*',r=>{if(r.request().url().startsWith(origin+'/'))return r.continue();out.external.push(r.request().url());return r.abort()});
   const page=await context.newPage();page.setDefaultTimeout(15000);
   page.on('pageerror',e=>out.errors.push({scenario,message:e.message}));page.on('console',m=>{if(['error','warning'].includes(m.type()))out.console.push({scenario,message:m.text()})});
   const boot=async()=>{await page.waitForFunction(()=>window.ready);assert.equal(await page.evaluate(()=>window.bootError),undefined);await page.evaluate(()=>Promise.allSettled(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished)))};
   await page.goto(origin+'/?scenario='+scenario+'#/home');await boot();
   const form=page.locator('.connection-details'),retry=page.locator('.startup-retry-panel'),edit=page.getByRole('button',{name:'연결 설정 수정',exact:true});
   const state=await page.evaluate(()=>({initial:window.initial,connected:fixture.app.getState().connected,calls:fixture.fake.calls.length}));
   const snapshot=await page.evaluate(()=>fixture.snapshot());
   await page.screenshot({path:path.join(evidence,scenario+'-initial-390.png')});
   const text=await page.locator('body').innerText();assert.doesNotMatch(text,/PRIVATE-RAW-ERROR|test-only-credential/);
   for(const id of Object.values(JSON.parse(snapshot['connection.json']||'{"dataSources":{}}').dataSources))assert.ok(!text.includes(id));
   if(scenario==='saved') {
    assert.equal(state.connected,true);assert.equal(state.calls,4);assert.equal(await form.isVisible(),false);
    await page.reload();await boot();assert.equal(await page.evaluate(()=>fixture.app.getState().connected),true);assert.deepEqual(await page.evaluate(()=>fixture.snapshot()),snapshot);
   } else if(['unknown','partial'].includes(scenario)) {
    assert.equal(state.connected,true);assert.equal(await page.evaluate(()=>fixture.app.getState().unresolved),true);
    assert.equal(await page.evaluate(async()=>{try{await fixture.app.submit('beans',{name:'must block'});return false}catch{return true}}),true);
    assert.equal(await page.evaluate(()=>fixture.fake.calls.some(c=>c.method!=='GET')),false);
   } else if(['guard','mismatch'].includes(scenario)) {
    assert.equal(state.connected,false);assert.equal(state.calls,0);assert.equal(await page.locator('.repair-panel').isVisible(),true);assert.equal(await form.isVisible(),false);assert.equal(await edit.isVisible(),false);
   } else if(scenario==='absent') {
    assert.equal(state.initial,null);assert.equal(await form.isVisible(),true);assert.equal(await retry.isVisible(),false);assert.equal(state.calls,0);
   } else {
    assert.equal(state.connected,false);assert.equal(await retry.isVisible(),true);assert.equal(await form.isVisible(),false);assert.equal(await edit.isVisible(),scenario!=='storage');
    if(scenario.startsWith('http')) {
     await edit.click();assert.equal(await form.isVisible(),true);assert.equal(await page.locator('[name="token"]').inputValue(),'');
    }else{
     await page.evaluate(()=>fixture.restore());await page.getByRole('button',{name:'저장된 연결 다시 읽기',exact:true}).click();
     await page.waitForFunction(()=>fixture.app.getState().connected);assert.deepEqual(await page.evaluate(()=>fixture.snapshot()),snapshot);
    }
   }
   for(const width of [320,390]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(width===390)await page.screenshot({path:path.join(evidence,scenario+'-390.png')})}
   out.checks.push({scenario,pass:true,...state});await context.close();
  }
  assert.deepEqual(out.errors,[]);assert.deepEqual(out.console,[]);assert.deepEqual(out.external,[]);
 }catch(e){out.failure=String(e.stack);process.exitCode=1}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));await fs.writeFile(path.join(evidence,'browser-results.json'),JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2))}
})();
