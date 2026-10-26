import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { createSnapshot, validateRecipe } from '../lib/domain.mjs';
import { encodeProperties } from '../pwa/data/notion-properties.mjs';
import * as repositoryModule from '../pwa/data/read-repository.mjs';

const { createReadRepository } = repositoryModule;
const KINDS = ['beans', 'recipes', 'steps', 'records'];
const SOURCES = Object.freeze({
  beans: 'a1111111-1111-4111-8111-111111111111',
  recipes: 'a3333333-3333-4333-8333-333333333333',
  steps: 'a4444444-4444-4444-8444-444444444444',
  records: 'a5555555-5555-4555-8555-555555555555',
});
const IDS = Object.freeze({
  bean: 'b1111111-1111-4111-8111-111111111111',
  otherBean: 'b1111111-1111-4111-8111-222222222222',
  bag: 'b2222222-2222-4222-8222-111111111111',
  otherBag: 'b2222222-2222-4222-8222-222222222222',
  recipe: 'b3333333-3333-4333-8333-111111111111',
  secondRecipe: 'b3333333-3333-4333-8333-222222222222',
  thirdRecipe: 'b3333333-3333-4333-8333-333333333333',
  fourthRecipe: 'b3333333-3333-4333-8333-444444444444',
  fifthRecipe: 'b3333333-3333-4333-8333-555555555555',
  pageA: 'b4444444-4444-4444-8444-111111111111',
  pageB: 'b4444444-4444-4444-8444-222222222222',
  pageC: 'b4444444-4444-4444-8444-333333333333',
  pageD: 'b4444444-4444-4444-8444-444444444444',
  record: 'b5555555-5555-4555-8555-111111111111',
  secondRecord: 'b5555555-5555-4555-8555-222222222222',
});
const TOKEN = 'synthetic-private-read-token';
const RAW_ERROR = `raw page failure ${TOKEN} ${IDS.recipe}`;
const LAST_EDITED = '2026-10-18T10:00:00.000Z';

function emptyRows() {
  return { beans: [], bags: [], recipes: [], steps: [], records: [] };
}

function rawPage(kind, id, fields, overrides = {}) {
  const properties = {};
  for (const [name, typed] of Object.entries(encodeProperties(kind, fields))) {
    const [type, value] = Object.entries(typed)[0];
    properties[name] = { id: `property-${name}`, type, [type]: structuredClone(value) };
    if (type === 'relation') properties[name].has_more = false;
  }
  return {
    object: 'page',
    id,
    parent: { type: 'data_source_id', data_source_id: SOURCES[kind] },
    archived: false,
    in_trash: false,
    last_edited_time: LAST_EDITED,
    properties,
    ...overrides,
  };
}

function beanPage(id = IDS.bean, name = '에티오피아') {
  return rawPage('beans', id, {
    name, roaster: '로스터리', origin: '구지', variety: '', process: '워시드', tastingNotes: '복숭아',
  });
}

function recipeInput(overrides = {}) {
  return {
    name: 'V60', beanId: IDS.bean, dripper: 'V60', dose: 15, grind: '중간', grinder: '그라인더',
    grinderSetting: '20', microns: null, temperature: 93, totalWater: 250,
    steps: [
      { name: '뜸', time: '0:00', water: 50 },
      { name: '1차', time: '0:30', water: 100 },
      { name: '2차', time: '1:10', water: 100 },
    ],
    ...overrides,
  };
}

function storedRecipe(id = IDS.recipe, overrides = {}) {
  const { id: _ignored, steps: _steps, ...inputOverrides } = overrides;
  return { id, ...validateRecipe(recipeInput(inputOverrides)) };
}

function legacySnapshot(recipe) {
  const snapshot = structuredClone(recipe);
  delete snapshot.stats;
  return { version: 1, ...snapshot };
}

function recipePage(id = IDS.recipe, overrides = {}) {
  const page = rawPage('recipes', id, {
    name: 'V60', beanId: IDS.bean, dripper: 'V60', dose: 15, grind: '중간', grinder: '그라인더',
    grinderSetting: '20', microns: null, temperature: 93, totalWater: 250, ...overrides,
  });
  page.properties['원두'] = { id: 'legacy-recipe-bean', type: 'relation', relation: [{ id: IDS.bean }], has_more: false };
  return page;
}

function stepPage(recipeId, step, id = IDS.pageA, overrides = {}) {
  return rawPage('steps', id, {
    name: step.name, recipeId, order: step.order, seconds: step.seconds, interval: step.interval,
    water: step.water, cumulativeWater: step.cumulativeWater,
  }, overrides);
}

function standardStepPages(recipeId = IDS.recipe, idPrefix = IDS.pageA) {
  const recipe = storedRecipe(recipeId);
  return recipe.steps.map((step, index) => stepPage(recipeId, step,
    index === 0 ? idPrefix : `${idPrefix.slice(0, -12)}${String(index + 1).padStart(12, '0')}`));
}

function bagPage(id = IDS.bag, beanId = IDS.bean, name = '봄 봉지') {
  return { ...rawPage('beans', id, { name }), properties: { '원두': { type: 'relation', relation: [{ id: beanId }], has_more: false } } };
}

