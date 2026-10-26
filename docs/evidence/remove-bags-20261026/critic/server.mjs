import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root = '/Users/kangseokgyu/.codex/worktrees/remove-bags/AX-1day';
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/pwa/styles.css"><link rel="icon" href="data:,"><title>원두 삭제 검증</title><body><main class="page"><section id="app-root" class="bean-section"></section></main><script type="module">
import {createAppView} from '/pwa/ui/view.mjs';
import {createAppController} from '/pwa/ui/controller.mjs';
import {NotionClient} from '/pwa/data/notion-client.mjs';
import {createReadRepository} from '/pwa/data/read-repository.mjs';
import {createCommands} from '/pwa/commands/index.mjs';
import {createSubmissionState} from '/pwa/state/submission-state.mjs';
import {memoryPlatform,fakePwaNotion,testConnection} from '/test/fixtures/pwa-environment.mjs';
const native=memoryPlatform({initialized:false}), fake=fakePwaNotion(), view=createAppView(document);
const app=createAppController({view,state:createSubmissionState(native),file:{readConnection:async()=>native.files.has('connection.json')?JSON.parse(native.files.get('connection.json')):null},makeClient:c=>new NotionClient(c.token,{dataSources:c.dataSources,connectionRevision:c.revision,fetchImpl:fake.fetch}),makeRepository:createReadRepository,makeCommands:createCommands});
app.bind();await app.connect(testConnection());
const bean=await app.submit('beans',{name:'검토 원두 긴 이름 에티오피아 시다마 워시드 테스트'});
const recipe=await app.submit('recipes',{name:'검토 레시피',dose:15,totalWater:250,temperature:93,extractionGuide:'교반 없음',steps:[{time:'0:00',water:50},{time:'0:30',water:200}]});
const old=await app.submit('records',{beanId:bean.value.id,recipeId:recipe.value.id,date:'2026-10-23',rating:1,cupNote:'HIDDEN-LEGACY'});
const oldRow=fake.rows.find(r=>r.id===old.value.id), prop=oldRow.properties['당시 레시피 스냅샷'];
const snapshot=JSON.parse(prop.rich_text.map(t=>t.text.content).join(''));delete snapshot.recordGeneration;prop.rich_text=[{type:'text',text:{content:JSON.stringify(snapshot)}}];
const record=await app.submit('records',{beanId:bean.value.id,recipeId:recipe.value.id,date:'2026-10-26',rating:4,cupNote:'CURRENT-FOUR'});
const bagId='22222222-2222-4222-8222-222222222222';
fake.rows.push({object:'page',id:bagId,parent:{type:'data_source_id',data_source_id:testConnection().dataSources.bags},archived:false,in_trash:false,last_edited_time:'2026-10-26T00:00:00.000Z',properties:{'봉지 이름':{type:'title',title:[{plain_text:'과거 봉지'}]},'원두':{type:'relation',relation:[{id:bean.value.id}],has_more:false},'로스팅 날짜':{type:'date',date:null}}});
await app.refresh();
window.ids={bean:bean.value.id,recipe:recipe.value.id,record:record.value.id,old:old.value.id,bag:bagId};
window.fixture={app,view,fake,native};window.fixtureReady=true;
</script></body></html>`;
const server = http.createServer(async(req,res)=>{
  try {
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
    const file=path.resolve(root,'.'+pathname);
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    const body=await readFile(file);
    res.setHeader('Content-Type',file.endsWith('.mjs')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'application/octet-stream');
    res.end(body);
  } catch {res.writeHead(404);res.end();}
});
server.listen(4267,'127.0.0.1',()=>console.log('fixture http://127.0.0.1:4267'));
