const {chromium}=require('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const root=process.cwd();
const evidence=path.join(root,'docs/evidence/home-brew-flow-20261027');
const assert=require('node:assert/strict');
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/pwa/styles.css"><link rel="icon" href="data:,"><main id="app-root"></main><script type="module">
import {createAppView} from '/pwa/ui/view.mjs';
import {createAppController} from '/pwa/ui/controller.mjs';
import {NotionClient} from '/pwa/data/notion-client.mjs';
import {createReadRepository} from '/pwa/data/read-repository.mjs';
import {createCommands} from '/pwa/commands/index.mjs';
import {createSubmissionState} from '/pwa/state/submission-state.mjs';
import {memoryPlatform,fakePwaNotion,testConnection} from '/test/fixtures/pwa-environment.mjs';
try { const native=memoryPlatform({initialized:false}),fake=fakePwaNotion();
const client=new NotionClient(testConnection().token,{dataSources:testConnection().dataSources,connectionRevision:testConnection().revision,fetchImpl:fake.fetch});

const view=createAppView(document);
const app=createAppController({view,state:createSubmissionState(native),file:{readConnection:async()=>JSON.parse(native.files.get('connection.json'))},makeClient:c=>new NotionClient(c.token,{dataSources:c.dataSources,connectionRevision:c.revision,fetchImpl:fake.fetch}),makeRepository:createReadRepository,makeCommands:createCommands});
app.bind(); await app.connect(testConnection());
const bean=await app.submit('beans',{name:'Critic 원두',origin:'시다마'});
const recipe=await app.submit('recipes',{name:'공용 V60',dose:15,totalWater:250,temperature:93,extractionGuide:'천천히 붓기',steps:[{time:'0:00',water:50},{time:'0:30',water:200}]});
await app.loadRoute(view.currentRoute(),{force:true});
window.fixture={view,app,fake,native,bean:bean.value.id,recipe:recipe.value.id};
window.ready=true;}catch(e){window.bootError=JSON.stringify(e);window.ready=true;}
</script>`;

(async()=>{
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');if(u.pathname==='/'){res.setHeader('content-type','text/html;charset=utf-8');res.end(html);return}const p=path.resolve(root,'.'+u.pathname);if(!p.startsWith(root+'/'))throw Error('path');res.setHeader('content-type',p.endsWith('.mjs')?'text/javascript':p.endsWith('.css')?'text/css':'text/plain');res.end(await fs.readFile(p));}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const out={external:[],errors:[],consoleErrors:[],checks:[]};
try {
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const origin='http://127.0.0.1:'+server.address().port;
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await context.route('**/*',r=>{if(r.request().url().startsWith(origin+'/'))return r.continue();out.external.push(r.request().url());return r.abort()});
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>out.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')out.consoleErrors.push(m.text())});
 const boot=async()=>{await page.waitForFunction(()=>window.ready);assert.equal(await page.evaluate(()=>window.bootError),undefined)};
 const route=async value=>{await page.evaluate(value=>location.hash=value,value);await page.waitForFunction(value=>fixture.view.currentRoute()===value,value)};
 const check=(name)=>out.checks.push({name,pass:true});
 await page.goto(origin);await boot();
 const ids=await page.evaluate(()=>({bean:fixture.bean,recipe:fixture.recipe}));out.ids=ids;
 // A list visit must not create an invisible empty draft.
 await route('/records');await page.waitForSelector('form[data-form="records"]',{state:'attached'});
 await route('/home');
 await page.getByRole('button',{name:'추출 시작',exact:true}).click();
 await page.getByRole('button',{name:'Critic 원두',exact:true}).click();
 await page.getByRole('button',{name:'공용 V60',exact:true}).click();
 await page.waitForSelector('.brew-run-pane');check('real commands create independent recipe; home → bean → shared recipe → guide');
 await page.goBack();await page.waitForSelector('[data-action="select-brew-recipe"][aria-pressed="true"]');
 await page.goBack();await page.waitForSelector('[data-action="select-brew-bean"][aria-pressed="true"]');
 await page.getByRole('button',{name:'Critic 원두',exact:true}).click();await page.getByRole('button',{name:'공용 V60',exact:true}).click();
 await page.waitForSelector('.brew-run-pane');await page.reload();await boot();await page.waitForSelector('.brew-run-pane');check('browser back retains selections; direct run refresh');
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(evidence,`worker2-guide-${width}.png`)});}check('guide no horizontal overflow at 320/390/768/1280');
 await page.getByRole('button',{name:'추출 완료',exact:true}).click();
 const form=page.locator('form[data-form="records"]');await form.waitFor({state:'visible'});
 out.recordBefore=await page.locator('.data-panel').innerText();out.recordOptions=await form.locator('[name="beanId"]').innerHTML();
 await page.waitForFunction(id=>document.querySelector('form[data-form="records"] [name="beanId"]')?.value===id,ids.bean);
 assert.equal(await form.locator('[name="beanId"]').inputValue(),ids.bean);assert.equal(await form.locator('[name="recipeId"]').inputValue(),ids.recipe);
 const today=await page.evaluate(()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')});
 assert.equal(await form.locator('[name="date"]').inputValue(),today);check('complete prefills bean, shared recipe and local today after list visit');
 await form.locator('[name="rating"]').fill('5');await form.locator('[name="cupNote"]').fill('공용 레시피 E2E: 복숭아와 꿀');
 const draftRoute=await page.evaluate(()=>fixture.view.currentRoute());
 await route('/home');await route(draftRoute);await form.waitFor({state:'visible'});assert.equal(await form.locator('[name="cupNote"]').inputValue(),'공용 레시피 E2E: 복숭아와 꿀');check('same brew draft survives navigation');
 await route('/home');await route(`/records/new?beanId=${ids.bean}&recipeId=${ids.recipe}&date=2026-01-01`);
 await page.waitForSelector('.record-draft-conflict');await page.getByRole('button',{name:'이전 기록 이어쓰기',exact:true}).click();
 await form.waitFor({state:'visible'});assert.equal(await form.locator('[name="date"]').inputValue(),today);assert.equal(await form.locator('[name="rating"]').inputValue(),'5');check('different flow requires choice; resume preserves original draft');
 out.beforeSave=await form.evaluate(f=>Object.fromEntries(new FormData(f)));
 await form.locator('button[type="submit"]').click();
 out.afterClick=await page.locator('.data-panel').innerText();
 await page.waitForFunction(()=>fixture.fake.rows.some(row=>row.properties['별점']?.number===5));
 const saved=await page.evaluate(()=>fixture.fake.rows.find(row=>row.properties['별점']?.number===5));
 assert.equal(saved.properties['컵노트'].rich_text.map(t=>t.text.content).join(''),'공용 레시피 E2E: 복숭아와 꿀');
 assert.equal(saved.properties['원두'].relation[0].id,ids.bean);assert.equal(saved.properties['레시피'].relation[0].id,ids.recipe);assert.equal(saved.properties['날짜'].date.start,today);
 out.saved={id:saved.id,properties:saved.properties};check('save rating/cup note through real adapter, repository, commands, journal and fake Notion');
 await page.waitForFunction(()=>!fixture.app.getState().pending);
 await form.waitFor({state:'hidden'});
 // Start-new must be an explicit discard, then use the new flow prefills.
 await route('/home');await route(draftRoute);await form.waitFor({state:'visible'});await form.locator('[name="cupNote"]').fill('discard only with explicit choice');
 await route('/home');await route(`/records/new?beanId=${ids.bean}&recipeId=${ids.recipe}&date=2026-01-01`);
 await page.waitForSelector('.record-draft-conflict');await page.getByRole('button',{name:'이전 초안을 버리고 새 기록 작성',exact:true}).click();
 await form.waitFor({state:'visible'});assert.equal(await form.locator('[name="cupNote"]').inputValue(),'');assert.equal(await form.locator('[name="date"]').inputValue(),'2026-01-01');check('explicit new record discards old draft and keeps new prefills');
 await route(`/brew/run?recipeId=${ids.recipe}`);await page.waitForFunction(()=>document.querySelector('.record-warning')?.textContent.includes('원두를 먼저'));assert.match(await page.locator('.record-warning').innerText(),/원두/);check('recipe-only URL requires explicit bean');
 assert.deepEqual(out.errors,[]);assert.deepEqual(out.consoleErrors,[]);assert.deepEqual(out.external,[]);
}catch(e){out.failure=String(e.stack);process.exitCode=1}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));await fs.writeFile(path.join(evidence,'worker2-browser-results.json'),JSON.stringify(out,null,2));console.log(JSON.stringify({...out,saved:out.saved?.id},null,2))}
})();
