import test from 'node:test';
import assert from 'node:assert/strict';
import {NotionClient,NotionRepository,encodeProperties,decodePage} from '../lib/notion.mjs';
import { DATA_SOURCES } from './fixtures/notion-config.mjs';
test('읽기는 페이지네이션하며 쓰기는 data_source_id 부모와 정확한 속성을 쓴다',async()=>{let calls=[];const client=new NotionClient('secret',{fetchImpl:async(url,options)=>{calls.push({url,options});return Response.json(calls.length===1?{results:[{id:'one'}],has_more:true,next_cursor:'next'}:{results:[{id:'two'}],has_more:false});}});assert.equal((await client.queryAll(DATA_SOURCES.beans)).length,2);assert.equal(JSON.parse(calls[1].options.body).start_cursor,'next');assert.equal(calls[0].options.headers['Notion-Version'],'2025-09-03');await client.createPage(DATA_SOURCES.beans,{});assert.deepEqual(JSON.parse(calls[2].options.body).parent,{type:'data_source_id',data_source_id:DATA_SOURCES.beans});assert.equal(calls[2].options.redirect,'error');});
test('429는 재시도 없이 안전한 오류로 전달',async()=>{let count=0;const client=new NotionClient('secret',{fetchImpl:async()=>{count++;return Response.json({message:'secret'},{status:429});}});await assert.rejects(()=>client.queryAll(DATA_SOURCES.beans),/잠시/);assert.equal(count,1);});
test('긴 스냅샷은 2000자 청크로 직렬화하고 복원',()=>{const snapshot={note:'한'.repeat(5000)};const p=encodeProperties('records',{name:'기록',recipeId:'r',date:'2026-10-15',rating:4,snapshot});assert.equal(p['당시 레시피 스냅샷'].rich_text.length,3);const page={id:'x',properties:Object.fromEntries(Object.entries(p).map(([k,v])=>[k,{type:Object.keys(v)[0],...v}]))};assert.deepEqual(decodePage('records',page).snapshot,snapshot);});
test('단계 저장 실패 시 생성한 페이지를 역순 보관하고 재시도하지 않는다',async()=>{let creations=0;const archived=[];const client={createPage:async()=>{creations++;if(creations===3)throw Error('failed');return{id:'p'+creations};},archivePage:async id=>archived.push(id)};const repo=new NotionRepository(client);await assert.rejects(()=>repo.createRecipe({beanId:'b',name:'r',steps:[{name:'a',seconds:0,water:50},{name:'b',seconds:30,water:50}]}),/복구|취소/);assert.equal(creations,3);assert.deepEqual(archived,['p2','p1']);});
test('시간 초과는 토큰이나 전송 오류 원문을 노출하지 않는다',async()=>{const client=new NotionClient('private-token',{timeoutMs:5,fetchImpl:async(_url,options)=>{await new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>reject(Error('private-token')),{once:true});setTimeout(resolve,20);});return Response.json({});}});await assert.rejects(()=>client.createPage(DATA_SOURCES.beans,{}),error=>/불확실/.test(error.message)&&!error.message.includes('private-token'));});
test('취소 실패도 명시하고 생성·취소를 자동 재시도하지 않는다',async()=>{const repo=new NotionRepository({createPage:async(_id,properties)=>{if(properties['단계 이름'])throw Error('단계 오류');return{id:'r'};},archivePage:async()=>{throw Error('취소 오류');}});await assert.rejects(()=>repo.createRecipe({name:'r',steps:[{seconds:0,water:50}]}),/복구에 실패/);});

const CRITIC_IDS = {
  beanA: 'b1111111-1111-4111-8111-111111111111',
  beanB: 'b1111111-1111-4111-8111-222222222222',
  recipe: 'b3333333-3333-4333-8333-111111111111',
  record: 'b5555555-5555-4555-8555-111111111111',
  stepA: 'b4444444-4444-4444-8444-111111111111',
  stepB: 'b4444444-4444-4444-8444-222222222222',
};

function criticPage(kind, id, fields) {
  const properties = Object.fromEntries(Object.entries(encodeProperties(kind, fields)).map(([name, value]) => {
    const [type, content] = Object.entries(value)[0];
    return [name, { id: `property-${name}`, type, [type]: structuredClone(content), ...(type === 'relation' ? { has_more: false } : {}) }];
  }));
  return { id, parent: { type: 'data_source_id', data_source_id: DATA_SOURCES[kind] }, properties };
}

