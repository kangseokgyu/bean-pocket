import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE??'/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const [manifestPath,output]=process.argv.slice(2);
assert.ok(manifestPath&&output,'provide verified public manifest and output JSON');
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();const errors=[];const notionRequests=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://api.notion.com/**',route=>{notionRequests.push(route.request().url());return route.abort();});
 await page.goto(manifest.url,{waitUntil:'networkidle'});
 await page.waitForFunction(expected=>document.querySelector('#build-version')?.textContent===expected,manifest.version);
 await page.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration();return !!r?.active;},{},{timeout:45000});
 const cacheResults=await page.evaluate(async({url,version,files})=>{
   const name=(await caches.keys()).find(name=>name.includes(version));if(!name)throw Error('version cache missing');
   const cache=await caches.open(name);const results=[];
   for(const file of files){if(file.file==='sw.js')continue;const response=await cache.match(new URL(file.file,url).href);if(!response)throw Error('cache file missing '+file.file+' '+JSON.stringify({url,name,keys:(await cache.keys()).map(r=>({url:r.url,headers:[...r.headers]}))}));const bytes=await response.arrayBuffer();const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');if(sha256!==file.sha256)throw Error('cache bytes differ '+file.file);results.push({file:file.file,sha256});}
   return {name,files:results};
 },manifest);
 await page.reload({waitUntil:'networkidle'});
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await context.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(expected=>document.querySelector('#build-version')?.textContent===expected&&!!document.querySelector('.app-content'),manifest.version);
 assert.deepEqual(errors,[]);assert.deepEqual(notionRequests,[]);
 await writeFile(output,JSON.stringify({url:manifest.url,version:manifest.version,verifiedAt:new Date().toISOString(),cache:cacheResults,offlineReload:true,controlledAfterReload:true,errors,notionRequests,scope:'Fresh Chromium context. Offline app shell only; no real Notion, Safari, home screen installation or multi-tab update.'},null,2)+'\n');
 await page.screenshot({path:output.replace(/\.json$/,'.png'),fullPage:true,animations:'disabled'});
 console.log(JSON.stringify({version:manifest.version,cachedFiles:cacheResults.files.length,offlineReload:true,passed:true}));
}finally{await browser.close();}
