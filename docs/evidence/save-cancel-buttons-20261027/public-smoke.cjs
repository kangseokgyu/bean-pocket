const { chromium } = require('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
(async () => {
  const [output, expectedBuild] = process.argv.slice(2);
  const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const results=[];
  try {
    for(const width of [320,390,1280]) {
      const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
      const page=await context.newPage(); const errors=[],failed=[];
      page.on('pageerror',error=>errors.push(error.message));
      page.on('response',response=>{if(response.status()>=400)failed.push({url:response.url(),status:response.status()});});
      await page.goto('https://kangseokgyu.github.io/bean-pocket/?verify='+Date.now()+'#/home',{waitUntil:'networkidle'});
      const settings=page.getByRole('button',{name:'Notion 연결 설정',exact:true});
      await settings.waitFor();
      if (!(await page.locator('#connection-settings').isVisible())) await settings.click({timeout:20000});
      const form=page.locator('#connection-settings form[data-form="connection"]');
      await form.waitFor({state:'visible'});
      const buttons=await form.locator('button').evaluateAll(items=>items.map(b=>({text:b.textContent.trim(),height:b.getBoundingClientRect().height,width:b.getBoundingClientRect().width,fontSize:getComputedStyle(b).fontSize,background:getComputedStyle(b).backgroundColor,hasIcon:!!b.querySelector('svg'),animation:getComputedStyle(b).animationName})));
      const build=await page.locator('#build-version').textContent();
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
      await page.screenshot({path:output+'/public-settings-'+width+'.png',fullPage:true,animations:'disabled'});
      await form.locator('[data-action="cancel-connection"]').click();
      await page.locator('#connection-settings').waitFor({state:'hidden'});
      results.push({width,build,overflow,buttons,errors,failed,cancelClosed:true});
      assert.equal(build,expectedBuild); assert.equal(overflow,false); assert.deepEqual(errors,[]); assert.deepEqual(failed,[]);
      assert.ok(buttons.length>=2 && buttons.every(b=>b.hasIcon && b.height>=44 && b.height<=48));
      await context.close();
    }
  } finally {await browser.close();await fs.writeFile(output+'/public-browser.json',JSON.stringify(results,null,2)+'\n');}
  console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exitCode=1;});
