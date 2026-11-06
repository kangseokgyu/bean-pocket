const base=new URL(import.meta.url).searchParams.get('base');
try {
  const [{createAppView},{createAppController},{NotionClient},{createReadRepository},{createCommands},{createSubmissionState},{createConnectionFile},{memoryPlatform,fakePwaNotion}]=await Promise.all([
    import(base+'/pwa/ui/view.mjs'),import(base+'/pwa/ui/controller.mjs'),import(base+'/pwa/data/notion-client.mjs'),import(base+'/pwa/data/read-repository.mjs'),import(base+'/pwa/commands/index.mjs'),import(base+'/pwa/state/submission-state.mjs'),import(base+'/pwa/platform/connection-file.mjs'),import(base+'/test/fixtures/pwa-environment.mjs')]);
  const native=memoryPlatform(); const fake=fakePwaNotion();
  const state=createSubmissionState(native); const file=createConnectionFile(native);
  const view=createAppView(document); let latest;
  const original=view.renderData;
  view.renderData=data=>{latest=data;return original(data);};
  const app=createAppController({view,state,file,makeClient:c=>new NotionClient(c.token,{dataSources:c.dataSources,connectionRevision:c.revision,fetchImpl:fake.fetch}),makeRepository:createReadRepository,makeCommands:createCommands});
  app.bind();await app.initialize();
  const bean=await app.submit('beans',{name:'에티오피아 구지',origin:'시다마',roaster:'프릳츠',tastingNotes:'복숭아'});
  const recipe=await app.submit('recipes',{name:'매일 아침 V60',dose:15,totalWater:250,temperature:93,dripper:'V60',steps:[{time:'0:00',water:50},{time:'0:30',water:100},{time:'1:10',water:100}]});
  if(bean.status!=='succeeded'||recipe.status!=='succeeded') throw new Error('seed failed '+JSON.stringify({bean,recipe}));
  const record=await app.submit('records',{beanId:bean.value.id,recipeId:recipe.value.id,date:'2026-06-15',rating:'5',cupNote:'꿀, 살구'});
  if(record.status!=='succeeded')throw new Error('record seed failed '+JSON.stringify(record));
  await app.submit('favorite-bean',{id:bean.value.id,favorite:true});
  window.harness={view,app,native,fake,bean:bean.value,recipe:recipe.value,record:record.value,get latest(){return latest;}};
  view.clearStatus();window.harnessReady=true;
} catch(error){window.harnessError=error.stack;console.error(error);}