function recordPage({ id = IDS.record, recipeId = IDS.recipe, beanId = IDS.bean, bagId = null, snapshot = legacySnapshot(storedRecipe(recipeId)), rating = 4 } = {}) {
  return rawPage('records', id, {
    name: '2026-10-18 · V60', beanId, recipeId, bagId, date: '2026-10-18', rating,
    cupNote: '복숭아와 꿀', snapshot,
  });
}

function baglessSnapshot(recipeId = IDS.recipe) {
  const currentRecipe = storedRecipe(recipeId);
  return createSnapshot({ id: IDS.bean, name: '에티오피아', roaster: '로스터리', origin: '구지',
    variety: '', process: '워시드', tastingNotes: '복숭아' }, currentRecipe);
}

function baselineRows() {
  return {
    beans: [beanPage()],
    bags: [bagPage()],
    recipes: [recipePage()],
    steps: standardStepPages(),
    records: [recordPage({ bagId: IDS.bag })],
  };
}

function epsilonRows() {
  const recipe = validateRecipe(recipeInput({
    totalWater: 50,
    steps: [
      { name: '거의 전량', time: '0:00', water: 49.9999995 },
      { name: '마지막 방울', time: '0:30', water: 0.0000005 },
    ],
  }));
  const rows = baselineRows();
  rows.recipes = [recipePage(IDS.recipe, { totalWater: 50 })];
  rows.steps = recipe.steps.map((step, index) => stepPage(
    IDS.recipe, step, index === 0 ? IDS.pageA : IDS.pageB,
  ));
  rows.records = [];
  return { rows, recipe };
}

function fixture({ rows = baselineRows(), onQuery, onGetPage, failQuery, failGetPage, empty = false } = {}) {
  const calls = [];
  const parents = new Map(rows.recipes.map(page => [page.id, page]));
  const client = {
    dataSources: SOURCES,
    async queryAll(kind) {
      calls.push({ method: 'queryAll', kind });
      if (onQuery) await onQuery(kind, rows, parents, calls);
      if (failQuery === kind) throw Object.assign(new Error(RAW_ERROR, { cause: { id: IDS.recipe } }), { privateId: IDS.recipe });
      return structuredClone(empty ? emptyRows()[kind] : rows[kind]);
    },
    async getPage(id) {
      calls.push({ method: 'getPage', id });
      if (onGetPage) await onGetPage(id, parents, calls);
      if (failGetPage === id || failGetPage === true) throw Object.assign(new Error(RAW_ERROR), { cause: TOKEN });
      const page = parents.get(id);
      if (page === undefined) throw new Error(RAW_ERROR);
      return structuredClone(page);
    },
  };
  return { client, calls, parents, rows, repository: createReadRepository(client) };
}

async function expectSafeFailure(action, code) {
  await assert.rejects(action, failure => {
    assert.equal(failure?.code, code);
    assert.equal(failure?.writeState, 'not-sent');
    assert.ok(Object.isFrozen(failure));
    const rendered = JSON.stringify(failure) + inspect(failure);
    assert.doesNotMatch(rendered, /synthetic-private-read-token|raw page failure|b3333333-3333-4333-8333-111111111111|cause|stack|Error:/i);
    return true;
  });
}

function assertDeepFrozen(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert.ok(Object.isFrozen(value));
  for (const child of Object.values(value)) assertDeepFrozen(child, seen);
}

function setRelation(page, propertyName, ids, hasMore = false) {
  page.properties[propertyName] = {
    id: `relation-${propertyName}`, type: 'relation', has_more: hasMore, relation: ids.map(id => ({ id })),
  };
}


