const base=new URL(import.meta.url).searchParams.get('base');
try {
  const [{createAppView},{createAppController},{NotionClient},{createReadRepository},{createCommands},{createSubmissionState},{createConnectionFile},{memoryPlatform,fakePwaNotion}]=await Promise.all([
    import(base+'/pwa/ui/view.mjs'),import(base+'/pwa/ui/controller.mjs'),import(base+'/pwa/data/notion-client.mjs'),import(base+'/pwa/data/read-repository.mjs'),import(base+'/pwa/commands/index.mjs'),import(base+'/pwa/state/submission-state.mjs'),import(base+'/pwa/platform/connection-file.mjs'),import(base+'/test/fixtures/pwa-environment.mjs')]);
  const persisted=JSON.parse(sessionStorage.getItem('bean-pocket-browser-fixture-v1')||'null');
  const native=memoryPlatform(); const fake=fakePwaNotion({initialRows:persisted?.rows??[]});
  const state=createSubmissionState(native); const file=createConnectionFile(native);
  const view=createAppView(document); let latest;
  const original=view.renderData;
  view.renderData=data=>{latest=data;return original(data);};
  const app=createAppController({view,state,file,makeClient:c=>new NotionClient(c.token,{dataSources:c.dataSources,connectionRevision:c.revision,fetchImpl:fake.fetch}),makeRepository:createReadRepository,makeCommands:createCommands});
  app.bind();await app.initialize();
  let bean=persisted?.bean,recipe=persisted?.recipe,record=persisted?.record;
  if(!persisted){
   const beanResult=await app.submit('beans',{name:'에티오피아 구지',origin:'시다마',roaster:'프릳츠',tastingNotes:'복숭아'});
   const recipeResult=await app.submit('recipes',{name:'매일 아침 V60',dose:15,totalWater:250,temperature:93,dripper:'V60',steps:[{time:'0:00',water:50},{time:'0:30',water:100},{time:'1:10',water:100}]});
   if(beanResult.status!=='succeeded'||recipeResult.status!=='succeeded') throw new Error('seed failed '+JSON.stringify({beanResult,recipeResult}));
   const recordResult=await app.submit('records',{beanId:beanResult.value.id,recipeId:recipeResult.value.id,date:'2026-06-15',rating:'5',cupNote:'꿀, 살구'});
   if(recordResult.status!=='succeeded')throw new Error('record seed failed '+JSON.stringify(recordResult));
   await app.submit('favorite-bean',{id:beanResult.value.id,favorite:true});
   bean=beanResult.value;recipe=recipeResult.value;record=recordResult.value;
   sessionStorage.setItem('bean-pocket-browser-fixture-v1',JSON.stringify({rows:fake.rows,bean,recipe,record}));
  }
  window.harness={view,app,native,fake,bean,recipe,record,get latest(){return latest;}};
  view.clearStatus();window.harnessReady=true;
} catch(error){window.harnessError=error.stack;console.error(error);}
