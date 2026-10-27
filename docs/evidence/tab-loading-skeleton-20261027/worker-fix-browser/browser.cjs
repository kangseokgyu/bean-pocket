const {chromium}=require('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {spawn}=require('node:child_process');const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const out=__dirname;const server=spawn(process.execPath,[path.join(out,'server.mjs')]);
(async()=>{let browser;const results=[];try{browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
for(const width of [390,1280]) {const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));const checks=[];const findings=[];
async function check(name,fn){try{await fn();checks.push({name,pass:true})}catch(e){checks.push({name,pass:false,error:String(e)});findings.push(name)}}
const visible=()=>page.locator('.card-skeletons').isVisible();
const waitq=()=>page.waitForFunction(()=>fixture.queue.length>0,null,{timeout:5000});
await page.goto('http://127.0.0.1:4283/');await page.waitForFunction(()=>window.fixtureReady);await waitq();
await check('initial skeleton retained',async()=>assert.equal(await visible(),true));
await page.evaluate(()=>fixture.finish());await page.evaluate(()=>window.start);
await check('first beans data clears skeleton',async()=>assert.equal(await visible(),false));
await page.locator('nav [data-route="/recipes"]').click();await waitq();
await check('recipes skeleton hides stale/empty and navigation usable',async()=>{assert.equal(await visible(),true);assert.equal(await page.locator('.data-panel').isVisible(),false);assert.equal(await page.locator('nav [data-route="/records"]').isEnabled(),true)});
await page.locator('nav [data-route="/records"]').click();await page.waitForFunction(()=>fixture.queue.length===2);
await page.evaluate(()=>fixture.finish(0,true));
await check('stale rejection cannot clear active skeleton',async()=>assert.equal(await visible(),true));
await page.screenshot({path:path.join(out,`${width}-loading.png`),fullPage:true});
await page.evaluate(()=>fixture.finish());await page.waitForFunction(()=>fixture.renders.at(-1)==='/records');
await check('records first data shown',async()=>{assert.equal(await visible(),false);assert.equal(await page.locator('.record-card').count(),1)});
await page.locator('nav [data-route="/recipes"]').click();await waitq();await page.evaluate(()=>fixture.finish(0,true));await page.waitForFunction(()=>fixture.states.at(-1)==='error');
await check('active error clears skeleton with no cards or empty',async()=>{assert.equal(await visible(),false);assert.equal(await page.locator('.route-read-error').isVisible(),true);assert.equal(await page.locator('.recipe-card,.empty-state').count(),0)});
await page.locator('nav [data-route="/beans"]').click();await page.waitForFunction(()=>fixture.renders.at(-1)==='/beans');
await check('cache has no artificial delay',async()=>assert.equal(await visible(),false));
// New-route modal is opened before its first read completes.
await page.evaluate(()=>fixture.view.renderRoute('/recipes/new'));await waitq();await page.waitForFunction(()=>!!document.querySelector('dialog[data-entry-dialog="recipes"]')?.open);
await page.locator('form[data-form="recipes"] [name="name"]').fill('critic draft');await page.evaluate(()=>{window.savedDialog=document.querySelector('dialog[data-entry-dialog="recipes"]');window.savedForm=document.querySelector('form[data-form="recipes"]');window.savedFocus=document.activeElement});
await page.evaluate(()=>fixture.finish());await page.waitForFunction(()=>fixture.states.at(-1)==='ready');
await check('new-route first read preserves modal DOM and focus',async()=>assert.equal(await page.evaluate(()=>savedDialog===document.querySelector('dialog[data-entry-dialog="recipes"]')&&savedForm===document.querySelector('form[data-form="recipes"]')&&document.activeElement===savedFocus),true));
await check('new-route draft value preserved',async()=>assert.equal(await page.locator('form[data-form="recipes"] [name="name"]').inputValue(),'critic draft'));
await page.screenshot({path:path.join(out,`${width}-modal.png`),fullPage:true});
// Same-route refresh while modal open exercises hidden list restoration.
const beforeHidden=await page.evaluate(()=>[...document.querySelector('.list-view').children].map(n=>({tag:n.tagName,cls:n.className,hidden:n.hidden})));await page.evaluate(()=>fixture.view.setRouteReadState('loading'));await page.evaluate(()=>fixture.view.setRouteReadState('ready'));const afterHidden=await page.evaluate(()=>[...document.querySelector('.list-view').children].map(n=>({tag:n.tagName,cls:n.className,hidden:n.hidden})));checks.push({name:'hidden-sibling diagnostic',beforeHidden,afterHidden});
await check('modal loading-ready restores hidden siblings',async()=>assert.equal(await page.evaluate(()=>[...document.querySelector('.list-view').children].filter(n=>n.tagName!=='DIALOG').every(n=>!n.hidden)),true));
results.push({width,checks,errors,findings});await context.close();}
}finally{fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(results,null,2));await browser?.close();server.kill();}console.log(JSON.stringify(results,null,2));process.exitCode=results.some(r=>r.findings.length||r.errors.length)?1:0;
})().catch(e=>{console.error(e);server.kill();process.exitCode=2});