test('critic: a cached first-page cursor must remain usable after its continuation was read', async () => {
 const rows = Array.from({length:25}, (_,i)=>rawPage('records',`aaaaaaaa-aaaa-4aaa-8aaa-${String(i+1).padStart(12,'0')}`,{name:'record',beanId:IDS.bean,recipeId:IDS.recipe,date:'2026-10-26',rating:5,cupNote:'',snapshot:baglessSnapshot()}));
 const repository=createReadRepository({dataSources:SOURCES,queryAll:async()=>[],getPage:async id=>id===IDS.bean?beanPage():recipePage(),queryPage:async()=>({items:rows,nextCursor:null,hasMore:false,complete:true})});
 const first=await repository.listRecords();
 const second=await repository.listRecords({cursor:first.nextCursor});
 assert.equal(second.items.length,5);
 const replay=await repository.listRecords({cursor:first.nextCursor});
 assert.deepEqual(replay.items,second.items);
});
test('critic: filtered fallback records retain global descending date order across pages', async()=>{
 const rows=Array.from({length:100},(_,i)=>rawPage('records',`aaaaaaaa-aaaa-4aaa-8aaa-${String(i+1).padStart(12,'0')}`,{name:`record ${i}`,beanId:IDS.bean,recipeId:i<60?null:IDS.recipe,date:new Date(Date.UTC(2026,9,26-i)).toISOString().slice(0,10),rating:5,cupNote:'',snapshot:baglessSnapshot()}));
 const repository=createReadRepository({dataSources:SOURCES,queryAll:async()=>[],getPage:async id=>id===IDS.bean?beanPage():recipePage(),queryPage:async(kind,o)=>{const filtered=o.filter?rows.slice(60):rows;const start=Number(o.cursor||0);const end=start+o.limit;return {items:filtered.slice(start,end),nextCursor:end<filtered.length?String(end):null,hasMore:end<filtered.length,complete:end>=filtered.length};}});
 const first=await repository.listRecords({recipeId:IDS.recipe});
 const second=await repository.listRecords({recipeId:IDS.recipe,cursor:first.nextCursor});
 assert.equal(first.items[0].date,rows[0].properties['날짜'].date.start);
 console.log('ORDER',JSON.stringify({first:first.items.map(x=>x.date),second:second.items.map(x=>x.date)}));
 assert.equal(second.items[0].date,rows[20].properties['날짜'].date.start);
});
test('critic: a current-generation record with damaged rating metadata stays visible with a warning',async()=>{
 const row=rawPage('records',IDS.record,{name:'damaged rating',beanId:IDS.bean,recipeId:IDS.recipe,date:'2026-10-26',rating:5,cupNote:'',snapshot:baglessSnapshot()});
 row.properties['별점']={type:'rich_text',rich_text:[{type:'text',text:{content:'oops'}}]};
 const client={dataSources:SOURCES,queryAll:async k=>k==='records'?[row]:k==='beans'?[beanPage()]:[],getPage:async id=>id===IDS.bean?beanPage():recipePage(),queryPage:async()=>({items:[row],nextCursor:null,hasMore:false,complete:true})};
 const repo=createReadRepository(client);const old=await repo.readAll();assert.equal(old.records.length,1);assert.ok(old.records[0].invalidFields.includes('rating'));
 const actual=await repo.listRecords();const counts=await repo.getBeanRecordCounts([IDS.bean]);console.log('DAMAGED',JSON.stringify({legacyReadVisible:old.records.length,pagedVisible:actual.items.length,counts}));
 assert.equal(actual.items.length,1);assert.ok(actual.items[0].invalidFields.includes('rating'));
 assert.equal(counts.counts[IDS.bean],old.records.length,'count includes warning-visible current records');
});
test('critic: records render from validated snapshots before bounded parent-name hydration',async()=>{
 const beanIds=Array.from({length:40},(_,i)=>`c1111111-1111-4111-8111-${String(i+1).padStart(12,'0')}`);
 const recipeIds=Array.from({length:40},(_,i)=>`c3333333-3333-4333-8333-${String(i+1).padStart(12,'0')}`);
 const rows=Array.from({length:40},(_,i)=>{
  const snapshot=baglessSnapshot(recipeIds[i]);snapshot.bean.id=beanIds[i];snapshot.bean.name=`Bean ${i}`;
  return rawPage('records',`c5555555-5555-4555-8555-${String(i+1).padStart(12,'0')}`,{
   name:`Record ${i}`,beanId:beanIds[i],recipeId:recipeIds[i],
   date:new Date(Date.UTC(2026,9,26-i)).toISOString().slice(0,10),rating:5,cupNote:'',snapshot,
  });
 });
 const parents=new Map([...beanIds.map((id,i)=>[id,beanPage(id,`Bean ${i}`)]),...recipeIds.map(id=>[id,recipePage(id)])]);
 const getPageCalls=[];
 const client={dataSources:SOURCES,connectionRevision:'critic-revision-one',queryAll:async()=>[],
  queryPage:async()=>({items:rows,nextCursor:null,hasMore:false,complete:true}),
  getPage:async id=>{getPageCalls.push(id);return structuredClone(parents.get(id));}};
 const repository=createReadRepository(client);
 const first=await repository.listRecords({limit:20});
 assert.equal(first.items.length,20);
 assert.equal(first.items[0].snapshot.bean.name,'Bean 0');
 assert.equal(first.items[0].beanNameStatus,'loading');
 assert.deepEqual(first.beans,[]);
 assert.deepEqual(getPageCalls,[],'first display does not wait for parent GETs');
 const hydrated=await repository.hydrateRecordParents(first.items);
 assert.equal(hydrated.beans.length,20);
 assert.equal(hydrated.recipes.length,20);
 assert.deepEqual(getPageCalls.sort(),[...beanIds.slice(0,20),...recipeIds.slice(0,20)].sort());
 assert.equal(getPageCalls.length,40,'only the 20 visible records are hydrated');
 await repository.hydrateRecordParents(first.items);
 assert.equal(getPageCalls.length,40,'validated parent names are reused within the connection revision');
 repository.invalidateRecordParentCache('beans');
 await repository.hydrateRecordParents(first.items);
 assert.equal(getPageCalls.length,60,'bean mutation invalidation reloads only bean names');
 client.connectionRevision='critic-revision-two';
 await repository.hydrateRecordParents(first.items);
 assert.equal(getPageCalls.length,100,'parent names are not reused across connection revisions');
});
