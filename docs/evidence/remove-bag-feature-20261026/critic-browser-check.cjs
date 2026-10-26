const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = process.cwd();
const out = path.join(root,'docs/evidence/remove-bag-feature-20261026');
const fixture = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/pwa/styles.css"><body><main class="page"><header class="site-header"><span id="connection-tools"></span></header><section id="app-root"></section></main><script type="module">
import {createAppView} from '/pwa/ui/view.mjs';
import {createAppController} from '/pwa/ui/controller.mjs';
import {NotionClient} from '/pwa/data/notion-client.mjs';
import {createReadRepository} from '/pwa/data/read-repository.mjs';
import {createCommands} from '/pwa/commands/index.mjs';
import {createSubmissionState} from '/pwa/state/submission-state.mjs';
import {memoryPlatform,fakePwaNotion,testConnection} from '/test/fixtures/pwa-environment.mjs';
const native=memoryPlatform({initialized:false}), fake=fakePwaNotion();
const app=createAppController({view:createAppView(document),state:createSubmissionState(native),file:{readConnection:async()=>native.files.has('connection.json')?JSON.parse(native.files.get('connection.json')):null},makeClient:c=>new NotionClient(c.token,{dataSources:c.dataSources,connectionRevision:c.revision,fetchImpl:fake.fetch}),makeRepository:createReadRepository,makeCommands:createCommands});
window.harness={app,fake,native,connection:testConnection()};app.bind();await app.initialize();window.ready=true;
</script></body></html>`;
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const server=http.createServer(async(req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;if(pathname==='/fixture'){res.setHeader('Content-Type','text/html');return res.end(fixture)}if(pathname==='/favicon.ico')return res.writeHead(204).end();const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep))return res.writeHead(400).end();try{res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');res.end(await fs.readFile(file))}catch{res.writeHead(404).end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[];
 try {browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 for(const width of [390,1280]){const page=await browser.newPage({viewport:{width,height:900}});const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text())});await page.route('**/*',route=>{if(new URL(route.request().url()).hostname!=='127.0.0.1'){external.push(route.request().url());return route.abort()}return route.continue()});
 await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);await page.waitForFunction(()=>window.ready);
 const connection=page.locator('form[data-form="connection"]');assert.equal(await connection.locator('input').count(),5);assert.equal(await connection.locator('[name="bags"]').count(),0);
 const cfg=await page.evaluate(()=>window.harness.connection);await connection.locator('[name="token"]').fill(cfg.token);for(const [kind,id]of Object.entries(cfg.dataSources))await connection.locator(`[name="${kind}"]`).fill(id);
 await page.screenshot({path:path.join(out,`critic-connection-${width}.png`),fullPage:true});await connection.getByRole('button',{name:'연결 확인 및 저장',exact:true}).click();await page.waitForFunction(()=>harness.app.getState().connected);await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
 const navigate=async route=>{await page.locator(`[data-route="/${route}"]`).first().click();await page.locator(`[data-section="${route}"]`).first().waitFor()};
 const save=async kind=>{const form=page.locator(`form[data-form="${kind}"]`);await form.locator('[data-entry-submit]').click();await page.waitForFunction(k=>!document.querySelector(`dialog[data-entry-dialog="${k}"][open]`),kind)};
 const addBean=async name=>{await page.locator('[data-action="show-bean-form"]').click();await page.locator('form[data-form="beans"] [name="name"]').fill(name);await save('beans')};
 await addBean('기록있는 원두');await addBean('기록없는 원두');await navigate('recipes');await page.locator('[data-action="show-recipe-form"]').click();const recipe=page.locator('form[data-form="recipes"]');for(const [name,value]of Object.entries({name:'검증 레시피',dose:'15',totalWater:'250',temperature:'93',time:'0:00',water:'250'}))await recipe.locator(`[name="${name}"]`).fill(value);await save('recipes');assert.equal(await page.locator('.recipe-summary-card').count(),1);
 await navigate('records');await page.locator('[data-action="show-record-form"]').click();const record=page.locator('form[data-form="records"]');await record.locator('[name="beanId"]').selectOption({label:'기록있는 원두'});await record.locator('[name="recipeId"]').selectOption({label:'검증 레시피'});await record.locator('[name="rating"]').fill('5');await save('records');assert.equal(await page.locator('.record-card').count(),1);
 await navigate('beans');const deleteButton=name=>page.getByRole('button',{name:name+' 삭제',exact:true});const patches=()=>page.evaluate(()=>harness.fake.calls.filter(c=>c.method==='PATCH').length);
 let before=await patches();page.once('dialog',d=>d.dismiss());await deleteButton('기록없는 원두').click();assert.equal(await patches(),before);assert.equal(await deleteButton('기록없는 원두').count(),1);
 page.once('dialog',d=>d.accept());await deleteButton('기록있는 원두').click();await page.waitForFunction(()=>!harness.app.getState().pending);assert.equal(await patches(),before);assert.equal(await deleteButton('기록있는 원두').count(),1);
 page.once('dialog',d=>d.accept());await deleteButton('기록없는 원두').click();await page.waitForFunction(()=>!harness.app.getState().pending);assert.equal(await patches(),before+1);assert.equal(await deleteButton('기록없는 원두').count(),0);
 const state=await page.evaluate(()=>({generation:JSON.parse(harness.fake.rows.find(r=>r.parent.data_source_id===harness.connection.dataSources.records).properties['당시 레시피 스냅샷'].rich_text.map(t=>t.text.content).join('')).recordGeneration,overflow:document.documentElement.scrollWidth>innerWidth,bagText:document.body.innerText.includes('봉지'),queriedSources:[...new Set(harness.fake.calls.filter(c=>c.pathname.includes('/data_sources/')).map(c=>c.pathname.split('/')[3]))]}));assert.equal(state.generation,'bagless-v1');assert.equal(state.bagText,false);assert.equal(state.overflow,false);assert.equal(state.queriedSources.length,4);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 await page.screenshot({path:path.join(out,`critic-beans-${width}.png`),fullPage:true});results.push({width,...state,errors,external,checks:['4 source inputs + token','connection verification','create beans/recipe/step/record via UI','cancel deletion no PATCH','record-linked bean blocked no PATCH','unreferenced bean deletion refreshes list']});await page.close();}
 await fs.writeFile(path.join(out,'critic-browser-results.json'),JSON.stringify({browser:'installed Google Chrome headless; isolated temporary Playwright profiles',adapters:'memoryPlatform replaces native OPFS/locks/file picker; fakePwaNotion replaces all Notion transport; actual view/controller/commands/client/repository/journal',results},null,2));console.log(JSON.stringify(results,null,2));
 }finally{await browser?.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
