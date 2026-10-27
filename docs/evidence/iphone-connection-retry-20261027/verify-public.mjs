import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(process.argv[2]);
const output=process.argv[3];
const base='https://kangseokgyu.github.io/bean-pocket/';
const html=await readFile(join(root,'index.html'),'utf8');
const version=html.match(/id="build-version">([^<]+)/)?.[1];
assert.ok(version);
async function list(dir,prefix='') { const files=[];for(const e of await readdir(dir,{withFileTypes:true})){const rel=prefix+e.name;if(e.isDirectory())files.push(...await list(join(dir,e.name),rel+'/'));else if(e.isFile())files.push(rel);}return files;}
const files=await list(root);
const results=[];
for(const file of files){const response=await fetch(base+file+'?verify='+version);assert.equal(response.status,200,file);assert.deepEqual(Buffer.from(await response.arrayBuffer()),await readFile(join(root,file)),file);results.push({file,status:200,identical:true});}
const report={url:base,version,checkedAt:new Date().toISOString(),files:results,iphoneVerified:false,liveNotionVerified:false};
await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({url:base,version,fileCount:results.length,allIdentical:true}));
