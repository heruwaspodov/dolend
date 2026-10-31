import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createClient} from '@supabase/supabase-js';
const project=process.env.DATABASE_TEST_PROJECT_REF;
assert.equal(project,'fpbefabsqryxmnmxufjw');
const exec=promisify(execFile);
const cli=async(...args)=>(await exec('node_modules/.bin/supabase',args,{timeout:120000,maxBuffer:1024*1024})).stdout;
const keys=JSON.parse(await cli('projects','api-keys','--project-ref',project,'--output','json'));
const anon=keys.find(k=>k.name==='anon').api_key;
const service=keys.find(k=>k.name==='service_role').api_key;
const url=`https://${project}.supabase.co`;
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(url,service,options);
const users=[];const objects=[];const directory=await mkdtemp(join(tmpdir(),'dolend-storage-'));
const ok=result=>{if(result.error)throw new Error(result.error.message);return result.data;};
async function fixture(){
 const email=`finance-${randomUUID()}@example.invalid`;const password=randomBytes(32).toString('hex');
 const user=ok(await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{provider:'google',providers:['google']}})).user;
 users.push(user.id);
 ok(await admin.auth.admin.updateUserById(user.id,{app_metadata:{provider:'google',providers:['google']}}));
 const client=createClient(url,anon,options);const session=ok(await client.auth.signInWithPassword({email,password})).session;
 return session.access_token;
}
async function request(path,token,method='GET',body){return fetch(`${url}/functions/v1/dolend-api/v1${path}`,{method,headers:{apikey:anon,authorization:`Bearer ${token}`,'content-type':body instanceof Uint8Array?'image/png':'application/json'},body:body instanceof Uint8Array?body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});}
try{
 const owner=await fixture(),other=await fixture();
 const empty=await request('/profile/bootstrap',owner,'POST');assert.equal(empty.status,400,'empty JSON must be rejected safely');
 for(const token of [owner,other]){const r=await request('/profile/bootstrap',token,'POST',{});assert.equal(r.status,201,await r.text());}
 const image=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'));
 let r=await request('/payment-settings/qris-image',owner,'POST',image);let payload=await r.json();assert.equal(r.status,200,JSON.stringify(payload));const path=payload.data.storage_path;objects.push(path);
 r=await request('/payment-settings',owner,'POST',{type:'static_qris',recipient_name:'Synthetic fixture',storage_path:path});payload=await r.json();assert.equal(r.status,200,JSON.stringify(payload));const method=payload.data.id;
 r=await request(`/payment-settings/${method}`,other,'PATCH',{is_active:false});assert.equal(r.status,403);
 const publicFile=await fetch(`${url}/storage/v1/object/public/dolend-payments/${path}`);assert.notEqual(publicFile.status,200);
 r=await request(`/payment-settings/${method}`,owner,'PATCH',{is_active:false});assert.equal(r.status,200);
 console.log('PASS hosted authenticated QRIS upload, method save/disable, cross-owner denial and private object');
 await writeFile('docs/manual-storage-hosted-results.json',JSON.stringify({date:'2026-10-31',project,passed:true,scope:'Synthetic Google-metadata fixture sessions; QRIS upload/save/disable, cross-owner denial, private object; not real Google OAuth or financial E2E'},null,2)+'\n');
}catch(error){console.error('Hosted storage test:',error.message);throw error;}finally{
 if(objects.length)ok(await admin.storage.from('dolend-payments').remove(objects));
 if(users.length){
  const ids=users.map(id=>`'${id}'`).join(',');
  const sql=`begin; delete from public.organizer_payment_methods where organizer_id in (${ids}); delete from public.workspace_members where workspace_id in (select id from public.workspaces where created_by_profile_id in (${ids})); delete from public.workspaces where created_by_profile_id in (${ids}); with removed as (delete from public.profiles where id in (${ids}) returning user_id) delete from public.users where id in (select user_id from removed); commit;`;
  const file=join(directory,'cleanup.sql');await writeFile(file,sql,{mode:0o600});await cli('db','query','--linked','--project-ref',project,'--file',file,'--output','json');
  for(const id of users)ok(await admin.auth.admin.deleteUser(id));
 }
 await rm(directory,{recursive:true,force:true});
}

const report=JSON.parse(await readFile('docs/manual-storage-hosted-results.json','utf8'));
report.cleanup_verified=true;
await writeFile('docs/manual-storage-hosted-results.json',JSON.stringify(report,null,2)+'\n');
