// Additional negative Storage/RLS checks for the currently prepared POC fixture.
import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createClient } from '@supabase/supabase-js';
const state = JSON.parse(await readFile('.env.poc-state.json', 'utf8'));
if (process.env.POC_PROJECT_REF !== state.project || state.project !== 'fpbefabsqryxmnmxufjw') throw new Error('Explicit Dolend project required.');
const exec = promisify(execFile);
const result = await exec('node_modules/.bin/supabase', ['projects','api-keys','--project-ref',state.project,'--output','json'], { timeout: 120000 });
const key = JSON.parse(result.stdout).find((entry)=>entry.name==='anon').api_key;
const url=`https://${state.project}.supabase.co`;
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const { data, error } = await client.auth.signInWithPassword(state.users[0]);
if(error) throw new Error('Fixture login failed');
const bearer=data.session.access_token;
const checks=[];
for(const [name,blob] of [['wrong MIME',new Blob(['fixture'],{type:'application/octet-stream'})],['oversize',new Blob(['x'.repeat(65537)],{type:'text/plain'})]]){
  const form=new FormData();form.append('file',blob,'fixture.txt');
  const response=await fetch(`${url}/functions/v1/dolend-compat-poc/v1/upload`,{method:'POST',headers:{'x-poc-token':state.token,Authorization:`Bearer ${bearer}`},body:form,signal:AbortSignal.timeout(30000)});
  if(response.status!==400) throw new Error(`${name} not rejected: ${response.status}`);
  await response.text();checks.push(`${name} rejected`);
}
const other=state.users[1].id;
const write=await client.storage.from('dolend-compat-poc').upload(`${other}/impersonation.txt`,new Blob(['fixture'],{type:'text/plain'}));
if(!write.error) throw new Error('Cross-user upload accepted');
checks.push('cross-user upload denied');
const anonymous=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const rpc=await anonymous.rpc('dolend_poc_increment',{p_run_id:state.runId});
if(!rpc.error) throw new Error('Anonymous RPC accepted');
checks.push('anonymous RPC denied');
const signed=await client.storage.from('dolend-compat-poc').createSignedUrl(state.paths[0],1);
if(signed.error) throw new Error('Short-lived URL creation failed');
const expiresAt=Date.now()+2200;
// Keep the bounded expiry wait inside this short check; never log the signed URL.
await new Promise(resolve=>setTimeout(resolve,Math.max(0,expiresAt-Date.now())));
const expired=await fetch(signed.data.signedUrl,{signal:AbortSignal.timeout(30000)});
if(expired.ok) throw new Error('Expired signed URL accepted');
await expired.text();checks.push('expired signed download denied');
const report=JSON.parse(await readFile('docs/poc-hosted-results.json','utf8'));
report.checks.push(...checks);
await writeFile('docs/poc-hosted-results.json',JSON.stringify(report,null,2)+'\n');
console.log(checks.map(check=>`PASS ${check}`).join('\n'));
