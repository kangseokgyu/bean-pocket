import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {SOURCES,IDS,beanPage,recipePage,standardStepPages,rawPage,baglessSnapshot} from './current/test/critic-fixture.mjs';
const result=[];
const id=(n,type)=>`${type}aaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12,'0')}`;
const beans=Array.from({length:60},(_,i)=>beanPage(id(i+1,'a'),`Bean ${String(i).padStart(3,'0')}`));
const recipes=Array.from({length:40},(_,i)=>recipePage(id(i+1,'b')));
const steps=recipes.flatMap((r,i)=>standardStepPages(r.id,id(i+1,'c')).map((s,j)=>({...s,id:id(i*3+j+1,'c')})));
const records=Array.from({length:1000},(_,i)=>{const snap=structuredClone(baglessSnapshot());snap.bean.id=beans[i%40].id;snap.recipe.id=recipes[i%40].id;return rawPage('records',id(i+1,'d'),{name:`Record ${i}`,beanId:snap.bean.id,recipeId:snap.recipe.id,date:'2026-10-26',rating:5,cupNote:'synthetic',snapshot:snap});});
const rows={beans,recipes,steps,records};
for(const version of ['baseline','current']){
 const root=`/private/tmp/sdl-review/${version}`;
 const {NotionClient}=await import(pathToFileURL(root+'/pwa/data/notion-client.mjs'));
 const {createReadRepository}=await import(pathToFileURL(root+'/pwa/data/read-repository.mjs'));
 const {createAppController}=await import(pathToFileURL(root+'/pwa/ui/controller.mjs'));
 const {schemas,relationTargets}=await import(pathToFileURL(root+'/pwa/data/notion-properties.mjs'));
 for(const route of ['/beans','/records']){
  const calls=[];let first=null;let latest;const start=performance.now();
  const fetchImpl=async(url,options={})=>{
   const path=new URL(url).pathname;const body=options.body?JSON.parse(options.body):null;calls.push({path,body,atMs:performance.now()-start});
   await new Promise(r=>setTimeout(r,100));
   if(options.signal?.aborted)throw Object.assign(new Error('aborted'),{name:'AbortError'});
   const parts=path.split('/');let data;
   if(parts[2]==='data_sources'){
    const kind=Object.keys(SOURCES).find(k=>SOURCES[k]===parts[3]);
    if(parts[4]!=='query')data={object:'data_source',id:SOURCES[kind],properties:Object.fromEntries(Object.entries(schemas[kind]).map(([field,[name,type]])=>[name,{type,[type]:type==='relation'?{data_source_id:SOURCES[relationTargets[kind][field]]}:{}}]))};
    else {const offset=Number(body.start_cursor||0);const end=offset+body.page_size;const list=rows[kind];data={object:'list',results:list.slice(offset,end),has_more:end<list.length,next_cursor:end<list.length?String(end):null};}
   }else data=Object.values(rows).flat().find(p=>p.id===parts[3]);
   const response=Response.json(data);calls.at(-1).serializedCodeUnits=JSON.stringify(data).length;return response;
  };
  const connection={schemaVersion:1,revision:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',token:'fake-only',dataSources:SOURCES};
  const context={inspect:async()=>({initialized:true,blocked:false}),readJournal:async()=>({operations:[],activeConnectionRevision:connection.revision,connectionGuard:null})};
  const app=createAppController({view:{currentRoute:()=>route,setState(){},showConnection(){},showStatus(){},finishStartup(){},renderData(data){latest=data;if(first===null)first={ms:performance.now()-start,requests:calls.length,serializedCodeUnits:calls.reduce((n,c)=>n+(c.serializedCodeUnits||0),0),rows:data[route.slice(1)].length};}},state:{withWriteLock:async fn=>fn(context)},file:{readConnection:async()=>connection},makeClient:c=>new NotionClient(c.token,{dataSources:SOURCES,connectionRevision:c.revision,fetchImpl}),makeRepository:createReadRepository,makeCommands:()=>({})});
  const initialized=await app.initialize();
  if(version==='current'&&route==='/beans'){
   const deadline=Date.now()+15000;while(latest?.beans.some(b=>b.recordCount.status==='loading')&&Date.now()<deadline)await new Promise(r=>setTimeout(r,50));
  }
  const entry={version,route,initialized,first,settledMs:performance.now()-start,totalRequests:calls.length,calls};result.push(entry);console.log(JSON.stringify({...entry,calls:undefined}));
 }
}
await (await import('node:fs/promises')).writeFile('/private/tmp/sdl-review/results/benchmark.json',JSON.stringify({conditions:{delayMs:100,beans:60,recipes:40,steps:120,records:1000,ratePacing:'production defaults (current 350ms)',network:'fake injected transport only',metric:'controller first renderData callback, not device paint',runsPerCase:1},result},null,2));
