const {createServer}=require('node:http');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const {chromium,webkit}=require('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=process.cwd();
(async()=>{
const index=(await fs.readFile(root+'/pwa/index.html','utf8')).replace('__BUILD_VERSION__', '664d5b995172').replace('<script type="module" src="./app.mjs"></script>',`<script type="module">
import {createAppView} from './ui/view.mjs';
const view=createAppView(document); view.bind({});
view.renderData({beans:Array.from({length:35},(_,i)=>({id:String(i),name:'검증용 원두 '+i})),bags:[],recipes:[],records:[]});
view.showConnection({connected:true}); view.renderRoute('/beans');view.setState({});
</script>`);
const server=createServer(async(req,res)=>{try{const path=req.url.split('?')[0];const data=path==='/'?index:await fs.readFile(root+'/pwa'+path);res.setHeader('Content-Type',path.endsWith('.mjs')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');res.end(data);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{for(const [name,engine] of Object.entries({chromium,webkit})){
const browser=await engine.launch({headless:true,...(name==='chromium'?{channel:'chrome'}:{})});
try{for(const width of [320,360,390,600,601,768,1024,1440]){
const page=await browser.newPage({viewport:{width,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('nav.tabs button').first().waitFor();
await page.evaluate(()=>window.scrollTo(0,600));
const result=await page.evaluate(()=>{const header=document.querySelector('.site-header');const nav=header.querySelector('nav');const r=header.getBoundingClientRect();return {top:r.top,bottom:r.bottom,position:getComputedStyle(header).position,scrollY,overflow:document.documentElement.scrollWidth>innerWidth,labels:[...nav.querySelectorAll('button')].map(b=>b.textContent),navBottom:nav.getBoundingClientRect().bottom,items:[header.querySelector('.eyebrow'),nav,header.querySelector('.header-tools')].map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,center:(r.top+r.bottom)/2}}),logoSize:parseFloat(getComputedStyle(header.querySelector('.eyebrow')).fontSize),buttonHeight:nav.querySelector('button').getBoundingClientRect().height};});
assert.ok(Math.max(...result.items.map(r=>r.center))-Math.min(...result.items.map(r=>r.center))<2,'logo, navigation and tools share one row');assert.ok(result.logoSize>12);assert.ok(result.buttonHeight<48);assert.equal(result.position,'sticky');assert.equal(result.top,0);assert.ok(result.scrollY>0);assert.equal(result.overflow,false);assert.ok(result.navBottom<=result.bottom);assert.deepEqual(result.labels,['원두','봉지','레시피','추출 기록']);
for(const [label,route] of [['봉지','bags'],['레시피','recipes'],['추출 기록','records'],['원두','beans']]){await page.getByRole('button',{name:label,exact:true}).click();await page.waitForFunction(route=>location.hash==='#/'+route,route);await page.waitForFunction(route=>document.querySelector('nav [data-route="/'+route+'"]')?.getAttribute('aria-current')==='page',route);}
for(const label of await page.locator('.nav-label').all()){assert.ok(await label.evaluate(el=>{const a=el.getBoundingClientRect(),b=el.closest('button').getBoundingClientRect();return a.left>=b.left && a.right<=b.right;}),'menu text fits inside its button');}assert.deepEqual(errors,[]);
if(width===390) await page.screenshot({path:'/tmp/compact-header-'+name+'.png'});
console.log('PASS',name,width,JSON.stringify(result));await page.close();
}}finally{await browser.close();}
}}finally{server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
