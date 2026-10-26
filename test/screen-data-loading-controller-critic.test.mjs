import test from 'node:test';
import assert from 'node:assert/strict';
import {createAppController} from '../pwa/ui/controller.mjs';
const revision='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const sources=Object.fromEntries(['beans','recipes','steps','records'].map((k,i)=>[k,`${i+1}1111111-1111-4111-8111-111111111111`]));
function harness(repository,route='/records',viewExtra={}){
 let currentRoute=route;let data;const options=[];
 const connection={schemaVersion:1,revision,token:'fake-only',dataSources:sources};
 const context={inspect:async()=>({initialized:true,blocked:false}),readJournal:async()=>({operations:[],activeConnectionRevision:revision,connectionGuard:null})};
 const view={currentRoute:()=>currentRoute,setState(){},showStatus(){},showConnection(){},renderData(d){data=d;},setSearchOptions(...args){options.push(args);},...viewExtra};
 const app=createAppController({view,state:{withWriteLock:async f=>f(context)},file:{readConnection:async()=>connection},makeClient:()=>({verify:async()=>true}),makeRepository:()=>repository,makeCommands:()=>({})});
 return {app,options,data:()=>data,navigate:async r=>{currentRoute=r;return app.loadRoute(r);}};
}
const page=items=>({items,nextCursor:null,hasMore:false,complete:true});
test('critic: records render before deferred live names arrive and then merge them',async()=>{
 const beanId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';const recipeId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 let started;const startedPromise=new Promise(r=>started=r);let finish;
 const record={id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',beanId,recipeId,date:'2026-10-26',rating:5,
  snapshotStatus:'valid',snapshot:{version:2,recordGeneration:'bagless-v1',bean:{id:beanId,name:'Snapshot bean'},recipe:{id:recipeId,name:'Snapshot recipe'}},
  beanNameStatus:'loading',recipeNameStatus:'loading'};
 const h=harness({listRecords:async()=>({...page([record]),beans:[],recipes:[]}),hydrateRecordParents:async records=>{
  assert.deepEqual(records.map(item=>item.id),[record.id]);started();return await new Promise(resolve=>{finish=resolve;});
 }});
 const initializing=h.app.initialize();await startedPromise;
 assert.equal(h.data().records[0].beanNameStatus,'loading');
 assert.deepEqual(h.data().beans,[]);
 finish({beans:[{id:beanId,name:'Live bean'}],recipes:[{id:recipeId,name:'Live recipe'}],
  beanStatuses:{[beanId]:'live'},recipeStatuses:{[recipeId]:'live'},remainingBeanIds:[],remainingRecipeIds:[]});
 await initializing;await new Promise(r=>setTimeout(r,10));
 assert.equal(h.data().records[0].beanNameStatus,'live');
 assert.equal(h.data().beans[0].name,'Live bean');
 assert.equal(h.data().recipes[0].name,'Live recipe');
});
test('critic: preserve the search query for fresh, cached, and continued options',async()=>{
 const searches=[];
 const h=harness({listRecords:async()=>({...page([]),beans:[],recipes:[]}),searchOptions:async options=>{
  searches.push(options);
  return {...page([{id:'bean',name:'matching'}]),nextCursor:'query-bound',hasMore:true,complete:false};
 }});
 await h.app.initialize();
 await h.app.loadSearchOptions('beans','Ethiopia',null,'filters');
 await h.app.loadSearchOptions('beans','Ethiopia','query-bound','filters',true);
 await h.app.loadSearchOptions('beans','Ethiopia',null,'filters');
 assert.deepEqual(searches.map(options=>options.query),['Ethiopia','Ethiopia']);
 assert.deepEqual(h.options.map(args=>args[4]),['Ethiopia','Ethiopia','Ethiopia']);
});
test('critic: loading more restarts aborted validation for still visible summary cards',async()=>{
 let count=0;let started;const startedPromise=new Promise(r=>started=r);const batches=[];
 const recipes=Array.from({length:40},(_,i)=>({id:`recipe${i+1}`,validationStatus:'checking',stats:{status:'loading'}}));
 const h=harness({listRecipeSummaries:async ({cursor})=>{
  const start=cursor?20:0;const hasMore=start===0;
  return {...page(recipes.slice(start,start+20)),nextCursor:hasMore?'next':null,hasMore,complete:!hasMore};
 },validateRecipeSummaries:async(ids,{signal})=>{
  batches.push(ids);
  if(++count===1){started();return await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject({code:'read-cancelled'}),{once:true}));}
  return {items:ids.map(id=>({id,status:'ready',recipe:{id,validationStatus:'ready'}}))};
 }},'/recipes');
 await h.app.initialize();await startedPromise;await h.app.loadMore();await new Promise(r=>setTimeout(r,10));
 assert.deepEqual(h.data().recipes.map(r=>r.validationStatus),Array(40).fill('ready'));
 assert.deepEqual(batches.map(ids=>ids.length),[20,20,20]);
});
test('critic: loading more restarts aborted counts for all visible beans in bounded batches',async()=>{
 let count=0;let started;const startedPromise=new Promise(r=>started=r);const batches=[];
 const beans=Array.from({length:40},(_,i)=>({id:`bean${i+1}`,name:`Bean ${i+1}`}));
 const h=harness({listBeans:async ({cursor})=>{
  const start=cursor?20:0;const hasMore=start===0;
  return {...page(beans.slice(start,start+20)),nextCursor:hasMore?'next':null,hasMore,complete:!hasMore};
 },getBeanRecordCounts:async(ids,{signal})=>{
  batches.push(ids);
  if(++count===1){started();return await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject({code:'read-cancelled'}),{once:true}));}
  return {status:'ready',counts:Object.fromEntries(ids.map(id=>[id,1]))};
 }},'/beans');
 await h.app.initialize();await startedPromise;await h.app.loadMore();await new Promise(r=>setTimeout(r,10));
 assert.deepEqual(h.data().beans.map(bean=>bean.recordCount),Array.from({length:40},()=>({status:'ready',count:1})));
 assert.deepEqual(batches.map(ids=>ids.length),[20,20,20]);
});
