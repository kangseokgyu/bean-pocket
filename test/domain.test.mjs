import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTime,calculateSteps,validateRecipe,validateBean,validateDate,validateRecord,recordValidationIssues,copyRecipe,createActualSnapshot,createSnapshot,summarizeRatings} from '../lib/domain.mjs';
const recipe={id:'r',beanId:'b',name:'아침',dripper:'V60',dose:15,temperature:93,totalWater:250,steps:[{name:'뜸',time:'0:00',water:50},{name:'1차',time:'0:30',water:100},{name:'2차',time:'1:10',water:100}]};
test('누적 시간·간격·물 양을 계산한다',()=>{assert.equal(parseTime('1:10'),70);assert.throws(()=>parseTime('1:70'));const s=calculateSteps(recipe.steps);assert.deepEqual(s.map(x=>[x.seconds,x.interval,x.water,x.cumulativeWater]),[[0,0,50,50],[30,30,100,150],[70,40,100,250]]);});
test('필수값과 실제 날짜, 수량, 온도, 시간순서, 총량 검증',()=>{assert.throws(()=>validateBean({name:' '}));assert.equal(validateBean({name:'원두'}).name,'원두');assert.throws(()=>validateDate('2026-02-30'));assert.equal(validateDate('2026-10-15'),'2026-10-15');assert.throws(()=>validateRecipe({...recipe,totalWater:251}));assert.throws(()=>validateRecipe({...recipe,temperature:101}));assert.throws(()=>validateRecipe({...recipe,dose:0}));assert.throws(()=>validateRecipe({...recipe,steps:[{time:'0:20',water:250}]}));assert.throws(()=>calculateSteps([{time:'0:00',water:10},{time:'0:00',water:20}]));assert.equal(validateRecipe(recipe).totalWater,250);});
test('분쇄 입자는 기존 숫자와 정규화된 범위를 함께 보존한다',()=>{
  assert.equal(validateRecipe({...recipe,microns:700}).microns,700);
  assert.equal(validateRecipe({...recipe,microns:'900~1000'}).microns,'900~1000');
  assert.equal(validateRecipe({...recipe,microns:' 900 ~ 1000 '}).microns,'900~1000');
  const tinyRange = validateRecipe({...recipe,microns:'0.0000001~900'}).microns;
  assert.equal(tinyRange,'1e-7~900');
  assert.equal(validateRecipe({...recipe,microns:tinyRange}).microns,tinyRange);
  for(const microns of ['0~1000','900~900','1000~900','900~','~1000','900 ~ abc'])
    assert.throws(()=>validateRecipe({...recipe,microns}));
});
test('레시피는 원두와 독립적이고 별점 기록에는 명시적 원두가 필요하다',()=>{assert.equal(validateRecipe(recipe).beanId,undefined);for(const rating of [0,6,1.51,''])assert.throws(()=>validateRecord({date:'2026-10-15',rating},recipe,{id:'b'},null));assert.throws(()=>validateRecord({date:'2026-10-15',rating:4},recipe,null));assert.equal(validateRecord({date:'2026-10-15',rating:4},recipe,{id:'b'},null).rating,4);});
test('복사와 당시 조건 스냅샷은 독립적이다',()=>{const source={...recipe,micronStorage:{number:700,range:''}};const c=copyRecipe(source);const snapshot=createSnapshot({id:'b',name:'원두'},source);c.steps[0].water=99;recipe.temperature=90;assert.equal(snapshot.recipe.temperature,93);assert.equal(snapshot.recipe.steps[0].water,50);assert.deepEqual(snapshot.bean,{id:'b',name:'원두'});assert.equal(c.id,undefined);assert.equal(Object.hasOwn(c,'micronStorage'),false);assert.equal(Object.hasOwn(snapshot.recipe,'micronStorage'),false);recipe.temperature=93;});
test('실제 추출 스냅샷은 μm 범위 문자열을 원래 조건으로 보존한다',()=>{
  const snapshot=createActualSnapshot({id:'b',name:'원두'},{...recipe,microns:'900~1000'},'r');
  assert.equal(snapshot.recipe.microns,'900~1000');
});
test('copyRecipe와 createSnapshot은 favorite 속성을 상속하거나 스냅샷에 보존하지 않는다',()=>{const favoriteRecipe={...recipe,favorite:true};const favoriteBean={id:'b',name:'원두',favorite:true};const copied=copyRecipe(favoriteRecipe);assert.equal(copied.favorite,undefined);const snapshot=createSnapshot(favoriteBean,favoriteRecipe);assert.equal(snapshot.bean.favorite,undefined);assert.equal(snapshot.recipe.favorite,undefined);});
test('평균은 현재 generation 기록만 중복 포함해 집계하고 빈 평균은 null',()=>{const current={snapshotStatus:'valid',snapshot:{recordGeneration:'bagless-v1'}};assert.deepEqual(summarizeRatings([{...current,recipeId:'r',rating:4},{...current,recipeId:'r',rating:4},{...current,recipeId:'r',rating:5}], 'r'),{count:3,average:13/3});assert.deepEqual(summarizeRatings([], 'r'),{count:0,average:null});});
test('숫자처럼 변환되는 배열과 객체는 수량·별점으로 허용하지 않는다',()=>{assert.throws(()=>validateRecipe({...recipe,dose:[15]}));assert.throws(()=>validateRecord({date:'2026-10-15',rating:[4]},recipe,{id:'b'},null));});

test('새 snapshot에는 bagless generation marker를 붙이고 marker 없는 기록은 평점 집계에서 제외한다',()=>{const snapshot=createSnapshot({id:'b',name:'원두'},recipe);assert.equal(snapshot.recordGeneration,'bagless-v1');assert.deepEqual(summarizeRatings([{recipeId:'r',rating:1,snapshot:{version:1}},{recipeId:'r',rating:5,snapshot:{version:2,recordGeneration:'future-v1'}},{recipeId:'r',rating:4,snapshotStatus:'valid',snapshot}], 'r'),{count:1,average:4});});
test('별점은 0.1부터 5.0까지 0.1 단위로 검증하고 숫자로 보존한다',()=>{for(const rating of [0.1,1.2,4.9,5,'0.1','4.9']){const value=Number(rating);assert.equal(validateRecord({date:'2026-10-15',rating},recipe,{id:'b'}).rating,value);assert.deepEqual(recordValidationIssues({date:'2026-10-15',rating:value}),[]);}for(const rating of [0,0.09,0.11,5.1,1.01,'','1.01',NaN,Infinity])assert.throws(()=>validateRecord({date:'2026-10-15',rating},recipe,{id:'b'}));});
test('유효 decimal 별점은 저장 검증과 레시피 평균 집계에서 제외되지 않는다',()=>{const current={snapshotStatus:'valid',snapshot:{recordGeneration:'bagless-v1'}};const summary=summarizeRatings([{...current,recipeId:'r',rating:0.1},{...current,recipeId:'r',rating:4.3},{...current,recipeId:'r',rating:5},{...current,recipeId:'r',rating:0},{...current,recipeId:'r',rating:1.01}], 'r');assert.equal(summary.count,3);assert.ok(Math.abs(summary.average - (0.1 + 4.3 + 5) / 3) < 1e-12);});
