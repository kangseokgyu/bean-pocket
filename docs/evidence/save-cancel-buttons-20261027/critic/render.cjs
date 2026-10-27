const {chromium}=require('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root='/Users/kangseokgyu/.codex/worktrees/save-cancel-buttons/AX-1day',outdir='/tmp/save-cancel-critic';
const out={checks:[],findings:[],errors:[],external:[],metrics:[]};let publicMode='failure',publicWrites=0,releasePublic;
const check=(name,ok=true,detail)=>{out.checks.push({name,ok,detail});console.log(name,ok);};
const server=http.createServer(async(req,res)=>{try{
const p=new URL(req.url,'http://localhost').pathname;
if(p.startsWith('/api/')){res.setHeader('content-type','application/json');if(p==='/api/status')return res.end('{"connected":true}');if(p==='/api/data')return res.end('{"beans":[],"recipes":[],"records":[]}');if(req.method==='POST'){publicWrites++;await new Promise(r=>releasePublic=r);if(publicMode==='failure'){res.statusCode=400;return res.end('{"error":"mock rejected"}')}return res.end('{"id":"mock-saved"}');}}
let file=p==='/pwa-test'?outdir+'/pwa.html':p==='/public-test'?root+'/public/index.html':p==='/domain.mjs'?root+'/lib/domain.mjs':p.startsWith('/pwa/')||p.startsWith('/test/')||p.startsWith('/lib/')?root+p:root+'/public'+p;
if(p==='/favicon.ico'){res.writeHead(204).end();return}res.setHeader('content-type',file.endsWith('.html')?'text/html;charset=utf-8':/\.(mjs|js)$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':'text/plain');res.end(await fs.readFile(file));
}catch(e){res.writeHead(404).end()}});

(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[];try{
browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const origin='http://127.0.0.1:'+server.address().port,ctx=await browser.newContext({serviceWorkers:'block'});
await ctx.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
const page=await ctx.newPage();await page.goto(origin+'/pwa-test');await page.waitForFunction(()=>window.ready);await page.waitForSelector('dialog.connection-panel[open]',{state:'hidden'});
// Wait for the actual startup connection feedback to close before opening the entry modal.
await page.waitForFunction(()=>!document.querySelector('dialog[open]'));await page.evaluate(()=>{fixture.view.renderRoute('/beans');fixture.view.showBeanForm()});
const form=page.locator('form[data-form="beans"]');await form.waitFor({state:'visible'});await page.waitForTimeout(200);
for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});await page.screenshot({path:outdir+`/pwa-idle-${width}.png`,fullPage:true});const dimensions=await form.locator('.action-button').evaluateAll(ns=>ns.map(n=>({text:n.textContent,height:n.getBoundingClientRect().height,font:getComputedStyle(n).fontSize,radius:getComputedStyle(n).borderRadius,icon:n.querySelector('.button-icon').getBoundingClientRect().width})));for(const d of dimensions){assert.equal(d.height,44);assert.equal(d.font,'14px');assert.equal(d.radius,'10px');assert.equal(d.icon,16)}results.push({width,dimensions});}
await form.locator('[name=name]').fill('Rendered success');await form.locator('[type=submit]').click();await page.waitForFunction(()=>control.writes===1);await page.evaluate(()=>control.release());await page.waitForSelector('dialog[open] .button-icon[data-icon=check]');await page.waitForTimeout(220);await page.screenshot({path:outdir+'/pwa-success.png',fullPage:true});
}catch(e){results.push({failure:e.stack});process.exitCode=1}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));await fs.writeFile(outdir+'/pwa-render-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2))}})();
