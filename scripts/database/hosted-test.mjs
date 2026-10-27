import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
const project=process.env.DATABASE_TEST_PROJECT_REF;
if(project!=='fpbefabsqryxmnmxufjw')throw new Error('Explicit Dolend test project required');
const exec=promisify(execFile);
const cli=async(...args)=>(await exec('node_modules/.bin/supabase',args,{timeout:120000,maxBuffer:1024*1024})).stdout;
const keys=JSON.parse(await cli('projects','api-keys','--project-ref',project,'--output','json'));
const url=`https://${project}.supabase.co`,anon=keys.find(k=>k.name==='anon').api_key;
const admin=createClient(url,keys.find(k=>k.name==='service_role').api_key,{auth:{persistSession:false,autoRefreshToken:false}});
const statePath='.env.database-state.json';let state;
try{state=JSON.parse(await readFile(statePath,'utf8'));}catch{ /* No existing fixture. */ }
const save=()=>writeFile(statePath,JSON.stringify(state),{mode:0o600});
const ok=(response,action)=>{if(response.error)throw new Error(`${action}: ${response.error.message}`);return response.data;};
const rpc=async(name,args)=>ok(await admin.rpc(name,args),name);
const cleanup=async()=>{
 if(!state)return;
 assert.equal(state.project,project);
 for(const id of state.events){ const event=ok(await admin.from('events').select('description').eq('id',id).maybeSingle(),'verify fixture event'); if(event)assert.equal(event.description,state.runId); }
 const uuid=value=>{assert.match(value,/^[0-9a-f-]{36}$/);return `'${value}'::uuid`;};
 const events=state.events.length?state.events.map(uuid).join(','):'null::uuid';
 const businessUsers=state.businessUsers.length?state.businessUsers.map(uuid).join(','):'null::uuid';
 const users=state.users.length?state.users.map(u=>uuid(u.id)).join(','):'null::uuid';
 const sql=`begin;
 create temporary table dolend_test_cleanup_ids(id uuid primary key) on commit drop;
 insert into dolend_test_cleanup_ids select id from public.events where id in (${events});
 insert into dolend_test_cleanup_ids select id from public.event_participants where event_id in (${events});
 insert into dolend_test_cleanup_ids select id from public.invoices where participant_id in (select id from dolend_test_cleanup_ids);
 insert into dolend_test_cleanup_ids select id from public.payment_attempts where invoice_id in (select id from dolend_test_cleanup_ids);
 insert into dolend_test_cleanup_ids select id from public.refunds where invoice_id in (select id from dolend_test_cleanup_ids);
 delete from public.audit_logs where entity_id in (select id from dolend_test_cleanup_ids);
 delete from public.outbox_jobs where aggregate_id in (select id from dolend_test_cleanup_ids);
 delete from public.payment_evidence where attempt_id in (select id from dolend_test_cleanup_ids);
 delete from public.payment_ledger where invoice_id in (select id from dolend_test_cleanup_ids);
 delete from public.refunds where invoice_id in (select id from dolend_test_cleanup_ids);
 delete from public.payment_attempts where invoice_id in (select id from dolend_test_cleanup_ids);
 delete from public.invoices where participant_id in (select id from dolend_test_cleanup_ids);
 delete from public.participant_history where participant_id in (select id from dolend_test_cleanup_ids);
 delete from public.guest_sessions where scope_event_id in (${events});
 delete from public.event_invites where event_id in (${events});
 delete from public.event_participants where event_id in (${events});
 delete from public.event_payment_methods where event_id in (${events});
 delete from public.events where id in (${events});
 delete from public.profiles where id in (${users});
 delete from public.users where id in (${businessUsers});
 commit;`;
 const path='.env.database-cleanup.sql';await writeFile(path,sql,{mode:0o600});
 try{await cli('db','query','--linked','--project-ref',project,'--file',path,'--output','json');}finally{await unlink(path).catch(()=>{});}
 for(const user of state.users){
  if(user.deleted)continue;
  const current=ok(await admin.auth.admin.getUserById(user.id),'verify fixture identity').user;
  assert.equal(current.app_metadata.dolend_schema_fixture,state.runId);
  ok(await admin.auth.admin.deleteUser(user.id),'delete fixture user');user.deleted=true;await save();
 }
 await unlink(statePath);state=null;
 console.log('PASS scoped fixture cleanup; schema and category seeds retained');
};
if(process.argv[2]==='cleanup'){await cleanup();process.exit(0);}
assert(!state,'Existing fixture state. Run cleanup before starting another run.');
state={runId:randomUUID(),project,events:[],businessUsers:[],users:[]};await save();
const report={date:'2026-10-27',project,checks:[]};
const record=name=>{report.checks.push(name);console.log(`PASS ${name}`);};
const newPhone=()=>`62819${randomBytes(6).readUIntBE(0,6).toString().slice(0,9).padEnd(9,'0')}`;
try{
 const users=[];
 for(let n=0;n<2;n++){
  const email=`schema-${randomUUID()}@dolend.example`,password=randomBytes(32).toString('base64url'),phone=newPhone();
  const user=ok(await admin.auth.admin.createUser({email,password,phone,phone_confirm:true,email_confirm:true,app_metadata:{dolend_schema_fixture:state.runId}}),'create fixture user').user;
  state.users.push({id:user.id});await save();
  const domainUser=ok(await admin.from('users').insert({display_name:'Dolend schema fixture',phone_normalized:phone,phone_verified_at:new Date().toISOString()}).select('id').single(),'create business user');
  state.businessUsers.push(domainUser.id);await save();
  ok(await admin.from('profiles').insert({id:user.id,user_id:domainUser.id}),'create profile');
  const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  ok(await client.auth.signInWithPassword({email,password}),'login fixture');
  users.push({id:user.id,userId:domainUser.id,client});
 }
 const [owner,member]=users;
 const activity=ok(await admin.from('activity_types').select('id').eq('slug','walking').single(),'category');
 const makeEvent=async(mode,capacity,visibility='unlisted',holdMinutes=15)=>{
  const now=Date.now();
  const event=ok(await admin.from('events').insert({organizer_profile_id:owner.id,activity_type_id:activity.id,title:'Dolend schema fixture',description:state.runId,
   venue_snapshot:{name:'Fixture venue',address:'Fixture only',maps_url:'https://www.google.com/maps/search/?api=1&query=Jakarta'},
   starts_at:new Date(now+86400000).toISOString(),ends_at:new Date(now+90000000).toISOString(),registration_closes_at:new Date(now+80000000).toISOString(),
   capacity,visibility,payment_mode:mode,price_amount:mode==='free'?0:10000,payment_due_at:new Date(now+172800000).toISOString(),hold_minutes:holdMinutes}).select('id').single(),'create fixture event');
  state.events.push(event.id);await save();
  const method=ok(await admin.from('event_payment_methods').insert({event_id:event.id,method_type:'qris',provider:'fixture',provider_method:'qris'}).select('id').single(),'fixture method');
  ok(await admin.from('events').update({status:'published'}).eq('id',event.id),'publish fixture');
  return {...event,method:method.id};
 };
 const late=await makeEvent('before_event',1,'unlisted',1);
 const lateP=await rpc('join_event',{p_event_id:late.id,p_user_id:member.userId,p_actor_profile_id:member.id});
 const lateI=ok(await admin.from('invoices').select('id').eq('participant_id',lateP.id).single(),'late invoice');
 const lateA=await rpc('create_payment_attempt',{p_invoice_id:lateI.id,p_method_id:late.method,p_key:'late',p_actor_profile_id:member.id});
 ok(await admin.from('payment_attempts').update({provider_reference:`late-${state.runId}`}).eq('id',lateA.id),'provider reference');
 const free=await makeEvent('free',5,'public');
 const guests=[];
 for(let n=0;n<20;n++){
  const domainUser=ok(await admin.from('users').insert({display_name:'Fixture guest',phone_normalized:newPhone(),phone_verified_at:new Date().toISOString()}).select('id').single(),'guest business user');
  state.businessUsers.push(domainUser.id);await save();
  const hash=createHash('sha256').update(randomBytes(32)).digest('hex');
  ok(await admin.from('guest_sessions').insert({user_id:domainUser.id,scope_event_id:free.id,token_hash:hash,expires_at:new Date(Date.now()+3600000).toISOString()}),'guest session');
  guests.push({userId:domainUser.id,hash});
 }
 const joinArgs=guest=>({p_event_id:free.id,p_user_id:guest.userId,p_guest_session_hash:guest.hash});
 const joins=await Promise.all(guests.map(guest=>admin.rpc('join_event',joinArgs(guest))));
 const winners=joins.map((result,index)=>({result,index})).filter(x=>!x.result.error);
 assert.equal(winners.length,5);assert(joins.filter(r=>r.error).every(r=>r.error.message==='EVENT_FULL'));
 const rows=ok(await admin.from('event_participants').select('*').eq('event_id',free.id),'roster');assert.equal(rows.length,5);record('20 hosted joins for 5 seats: exactly 5 confirmations and 15 EVENT_FULL');
 const winner=guests[winners[0].index],winningP=winners[0].result.data;
 const duplicate=await Promise.all(Array.from({length:10},()=>admin.rpc('join_event',joinArgs(winner))));
 assert(duplicate.every(result=>!result.error&&result.data.id===winningP.id));record('10 concurrent join retries retain one participant');
 assert((await admin.from('events').update({capacity:4}).eq('id',free.id)).error);record('capacity cannot shrink below occupied seats');
 await rpc('cancel_participation',{p_participant_id:winningP.id,p_reason:'fixture',p_guest_session_hash:winner.hash});
 const loser=guests[joins.findIndex(r=>r.error)];await rpc('join_event',joinArgs(loser));
 assert.equal(ok(await admin.from('event_participants').select('id').eq('event_id',free.id).eq('status','confirmed'),'roster after replacement').length,5);record('cancellation releases one seat and replacement preserves capacity');
 const paid=await makeEvent('before_event',1);
 const paidP=await rpc('join_event',{p_event_id:paid.id,p_user_id:member.userId,p_actor_profile_id:member.id});
 const paidI=ok(await admin.from('invoices').select('id').eq('participant_id',paidP.id).single(),'invoice');
 const attempt=await rpc('create_payment_attempt',{p_invoice_id:paidI.id,p_method_id:paid.method,p_key:'gateway',p_actor_profile_id:member.id});
 const reference=`payment-${state.runId}`;
 ok(await admin.from('payment_attempts').update({provider_reference:reference}).eq('id',attempt.id),'reference');
 assert((await admin.from('payment_attempts').update({status:'succeeded'}).eq('id',attempt.id)).error);record('success status requires matching ledger receipt');
 const paymentArgs={p_attempt_id:attempt.id,p_provider:'fixture',p_provider_reference:reference,p_amount:10000,p_currency:'IDR'};
 const wrong=await admin.rpc('apply_provider_payment',{...paymentArgs,p_amount:999});assert(wrong.error);record('wrong provider amount rejected');
 const receipts=await Promise.all(Array.from({length:20},()=>admin.rpc('apply_provider_payment',paymentArgs)));
 assert(receipts.every(r=>!r.error&&r.data.status==='succeeded'));
 assert.equal(ok(await admin.from('payment_ledger').select('id').eq('attempt_id',attempt.id).eq('entry_type','receipt'),'receipts').length,1);
 assert.equal(ok(await admin.from('event_participants').select('status').eq('id',paidP.id).single(),'paid roster').status,'confirmed');record('20 concurrent provider callbacks: one receipt and one confirmed seat');
 const refund=await rpc('request_refund',{p_attempt_id:attempt.id,p_actor_profile_id:owner.id,p_amount:10000,p_reason:'fixture',p_key:'refund'});
 const refunds=await Promise.all(Array.from({length:10},()=>admin.rpc('record_refund',{p_refund_id:refund.id,p_actor_profile_id:owner.id,p_reference:`refund-${state.runId}`})));
 assert(refunds.every(r=>!r.error&&r.data.status==='succeeded'));assert.equal(ok(await admin.from('payment_ledger').select('id').eq('attempt_id',attempt.id).eq('entry_type','refund'),'refunds').length,1);record('10 concurrent refund confirmations create one refund ledger entry');
 const over=await admin.rpc('request_refund',{p_attempt_id:attempt.id,p_actor_profile_id:owner.id,p_amount:1,p_reason:'over',p_key:'over'});assert(over.error);record('refund cannot exceed original receipt');
 assert.equal(ok(await member.client.from('users').select('id'),'member RLS').length,1);
 assert.equal(ok(await member.client.from('users').select('id').eq('id',owner.userId),'cross business user').length,0);
 assert.equal(ok(await owner.client.from('invoices').select('id').eq('id',paidI.id),'organizer invoice').length,1);
 assert.equal(ok(await member.client.from('invoices').select('id').eq('id',paidI.id),'participant invoice').length,1);
 assert((await member.client.from('payment_ledger').update({amount:1}).eq('attempt_id',attempt.id)).error);
 assert((await member.client.rpc('join_event',{p_event_id:free.id,p_user_id:member.userId,p_actor_profile_id:member.id})).error);record('member/organizer RLS, cross-user privacy, ledger write denial and privileged RPC denial');
 const publicClient=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const projection=ok(await publicClient.from('public_events').select('*'),'public projection');assert(projection.some(row=>row.id===free.id));assert(!projection.some(row=>row.id===paid.id));
 assert((await publicClient.from('users').select('id')).error);record('anonymous projection hides unlisted events and private identity tables');
 const remaining=new Date(lateP.hold_expires_at).getTime()-Date.now()+300;
 if(remaining>0){console.log(`Waiting ${Math.ceil(remaining/1000)}s for genuine fixture hold expiry (no trigger bypass).`);await new Promise(resolve=>setTimeout(resolve,remaining));}
 assert.equal(await rpc('expire_holds',{p_event_id:late.id}),1);assert.equal(await rpc('expire_holds',{p_event_id:late.id}),0);
 await rpc('join_event',{p_event_id:late.id,p_user_id:owner.userId,p_actor_profile_id:owner.id});
 const latePaid=await rpc('apply_provider_payment',{p_attempt_id:lateA.id,p_provider:'fixture',p_provider_reference:`late-${state.runId}`,p_amount:10000,p_currency:'IDR'});
 assert.equal(latePaid.exception_reason,'late_payment_no_seat');assert.equal(latePaid.status,'succeeded');
 const lateRows=ok(await admin.from('event_participants').select('status').eq('event_id',late.id),'late roster');assert.equal(lateRows.filter(p=>p.status==='held'||p.status==='confirmed').length,1);record('real hold expiry is idempotent; late paid receipt recorded without overbooking');
 report.status='passed';
}catch(error){report.status='failed';report.failure=error.message;console.error('FAIL',error.message);process.exitCode=1;}
finally{
 try{await cleanup();report.cleanup_verified=true;}catch(error){report.cleanup_verified=false;report.cleanup_failure=error.message;console.error('CLEANUP FAILED; retain ignored state for retry:',error.message);process.exitCode=1;}
 await writeFile('docs/database-hosted-results.json',JSON.stringify(report,null,2)+'\n');
}
