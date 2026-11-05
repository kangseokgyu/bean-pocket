import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE??'/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const mode=process.argv[2]??'baseline';
assert.ok(['baseline','candidate'].includes(mode));
const resultRoot=process.env.BEAN_BROWSER_RESULTS??'/tmp/bean-pocket-refactor-browser';
const out=resultRoot+'/'+mode;
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const results=[];const errors=[];const responses=[];
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)responses.push({url:r.url(),status:r.status()});});
 await page.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='127.0.0.1'?route.continue():route.abort();});
 await page.goto(`http://127.0.0.1:4216/${mode}/pwa/index.html`);
 await page.waitForFunction(()=>window.harnessReady||window.harnessError);
 assert.equal(await page.evaluate(()=>window.harnessError),undefined);
 await page.locator('.startup-overlay').waitFor({state:'hidden',timeout:5000});
 const ids=await page.evaluate(()=>({bean:harness.bean.id,recipe:harness.recipe.id}));
 async function navigate(route){await page.evaluate(route=>{harness.view.renderRoute(route);},route);await page.waitForFunction(route=>harness.latest?.screen?.route===route,route);await page.waitForFunction(()=>{const d=harness.latest;return !(d.beans??[]).some(b=>b.recordCount?.status==='loading')&&!(d.recipes??[]).some(r=>r.validationStatus==='checking'||(harness.view.currentRoute().startsWith('/recipes/')&&r.stats?.status==='loading'))&&!(d.records??[]).some(r=>r.beanNameStatus==='loading'||r.recipeNameStatus==='loading')&&d.recordInsights?.status!=='loading'&&!d.recordInsights?.loading;},{},{timeout:30000}).catch(async error=>{console.log(JSON.stringify(await page.evaluate(()=>({route:harness.view.currentRoute(),latest:harness.latest,calls:harness.fake.calls.slice(-6)}))));throw error;});await page.evaluate(()=>harness.view.clearStatus());await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
 const routes=[['home','/home'],['beans','/beans'],['bean-detail',`/beans/${ids.bean}`],['recipes','/recipes'],['recipe-detail',`/recipes/${ids.recipe}`],['records','/records'],['brew-bean','/brew/bean'],['brew-recipe',`/brew/recipe?beanId=${ids.bean}`],['brew-run',`/brew/run?beanId=${ids.bean}&recipeId=${ids.recipe}`]];
 for(const width of [390,1280]){
  await page.setViewportSize({width,height:844});
  for(const [name,route]of routes){
   await navigate(route);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name} ${width} overflow`);
   const dom=(await page.locator('#app-root').innerHTML()).replaceAll('/'+mode+'/','/fixture/');
   const file=`${name}-${width}`;
   await writeFile(`${out}/${file}.html`,dom);
   const screenshot=await page.screenshot({path:`${out}/${file}.png`,fullPage:true,animations:'disabled'});
   const hash=createHash('sha256').update(screenshot).digest('hex');
   if(mode==='candidate')assert.equal(dom,await readFile(`${resultRoot}/baseline/${file}.html`,'utf8'),`${file} DOM parity`);
   results.push({name,width,domParity:mode==='candidate'?true:null,screenshotSha256:hash});
  }
 }
 await page.setViewportSize({width:390,height:844});
 for(const [kind,route,opener]of [['beans','/beans','show-bean-form'],['recipes','/recipes','show-recipe-form']]){
  await navigate(route);
  const before=await page.evaluate(()=>({writes:harness.fake.calls.filter(c=>c.pathname==='/v1/pages'||c.method==='PATCH').length,journal:JSON.stringify(harness.native.journal())}));
  await page.locator(`[data-action="${opener}"]`).click();
  const dialog=page.locator(`dialog[data-entry-dialog="${kind}"]`);
  await dialog.waitFor({state:'visible'});
  await dialog.locator('[name="name"]').fill('취소할 초안');
  await page.evaluate(kind=>{window.dialogBefore=document.querySelector(`dialog[data-entry-dialog="${kind}"]`);harness.view.renderData(harness.latest);},kind);
  assert.equal(await page.evaluate(kind=>dialogBefore===document.querySelector(`dialog[data-entry-dialog="${kind}"]`),kind),true);
  assert.equal(await dialog.locator('[name="name"]').inputValue(),'취소할 초안');
  assert.equal(await dialog.locator('[name="name"]').evaluate(e=>e===document.activeElement),true);
  await dialog.locator('[data-action="cancel-form"]').click();
  await dialog.waitFor({state:'hidden'});
  const after=await page.evaluate(()=>({writes:harness.fake.calls.filter(c=>c.pathname==='/v1/pages'||c.method==='PATCH').length,journal:JSON.stringify(harness.native.journal())}));
  assert.deepEqual(after,before,kind+' cancel must not write API or journal');
  results.push({kind,cancelNoWrite:true,dialogIdentity:true,draftAndFocusPreserved:true});
 }
 await navigate('/beans');
 const favorite=page.locator('.entity-favorite').first();const pressed=await favorite.getAttribute('aria-pressed');await favorite.click();await page.waitForFunction(old=>document.querySelector('.entity-favorite')?.getAttribute('aria-pressed')!==old,pressed);
 results.push({favoriteToggle:true});
 assert.deepEqual(errors,[]);assert.deepEqual(responses,[]);
 await writeFile(`${out}/results.json`,JSON.stringify({mode,results,errors,responses,scope:'Chromium real View+Controller; memory storage/fake Notion; no SW lifecycle or real iPhone'},null,2));
 console.log(JSON.stringify({mode,passed:true,cases:results.length}));
}finally{await browser.close();}
