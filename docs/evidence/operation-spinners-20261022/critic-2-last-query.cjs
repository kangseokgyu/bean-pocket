const { chromium } = require('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const out = '/private/tmp/operation-spinners-critic2-last-query';
const base = 'http://127.0.0.1:4217';
(async () => {
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:'/Users/kangseokgyu/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
 const results={build:'53411a0d82cf',commit:'54849321d244516533fe3289839513f0df0f8643',cases:[]};
 try {
 for (const reduced of [false,true]) {
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,serviceWorkers:'block',reducedMotion:reduced?'reduce':'no-preference'});
  const page=await context.newPage();const errors=[],external=[];page.on('pageerror',e=>errors.push(String(e)));
  let gate=false,written=false,release,held=0,reachedGate;let gateReached=Promise.resolve();let unblock=Promise.resolve();
  await context.route('**/*',async route=>{
   const request=route.request();if(!request.url().startsWith(base+'/')) {external.push(request.url());return route.abort();}
   if(request.url().endsWith('/__mock__')) {
    const body=request.postDataJSON();
    if(gate && written && body.url.endsWith('/55555555-5555-4555-8555-555555555555/query')) {held++;reachedGate();await unblock;}
    if(gate && body.url.endsWith('/v1/pages') && body.method==='POST') {
     const response=await route.fetch();written=response.status()===200;return route.fulfill({response});
    }
   }
   return route.continue();
  });
  const measure=()=>page.evaluate(()=>{
   const spinner=document.querySelector('.startup-loading .operation-spinner');const r=spinner?.getBoundingClientRect();const overlay=document.querySelector('.startup-loading'),status=document.querySelector('.app-status'),surface=document.querySelector('.page');
   return {scrollY,width:innerWidth,height:innerHeight,rect:r?{x:r.x,y:r.y,width:r.width,height:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2}:null,visible:!!spinner?.checkVisibility(),count:[...document.querySelectorAll('.pull-refresh-spinner')].filter(e=>e.checkVisibility() && getComputedStyle(e.parentElement).opacity!=='0').length,spokes:spinner?.children.length,spinnerAriaHidden:spinner?.getAttribute('aria-hidden'),overlayBody:overlay.parentElement===document.body,overlayHidden:overlay.hidden,overlayAriaHidden:overlay.getAttribute('aria-hidden'),overlayBusy:overlay.getAttribute('aria-busy'),statusBusy:status.getAttribute('aria-busy'),statusRole:status.getAttribute('role'),statusLive:status.getAttribute('aria-live'),state:status.dataset.state,text:status.textContent,transform:getComputedStyle(surface).transform,pullState:surface.dataset.pullState,inert:surface.inert,animation:spinner?getComputedStyle(spinner).animationName:null,animationTiming:spinner?getComputedStyle(spinner).animationTimingFunction:null};
  });
  const validate=m=> { assert.equal(m.visible,true);assert.equal(m.count,1);assert.equal(m.spokes,12);assert.equal(m.overlayBody,true);assert.equal(m.spinnerAriaHidden,'true');assert.equal(m.overlayAriaHidden,'true');assert.equal(m.statusBusy,'true');assert.equal(m.statusRole,'status');assert.equal(m.statusLive,'polite');assert.equal(m.inert,false);assert.ok(Math.abs(m.rect.cx-195)<1);assert.ok(Math.abs(m.rect.cy-422)<1);assert.equal(m.animation,reduced?'none':'pull-refresh-spin'); };
  await page.goto(base+'/bean-pocket/');assert.equal(await page.locator('#build-version').textContent(),results.build);
  const connection=page.locator('[data-form="connection"]');await connection.locator('[name="token"]').fill('synthetic-critic2');
  for(const [key,n] of [['beans','1'],['bags','2'],['recipes','3'],['steps','4'],['records','5']]) await connection.locator(`[name="${key}"]`).fill(`${n.repeat(8)}-${n.repeat(4)}-4${n.repeat(3)}-8${n.repeat(3)}-${n.repeat(12)}`);
  await connection.getByRole('button',{name:'연결 확인 및 저장',exact:true}).tap();
  await page.locator('.operation-spinner').waitFor({state:'visible'});const connecting=await measure();validate(connecting);
  await page.locator('.startup-loading').waitFor({state:'hidden'});await page.locator('.tabs').waitFor({state:'visible'});
  await page.locator('[data-action="show-bean-form"]').tap();
  const bean=page.locator('[data-form="beans"]');const name=`Critic2 ${reduced?'reduced':'touch'} ${Date.now()}`;await bean.locator('[name="name"]').fill(name);
  const gesture=[];
  if(!reduced) {
   await page.evaluate(()=>scrollTo(0,0));const cdp=await context.newCDPSession(page);
   const touch=async(type,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x:200,y,id:1,radiusX:1,radiusY:1}]});
   for(const end of ['touchEnd','touchCancel']) {
    await touch('touchStart',160);await touch('touchMove',210);await page.waitForTimeout(80);
    gesture.push(await page.evaluate(()=>({phase:'pulling',state:document.querySelector('.page').dataset.pullState,pullVisible:!document.querySelector('.pull-refresh').hidden})));
    await touch(end,210);await page.waitForTimeout(220);
    gesture.push(await page.evaluate(()=>({phase:'released',state:document.querySelector('.page').dataset.pullState,pullHidden:document.querySelector('.pull-refresh').hidden,scrollY})));
   }
   for(const g of gesture) if(g.phase==='pulling') assert.equal(g.state,'pulling');else {assert.equal(g.state,'idle');assert.equal(g.pullHidden,true);}
   await cdp.detach();
  }
  await bean.getByRole('button',{name:'원두 저장',exact:true}).scrollIntoViewIfNeeded();
  const beforeSave=await page.evaluate(()=>({scrollY,transform:getComputedStyle(document.querySelector('.page')).transform}));assert.ok(beforeSave.scrollY>200);
  gate=true;written=false;held=0;unblock=new Promise(r=>release=r);gateReached=new Promise(r=>reachedGate=r);
  await bean.getByRole('button',{name:'원두 저장',exact:true}).tap();
  await page.locator('.operation-spinner').waitFor({state:'visible'});const saving=await measure();validate(saving);assert.equal(saving.transform,'matrix(1, 0, 0, 1, 0, 0)');
  await page.waitForFunction(()=>document.querySelector('.app-status').dataset.state==='saved',{},{timeout:15000});
  await gateReached;await page.screenshot({path:out+'/'+(reduced?'reduced':'touch')+'-saving-final-query.png'});const samples=[];for(let i=0;i<18;i++){const m=await measure();validate(m);samples.push(m);await page.waitForTimeout(200);}
  assert.ok(held>0,'follow-up query must be held');
  await page.screenshot({path:`${out}/${reduced?'reduced':'short-pull'}-final-read.png`});
  release();gate=false;
  await page.locator('.startup-loading').waitFor({state:'hidden'});const completed=await measure();assert.equal(completed.statusBusy,'false');assert.equal(completed.count,0);assert.equal(completed.state,'ready');
  await page.locator('[data-action="show-bean-form"]').tap();
  const draft=`Preserve failed draft ${reduced}`;await bean.locator('[name="name"]').fill(draft);
  await page.request.post(base+'/__control__',{data:{mode:'reject'}});
  await bean.getByRole('button',{name:'원두 저장',exact:true}).tap();await page.locator('.operation-spinner').waitFor({state:'visible'});const rejecting=await measure();validate(rejecting);
  await page.locator('.startup-loading').waitFor({state:'hidden'});const failed=await measure();assert.equal(failed.count,0);assert.equal(failed.statusBusy,'false');assert.equal(await bean.locator('[name="name"]').inputValue(),draft);assert.equal(await bean.getByRole('button',{name:'원두 저장',exact:true}).isEnabled(),true);assert.notEqual(failed.text,'');
  await page.screenshot({path:`out` .replace('out',out)+`/${reduced?'reduced':'touch'}-rejected.png`});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  results.cases.push({reduced,connecting,gesture,beforeSave,saving,heldFollowupQueries:held,samples,completed,rejecting,failed,draftPreserved:true,errors,external});
  console.log(JSON.stringify({reduced,held,samples:samples.length,saving,completed,failed}));
  await context.close();
 }
 await fs.writeFile(out+'/results.json',JSON.stringify(results,null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
