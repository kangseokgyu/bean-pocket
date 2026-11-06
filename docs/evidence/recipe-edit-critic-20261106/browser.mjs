import { chromium } from '/opt/codex/cua_node/lib/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const results=[];
try {
for(const [name,viewport] of [['mobile',{width:390,height:844}],['desktop',{width:1440,height:1000}]]) {
 const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:4216/candidate/pwa/index.html');await page.waitForFunction(()=>window.harnessReady||window.harnessError);assert.equal(await page.evaluate(()=>window.harnessError),undefined);
 const id=await page.evaluate(()=>harness.recipe.id);
 await page.evaluate(()=>{harness.view.renderRoute('/recipes/'+harness.recipe.id);});
 await page.locator('[data-action="edit-recipe"]').click();
 const form=page.locator('form[data-edit-id]');await form.waitFor();
 assert.equal(await form.locator('[name="name"]').inputValue(),'매일 아침 V60');assert.equal(await form.locator('.step-row').count(),3);
 await form.locator('[name="name"]').fill('취소 검사');await form.locator('[data-action="cancel-form"]').click();await page.locator('.edit-discard-dialog[open]').waitFor();await page.locator('[data-action="keep-recipe-edit"]').click();assert.equal(await form.locator('[name="name"]').inputValue(),'취소 검사');
 await form.locator('[data-action="cancel-form"]').click();await page.locator('[data-action="discard-recipe-edit"]').click();await page.waitForFunction(id=>harness.view.currentRoute()==='/recipes/'+id,id);await page.locator('[data-action="edit-recipe"]').click();assert.equal(await form.locator('[name="name"]').inputValue(),'매일 아침 V60');
 // Route navigation preserves the per-recipe draft, including step identity.
 const baseline=await page.evaluate(()=>structuredClone(harness.fake.rows));
 await form.locator('[name="name"]').fill('독립 검증 '+name);
 await page.evaluate(()=>harness.view.renderRoute('/home'));await page.evaluate(()=>harness.view.renderRoute('/recipes/'+harness.recipe.id+'/edit'));assert.equal(await form.locator('[name="name"]').inputValue(),'독립 검증 '+name);
 await form.locator('[name="dripper"]').fill('Origami');await form.locator('[name="grind"]').fill('중간');await form.locator('[name="grinder"]').fill('C40');await form.locator('[name="grinderSetting"]').fill('24');await form.locator('[name="microns"]').fill('750');await form.locator('[name="extractionGuide"]').fill('교반 없이 천천히');
 await form.locator('.step-row').nth(1).locator('[data-action="remove-step"]').click();
 await form.locator('[data-action="add-step"]').click();const added=form.locator('.step-row').last();await added.locator('[name="stepName"]').fill('마무리');await added.locator('[name="time"]').fill('2:00');await added.locator('[name="water"]').fill('100');await form.locator('.step-row').first().locator('[name="water"]').fill('50');
 // Remaining waters are 50+100+100 = declared 250.
 await page.screenshot({path:'docs/evidence/recipe-edit-critic-20261106/'+name+'-edit.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await form.locator('button[type="submit"]').click();await page.waitForFunction(id=>harness.view.currentRoute()==='/recipes/'+id,id);
 const saved=await page.evaluate(()=>({rows:harness.fake.rows,journal:harness.native.journal(),latest:harness.latest,state:harness.app.getState()}));
 const op=saved.journal.operations.findLast(o=>o.kind==='edit-recipe');assert.equal(op.status,'succeeded');assert.ok(op.editTarget.pages.every(p=>p.state==='confirmed'));assert.equal(op.editTarget.pages.filter(p=>p.action==='create').length,1);assert.equal(op.editTarget.pages.filter(p=>p.action==='archive').length,1);
 const oldRecipe=baseline.find(r=>r.id===id);const newRecipe=saved.rows.find(r=>r.id===id);assert.deepEqual(newRecipe.properties['원두'],oldRecipe.properties['원두']);assert.deepEqual(newRecipe.properties['즐겨찾기'],oldRecipe.properties['즐겨찾기']);
 const recordId=await page.evaluate(()=>harness.record.id);assert.deepEqual(saved.rows.find(r=>r.id===recordId),baseline.find(r=>r.id===recordId));
 await page.screenshot({path:'docs/evidence/recipe-edit-critic-20261106/'+name+'-saved.png',fullPage:true});
 // A fresh remote mutation must reject without PATCH/POST writes.
 await page.locator('[data-action="edit-recipe"]').click();await form.locator('[name="name"]').fill('stale write');
 const n=await page.evaluate(()=>{const row=harness.fake.rows.find(r=>r.id===harness.recipe.id);const p=row.properties['레시피 이름'];p.title=[{type:'text',text:{content:'Remote rename'}}];return harness.fake.calls.length;});
 await form.locator('button[type="submit"]').click();await page.waitForFunction(()=>!harness.app.getState().pending);
 const calls=await page.evaluate(n=>harness.fake.calls.slice(n),n);assert.equal(calls.filter(c=>['PATCH','POST'].includes(c.method)&&c.pathname.startsWith('/v1/pages')).length,0);assert.equal(await form.count(),1);
 assert.deepEqual(errors,[]);results.push({viewport:name,save:'succeeded',confirmedPages:op.editTarget.pages.length,cancel:'keep and discard verified',draft:'route preserved',stale:'zero write rejection',historicalRecord:'unchanged',overflow:false,errors});await context.close();
}
}finally{await browser.close();}
await writeFile('docs/evidence/recipe-edit-critic-20261106/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