function criticDataset({ recipeBeanIds = [CRITIC_IDS.beanA], recipeBeanHasMore = false, rating = 5, date = '2026-10-22' } = {}) {
  const recipe = {
    id: CRITIC_IDS.recipe, name: 'V60', dripper: 'V60', dose: 15, grind: '', grinder: '',
    grinderSetting: '', microns: null, temperature: 93, totalWater: 250,
    steps: [
      { id: CRITIC_IDS.stepA, name: '1단계', recipeId: CRITIC_IDS.recipe, order: 1, seconds: 0, interval: 0, water: 50, cumulativeWater: 50 },
      { id: CRITIC_IDS.stepB, name: '2단계', recipeId: CRITIC_IDS.recipe, order: 2, seconds: 30, interval: 30, water: 200, cumulativeWater: 250 },
    ],
  };
  const pages = {
    beans: [
      criticPage('beans', CRITIC_IDS.beanA, { name: 'Synthetic A' }),
      criticPage('beans', CRITIC_IDS.beanB, { name: 'Synthetic B' }),
    ],
    bags: [],
    recipes: [criticPage('recipes', CRITIC_IDS.recipe, { ...recipe, steps: undefined })],
    steps: recipe.steps.map(step => criticPage('steps', step.id, step)),
    records: [criticPage('records', CRITIC_IDS.record, {
      name: 'synthetic record', beanId: null, recipeId: CRITIC_IDS.recipe, bagId: null,
      date, rating, cupNote: '', snapshot: { version: 1, ...recipe, beanId: CRITIC_IDS.beanA },
    })],
  };
  pages.recipes[0].properties['원두'] = {
    id: 'legacy-bean-relation', type: 'relation',
    relation: recipeBeanIds.map(id => ({ id })), has_more: recipeBeanHasMore,
  };
  delete pages.records[0].properties['원두'];
  return pages;
}

function criticRepository(pages) {
  const client = {
    dataSources: DATA_SOURCES,
    async queryAll(sourceId) {
      const kind = Object.keys(DATA_SOURCES).find(key => DATA_SOURCES[key] === sourceId);
      return pages[kind];
    },
  };
  return new NotionRepository(client);
}

test('server marks multi-candidate and truncated legacy bean relations as unresolved', async () => {
  for (const { recipeBeanIds, recipeBeanHasMore, expectedIds, expectedComplete } of [
    { recipeBeanIds: [CRITIC_IDS.beanA, CRITIC_IDS.beanB], recipeBeanHasMore: false,
      expectedIds: [CRITIC_IDS.beanA, CRITIC_IDS.beanB], expectedComplete: true },
    { recipeBeanIds: [CRITIC_IDS.beanA], recipeBeanHasMore: true,
      expectedIds: [CRITIC_IDS.beanA], expectedComplete: false },
  ]) {
    const result = await criticRepository(criticDataset({ recipeBeanIds, recipeBeanHasMore })).all();
    const record = result.records[0];
    assert.equal(record.beanId, null);
    assert.equal(record.beanResolution, 'needs-confirmation');
    assert.deepEqual(record.beanCandidates, expectedIds);
    assert.deepEqual(record.relationEvidence.legacyRecipeBean, {
      ids: expectedIds, complete: expectedComplete, present: true,
    });
  }
});

test('server keeps invalid stored fields and damaged snapshots visible only as warnings', async () => {
  const pages = criticDataset({ rating: 6, date: 'not-a-date' });
  const snapshot = JSON.parse(pages.records[0].properties['당시 레시피 스냅샷'].rich_text.map(item => item.text.content).join(''));
  snapshot.version = 2;
  snapshot.bean = { id: CRITIC_IDS.beanA, name: 'Synthetic A' };
  snapshot.recipe = { ...snapshot, steps: { broken: true } };
  delete snapshot.id;
  pages.records[0].properties['당시 레시피 스냅샷'].rich_text = [{ type: 'text', text: { content: JSON.stringify(snapshot) } }];

  const result = await criticRepository(pages).all();
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].rating, 6);
  assert.equal(result.records[0].date, 'not-a-date');
  assert.deepEqual(result.records[0].invalidFields, ['date', 'rating']);
  assert.equal(result.records[0].snapshot, null);
  assert.equal(result.records[0].snapshotStatus, 'damaged');
  assert.deepEqual(result.recipes[0].stats, { count: 0, average: null });
});


test('legacy server repository blocks bag pages and bag-linked record writes before Notion',async()=>{let calls=0;const repo=new NotionRepository({dataSources:DATA_SOURCES,recordBeanRelationSupported:true,createPage:async()=>{calls++;return{id:'unexpected'};}});await assert.rejects(()=>repo.create('bags',{name:'old bag',beanId:CRITIC_IDS.beanA}),/봉지|지원하지/);await assert.rejects(()=>repo.create('records',{name:'record',beanId:CRITIC_IDS.beanA,recipeId:CRITIC_IDS.recipe,bagId:null}),/봉지|bagId/);assert.equal(calls,0);});

test('bagless generation omits the bag relation in encoded record writes',()=>{const properties=encodeProperties('records',{name:'기록',beanId:CRITIC_IDS.beanA,recipeId:CRITIC_IDS.recipe,date:'2026-10-26',rating:5,snapshot:{version:2,recordGeneration:'bagless-v1'}});assert.equal(Object.hasOwn(properties,'원두 봉지'),false);});
