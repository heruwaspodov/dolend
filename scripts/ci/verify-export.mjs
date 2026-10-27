import { readFile, readdir, stat } from 'node:fs/promises';
import assert from 'node:assert/strict';
assert.notEqual(process.env.NEXT_PUBLIC_POC_EVENT_FIXTURES, 'true', 'POC adapter must be disabled for production');
const config=JSON.parse(await readFile('firebase.json','utf8'));
const rc=JSON.parse(await readFile('.firebaserc','utf8'));
assert.equal(config.hosting.public,'out');assert.equal(config.hosting.target,'web');
assert.deepEqual(rc.targets['dolend-apps'].hosting.web,['dolend']);
for(const route of ['index.html','event/index.html','auth/callback/index.html','payment/index.html'])assert((await stat(`out/${route}`)).isFile(),`Missing shell ${route}`);
async function inspect(directory){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  assert(!entry.isSymbolicLink(),'Symlinks are not permitted in release artifacts');
  assert(!/^(__poc|\.env.*|gha-creds-.*|node_modules|\.git)$/.test(entry.name),`Forbidden release entry ${entry.name}`);
  if(entry.isDirectory())await inspect(`${directory}/${entry.name}`);
 }
}
await inspect('out');
const html=await readFile('out/index.html','utf8');
assert(html.includes('Dolend'),'Wrong landing export');
assert(!html.includes('cdn.tailwindcss.com')&&!html.includes('unpkg.com/lucide'),'Runtime CDN scripts are not allowed');
if(process.env.GITHUB_SHA){const release=JSON.parse(await readFile('out/release.json','utf8'));assert.equal(release.commit,process.env.GITHUB_SHA);}
console.log('Verified normal static export, route shells, release provenance and exact Firebase target.');
