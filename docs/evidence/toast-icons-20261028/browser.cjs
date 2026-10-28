const {chromium,webkit}=require('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs');const assert=require('node:assert/strict');
const remote=process.argv.includes('--public');
const base=remote?'https://kangseokgyu.github.io/bean-pocket/':'http://127.0.0.1:4199/';
let fixture=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/pwa/styles.css"><main class="page"><div id="app-root"></div></main><script type="module">
import {createAppView} from '/pwa/ui/view.mjs';
const view=window.view=createAppView(document);view.renderRoute('/beans');view.renderData({beans:[],recipes:[],records:[]});
view.bind({setDirty(){},getState(){return {}},async submit(){view.setState({pending:true});view.showStatus({type:'saving',message:'저장 중입니다.'});await new Promise(r=>setTimeout(r,1800));view.showEntrySuccess('beans');view.showStatus({type:'saved',message:'저장했습니다.'});view.setState({pending:false});}});view.showBeanForm();window.ready=true;
</script>`;
if(remote)fixture=fixture.replaceAll('/pwa/', '/bean-pocket/');
(async()=>{const results=[];for(const [engine,type]of Object.entries({chromium,webkit})){
 const browser=await type.launch(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true}:{headless:true});
 try {for(const [width,motion] of (remote?[[390,'no-preference']]:[[320,'no-preference'],[390,'no-preference'],[768,'no-preference'],[1280,'no-preference'],[390,'reduce']])){
 const page=await browser.newPage({viewport:{width,height:900},reducedMotion:motion});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/toast-icon-harness',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:fixture}));await page.goto(base+'toast-icon-harness');await page.waitForFunction(()=>window.ready);
 await page.locator('form[data-form="beans"] input[name="name"]').fill('테스트 원두');await page.locator('dialog[open] button[type="submit"]').click();
 const icon=page.locator('.status-icon');await page.locator('.status-icon[data-state="saving"]').waitFor({state:'visible'});
 const loading=await icon.evaluate(el=>({animation:getComputedStyle(el,'::after').animationName,svgDisplay:getComputedStyle(el.querySelector('svg')).display,afterMessage:el.previousElementSibling.classList.contains('status-message'),hiddenFromAT:el.getAttribute('aria-hidden')}));
 assert.equal(loading.animation,motion==='reduce'?'none':'action-button-spin');assert.equal(loading.svgDisplay,'none');assert.equal(loading.afterMessage,true);assert.equal(loading.hiddenFromAT,'true');
 if(width===390&&motion==='no-preference')await page.screenshot({path:'/tmp/toast-icons-'+(remote?'public-':'')+engine+'-loading.png'});
 await page.locator('.status-icon[data-state="success"]').waitFor({state:'visible'});
 const completed=await icon.evaluate(el=>{const t=el.parentElement.getBoundingClientRect();return {animation:getComputedStyle(el).animationName,svgDisplay:getComputedStyle(el.querySelector('svg')).display,path:el.querySelector('path').getAttribute('d'),message:el.previousElementSibling.textContent,overlap:[...document.querySelectorAll('dialog[open] button')].some(b=>{const r=b.getBoundingClientRect();return r.height>0&&r.left<t.right&&r.right>t.left&&r.top<t.bottom&&r.bottom>t.top;}),overflow:document.documentElement.scrollWidth>innerWidth};});
 assert.equal(completed.animation,motion==='reduce'?'none':'toast-icon-complete');assert.notEqual(completed.svgDisplay,'none');assert.equal(completed.path,'m20 6-11 11-5-5');assert.equal(completed.message,'저장했습니다.');assert.equal(completed.overlap,false);assert.equal(completed.overflow,false);
 if(width===390&&motion==='no-preference')await page.screenshot({path:'/tmp/toast-icons-'+(remote?'public-':'')+engine+'-complete.png'});
 await page.locator('.app-status').waitFor({state:'hidden',timeout:4200});assert.deepEqual(errors,[]);results.push({engine,width,motion,loading,completed,autoHidden:true,errors});await page.close();
 }}finally{await browser.close();fs.writeFileSync(remote?'/tmp/toast-icons-public.json':'/tmp/toast-icons-browser.json',JSON.stringify(results,null,2)+'\n');}}
 console.log(JSON.stringify({cases:results.length,passed:true}));})().catch(e=>{console.error(e);process.exitCode=1;});
