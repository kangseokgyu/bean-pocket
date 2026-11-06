import {chromium} from '/opt/codex/cua_node/lib/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto('http://127.0.0.1:4216/candidate/pwa/index.html');await page.waitForFunction(()=>window.harnessReady||window.harnessError);
 const result=await page.evaluate(async()=>{
  const h=harness; const read=async()=>{await h.app.loadRoute('/recipes/'+h.recipe.id+'/edit');return h.latest.recipes.find(r=>r.id===h.recipe.id);};
  const original=await read();
  h.fake.intercept=call=>{if(call.method==='PATCH'){const row=h.fake.rows.find(r=>r.id===h.recipe.id);for(const [name,p]of Object.entries(call.body.properties)){row.properties[name]={type:Object.keys(p)[0],...p};}throw new TypeError('browser injected lost response');}};
  const savedUnknown=await h.app.submit('edit-recipe',{recipeId:h.recipe.id,baseline:original,changes:{...original,name:'Lost response saved'}});h.fake.intercept=null;
  const op1=h.native.journal().operations.findLast(o=>o.kind==='edit-recipe');
  const writesBefore=h.fake.calls.filter(c=>c.method==='PATCH').length;let retryCode;
  try{await h.app.submit('edit-recipe',{recipeId:h.recipe.id,baseline:original,changes:{...original,name:'Retry'}});}catch(e){retryCode=e.code;}
  await h.app.resolveOperation(op1.key,{originalConfirmed:true,decision:'saved'});
  const resolved1=h.native.journal().operations.find(o=>o.key===op1.key);
  const before=await read();
  h.fake.intercept=call=>{if(call.method==='PATCH')throw new TypeError('browser injected unsent response');};
  const beforeUnknown=await h.app.submit('edit-recipe',{recipeId:h.recipe.id,baseline:before,changes:{...before,name:'Never persisted'}});h.fake.intercept=null;
  const op2=h.native.journal().operations.findLast(o=>o.kind==='edit-recipe');
  await h.app.resolveOperation(op2.key,{originalConfirmed:true,decision:'not-saved'});const resolved2=h.native.journal().operations.find(o=>o.key===op2.key);
  return{savedUnknown:savedUnknown.status,ledger1:op1.editTarget.pages.map(p=>p.state),retryCode,resolvedSaved:resolved1.status,beforeUnknown:beforeUnknown.status,resolvedBefore:resolved2.status,writesDuringRecovery:h.fake.calls.filter(c=>c.method==='PATCH').length-writesBefore-1};
 });
 assert.equal(result.savedUnknown,'unknown');assert.deepEqual(result.ledger1,['unknown']);assert.equal(result.retryCode,'unresolved-operation');assert.equal(result.resolvedSaved,'succeeded');assert.equal(result.beforeUnknown,'unknown');assert.equal(result.resolvedBefore,'failed');assert.equal(result.writesDuringRecovery,0);
 await page.screenshot({path:'docs/evidence/recipe-edit-critic-20261106/recovery.png',fullPage:true});await writeFile('docs/evidence/recipe-edit-critic-20261106/recovery-results.json',JSON.stringify(result,null,2));console.log(result);
}finally{await browser.close();}
