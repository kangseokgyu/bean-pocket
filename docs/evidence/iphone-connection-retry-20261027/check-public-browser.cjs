const {chromium}=require('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
const output=process.argv[2];
const expected=process.argv[3];
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
const context=await browser.newContext({viewport:{width:390,height:844}});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const response=await page.goto('https://kangseokgyu.github.io/bean-pocket/');assert.equal(response.status(),200);
await page.waitForFunction(()=>!document.querySelector('.startup-loading')?.checkVisibility());
await page.locator('.connection-details').waitFor({state:'visible'});
const version=await page.locator('#build-version').innerText();assert.equal(version,expected);
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
assert.deepEqual(errors,[]);
await page.screenshot({path:path.join(output,'public-390.png'),fullPage:true});
const result={url:page.url(),version,httpStatus:response.status(),pageErrors:errors,overflow:false,firstConnectionVisible:true,iphoneVerified:false,existingClientUpdateVerified:false,realNotionVerified:false};
await fs.writeFile(path.join(output,'public-browser.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
