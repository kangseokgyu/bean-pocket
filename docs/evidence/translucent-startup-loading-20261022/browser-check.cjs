const { chromium } = require('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../../dist');
const out = __dirname;
const harness = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bean-pocket/styles.css"><main class="page"><header class="site-header"><span class="eyebrow">BEAN POCKET</span><div id="connection-tools"></div></header><section id="app-root"></section><footer>BREW, TASTE, REMEMBER.</footer></main><script type="module">
import {createAppView} from '/bean-pocket/ui/view.mjs';
import {createAppController} from '/bean-pocket/ui/controller.mjs';
const outcome = new URLSearchParams(location.search).get('outcome');
let release; const gate = new Promise(resolve => release = resolve);
const view = createAppView(document);window.testView=view;let finishData;const dataGate=new Promise(resolve=>finishData=resolve);window.finishData=finishData;
const context = {async inspect(){return {initialized:true,blocked:false}},async readJournal(){return {operations:[],activeConnectionRevision:1}}};
const app = createAppController({view,state:{withWriteLock: action=>action(context)},file:{async readConnection(){await gate;if(outcome==='busy')throw {code:'lock-busy'};if(outcome==='error')throw {code:'read-failed'};if(outcome==='missing')return null;return {revision:outcome==='recovery'?2:1}}},makeClient:()=>({async verify(){}}),makeRepository:()=>({async readAll(){window.dataStarted=true;await dataGate;if(outcome==='read-error')throw {code:'read-failed'};return {beans:[],bags:[],recipes:[],records:[]}}}),makeCommands:()=>({})});
window.testApp=app;app.bind();window.done=app.initialize();window.finish=release;
</script></html>`;
const preserveHarness = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bean-pocket/styles.css"><main class="page"><header class="site-header"><span class="eyebrow">BEAN POCKET</span><div id="connection-tools"></div></header><section id="app-root"></section></main><script type="module">
import {createAppView} from '/bean-pocket/ui/view.mjs';import {createAppController} from '/bean-pocket/ui/controller.mjs';
const outcome=new URLSearchParams(location.search).get('outcome');let second=false;let release;const gate=new Promise(resolve=>release=resolve);
const view=createAppView(document);const context={async inspect(){return {initialized:true,blocked:false}},async readJournal(){return {operations:[],activeConnectionRevision:1}}};
const app=createAppController({view,state:{withWriteLock:action=>action(context)},file:{async readConnection(){if(second)await gate;return {revision:1}}},makeClient:()=>({async verify(){}}),makeRepository:()=>({async readAll(){if(second&&outcome==='read-error')throw {code:'read-failed'};return {beans:[{id:'11111111-1111-4111-8111-111111111111',name:second?'새 원두':'기존 원두'}],bags:[],recipes:[],records:[]}}}),makeCommands:()=>({})});
app.bind();await app.initialize();window.previousContent=document.querySelector('.data-panel').firstElementChild;
const render=view.renderData;view.renderData=value=>{window.renderWasCovered=!document.querySelector('.startup-loading').hidden;return render(value)};
second=true;window.finish=release;window.done=app.initialize();
</script></html>`;
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/preserve'){res.setHeader('Content-Type','text/html');return res.end(preserveHarness)}
  if(url.pathname==='/fixture'){res.setHeader('Content-Type','text/html');return res.end(harness)}
  if(url.pathname==='/favicon.ico'){res.writeHead(204);return res.end()}
  const relative=url.pathname.replace(/^\/bean-pocket\//,'') || 'index.html';
  const file=path.resolve(root,relative);if(!file.startsWith(root+'/'))throw Error('invalid path');
  res.setHeader('Content-Type',({'.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'})[path.extname(file)]||'text/plain');
  res.end(await fs.readFile(file));
 }catch{res.writeHead(404);res.end('missing')}});
 await new Promise(resolve=>server.listen(4187,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:'/Users/kangseokgyu/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
  const page=await browser.newPage(); const errors=[]; const badResponses=[];const results=[];
  page.on('pageerror',error=>errors.push(String(error)));page.on('response',r=>{if(r.status()>=400)badResponses.push([r.url(),r.status()])});
  for(const width of [320,390,768,1024,1440]){
   await page.setViewportSize({width,height:844});await page.goto('http://127.0.0.1:4187/fixture?outcome=missing');
   await page.locator('.startup-spinner').waitFor({state:'visible'});
   await page.evaluate(()=>document.querySelector('.page').style.transform='translateY(96px)');
   const state=await page.evaluate(()=>{const loading=document.querySelector('.startup-loading');const box=loading.getBoundingClientRect();const spin=document.querySelector('.startup-spinner');const r=spin.getBoundingClientRect();return {background:getComputedStyle(loading).backgroundColor,opacity:getComputedStyle(loading).opacity,spinnerOpacity:getComputedStyle(spin).opacity,overlay:{x:box.x,y:box.y,width:box.width,height:box.height},bodyChild:loading.parentElement===document.body,inert:document.querySelector('.page').inert,verticalCenter:Math.abs(r.y+r.height/2-innerHeight/2),animation:getComputedStyle(spin).animationName,label:getComputedStyle(loading.querySelector('.visually-hidden')).clipPath,overflow:document.documentElement.scrollWidth>innerWidth,center:Math.abs(r.x+r.width/2-innerWidth/2),retryVisible:document.querySelector('.startup-retry-panel').checkVisibility(),formVisible:document.querySelector('.connection-details').checkVisibility()}});
   assert.equal(state.background,'rgba(243, 239, 230, 0.35)');assert.equal(state.opacity,'1');assert.equal(state.spinnerOpacity,'1');
   assert.deepEqual(state.overlay,{x:0,y:0,width,height:844});assert.equal(state.bodyChild,true);assert.equal(state.inert,true);assert.ok(state.verticalCenter<2);
   await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement===document.body),true);
   assert.equal(state.animation,'pull-refresh-spin');assert.equal(state.label,'inset(50%)');assert.equal(state.overflow,false);assert.ok(state.center<2);assert.equal(state.retryVisible,false);assert.equal(state.formVisible,false);
   if(width===390){
    const spinner=page.locator('.startup-spinner');
    const shades=await spinner.locator('.pull-refresh-spoke').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).opacity));
    assert.equal(new Set(shades).size,12);
    await spinner.evaluate(el=>{const animation=el.getAnimations()[0];animation.pause();animation.currentTime=0});
    const first=await spinner.screenshot();
    await spinner.evaluate(el=>el.getAnimations()[0].currentTime=80);
    const second=await spinner.screenshot();assert.equal(first.equals(second),false,'rotation must change visible pixels');
    await spinner.evaluate(el=>el.getAnimations()[0].play());
    await page.screenshot({path:out+'/checking-mobile.png',fullPage:true});
    results.push({fadingSpokes:shades,rotationChangesPixels:true});
   }
   results.push({width,...state});
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.startup-spinner').evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  for(const outcome of ['saved','missing','error','recovery','busy','read-error','frozen']){
   await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:4187/fixture?outcome='+outcome);await page.locator('.startup-spinner').waitFor({state:'visible'});
   if(outcome==='frozen')await page.evaluate(()=>window.testApp.setFrozen(true));
   await page.evaluate(()=>window.finish());
   if(['saved','read-error'].includes(outcome)){
    await page.waitForFunction(()=>window.dataStarted);
    assert.equal(await page.locator('.startup-loading').isVisible(),true);
    assert.equal(await page.locator('.page').evaluate(el=>el.inert),true);
   }
   await page.evaluate(async()=>{window.finishData();await window.done});
   assert.equal(await page.locator('.startup-loading').isVisible(),false);
   assert.equal(await page.locator('.page').evaluate(el=>el.inert),false);
   if(['saved','frozen'].includes(outcome))assert.equal(await page.locator('.app-status').isVisible(),false);
   if(outcome==='saved'){
    await page.locator('.connection-toggle').focus();assert.equal(await page.locator('.connection-toggle').evaluate(el=>el===document.activeElement),true);
    await page.evaluate(async()=>{window.testView.showStatus({type:'read-error',message:'조회 실패'});await window.testApp.refresh()});
    assert.equal(await page.locator('.app-status').isVisible(),false);
    await page.screenshot({path:out+'/loaded-mobile.png',fullPage:true});
   }
   assert.equal(await page.locator('.startup-spinner').count(),0);
   assert.equal(await page.locator('.startup-retry-panel').isVisible(),outcome==='busy');
   assert.equal(await page.locator('.repair-panel').isVisible(),outcome==='recovery');
   if(outcome==='busy')await page.screenshot({path:out+'/retry-mobile.png',fullPage:true});
  }
  for(const outcome of ['saved','read-error']){
   await page.goto('http://127.0.0.1:4187/preserve?outcome='+outcome);await page.locator('.startup-spinner').waitFor({state:'visible'});
   assert.ok((await page.locator('.data-panel').innerText()).includes('기존 원두'));
   assert.equal(await page.evaluate(()=>window.previousContent===document.querySelector('.data-panel').firstElementChild),true);
   assert.equal(await page.locator('.data-panel').isVisible(),true);
   await page.screenshot({path:out+'/existing-data-'+outcome+'.png',fullPage:true});
   await page.evaluate(async()=>{window.finish();await window.done});
   assert.equal(await page.locator('.startup-loading').isVisible(),false);
   assert.equal(await page.locator('.page').evaluate(el=>el.inert),false);
   if(outcome==='saved'){
    assert.ok((await page.locator('.data-panel').innerText()).includes('새 원두'));
    assert.equal(await page.evaluate(()=>window.renderWasCovered),true);
    assert.equal(await page.locator('.app-status').isVisible(),false);
   }else{
    assert.ok((await page.locator('.data-panel').innerText()).includes('기존 원두'));
    assert.equal(await page.evaluate(()=>window.previousContent===document.querySelector('.data-panel').firstElementChild),true);
    assert.equal(await page.locator('.app-status').isVisible(),true);
   }
   results.push({existingDataOutcome:outcome,existingContentRetainedDuringLoading:true,newDataRenderedBeforeDismissal:outcome==='saved',oldContentRetainedAfterFailure:outcome==='read-error'});
  }
  await page.goto('http://127.0.0.1:4187/bean-pocket/');await page.locator('input[name="token"]').waitFor({state:'visible'});
  results.push({shippedPage:'connection form visible after no saved connection',reducedMotion:'none',outcomes:['saved','missing','error','recovery','busy','read-error','frozen'],errors,badResponses});
  assert.deepEqual(errors,[]);assert.deepEqual(badResponses,[]);
  await fs.writeFile(out+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(e=>{console.error(e);process.exitCode=1});
