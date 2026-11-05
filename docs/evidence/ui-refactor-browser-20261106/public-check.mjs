import assert from 'node:assert/strict';
import path from 'node:path';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const [dist,output]=process.argv.slice(2);
assert.ok(dist&&output,'provide dist directory and output JSON');
const root='https://kangseokgyu.github.io/bean-pocket/';
const html=await readFile(path.join(dist,'index.html'),'utf8');
const version=html.match(/id="build-version">([a-f0-9]{12})</)?.[1];
assert.ok(version,'local build version');
const files=[];
async function visit(relative=''){for(const entry of await readdir(path.join(dist,relative),{withFileTypes:true})){const name=path.posix.join(relative,entry.name);if(entry.isDirectory())await visit(name);else if(entry.isFile())files.push(name);else throw Error('unexpected file type '+name);}}
await visit();
const results=[];
for(const file of files.sort()){
 const url=new URL(file,root);url.searchParams.set('verify',version);
 const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(20000)});
 assert.equal(response.status,200,file+' public status');
 const actual=Buffer.from(await response.arrayBuffer());
 const expected=await readFile(path.join(dist,file));
 assert.deepEqual(actual,expected,file+' published bytes');
 results.push({file,status:response.status,bytes:actual.length,sha256:createHash('sha256').update(actual).digest('hex')});
}
await writeFile(output,JSON.stringify({url:root,version,verifiedAt:new Date().toISOString(),files:results},null,2)+'\n');
console.log(JSON.stringify({url:root,version,files:results.length,passed:true}));
