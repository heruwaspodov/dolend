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
const users=[];const objects=[];const events=[];const workspaces=[];const businessUsers=[];const directory=await mkdtemp(join(tmpdir(),'dolend-storage-'));
const ok=result=>{if(result.error)throw new Error(result.error.message);return result.data;};
async function fixture(){
 const email=`finance-${randomUUID()}@example.invalid`;const password=randomBytes(32).toString('hex');
 const user=ok(await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{provider:'google',providers:['google']}})).user;
 users.push(user.id);
 ok(await admin.auth.admin.updateUserById(user.id,{app_metadata:{provider:'google',providers:['google']}}));
 const client=createClient(url,anon,options);const session=ok(await client.auth.signInWithPassword({email,password})).session;
 return session.access_token;
}
async function request(path,{token,bookingToken,method='GET',body}={}){
 const headers={apikey:anon,authorization:`Bearer ${token??anon}`,'content-type':body instanceof Uint8Array?'image/png':'application/json'};
 if(bookingToken)headers['x-booking-token']=bookingToken;
 return fetch(`${url}/functions/v1/dolend-api/v1${path}`,{method,headers,body:body instanceof Uint8Array?body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
}
async function payload(response){const value=await response.json();assert(response.ok,`${response.status}: ${JSON.stringify(value)}`);return value.data;}
const phone=()=>`0812${String(randomBytes(4).readUInt32BE()%100000000).padStart(8,'0')}`;
const jakartaDate=()=>{
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(part=>[part.type,part.value]));
 return `${parts.year}-${parts.month}-${parts.day}`;
};
try{
 const owner=await fixture(),other=await fixture();
 const empty=await request('/profile/bootstrap',{token:owner,method:'POST'});assert.equal(empty.status,400,'empty JSON must be rejected safely');
 for(const token of [owner,other]){const r=await request('/profile/bootstrap',{token,method:'POST',body:{}});assert.equal(r.status,201,await r.text());}
 for(const authUser of users){const profile=ok(await admin.from('profiles').select('user_id').eq('id',authUser).single());businessUsers.push(profile.user_id);}
 const workspaceRows=ok(await admin.from('workspaces').select('id,created_by_profile_id').in('created_by_profile_id',users));workspaces.push(...workspaceRows.map(row=>row.id));
 const ownerWorkspace=workspaceRows.find(row=>row.created_by_profile_id===users[0]);assert(ownerWorkspace,'owner workspace was not bootstrapped');
 const image=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'));
 let r=await request('/payment-settings/qris-image',{token:owner,method:'POST',body:image});const qris=await payload(r);const path=qris.storage_path;objects.push(path);
 const stagedQris=ok(await admin.from('private_uploads').select('purpose,content_type,size_bytes,attached_at').eq('storage_reference',path).single());
 assert.equal(stagedQris.purpose,'qris');assert.equal(stagedQris.content_type,'image/png');assert.equal(Number(stagedQris.size_bytes),image.byteLength);assert.equal(stagedQris.attached_at,null);
 r=await request('/payment-settings',{token:owner,method:'POST',body:{type:'static_qris',recipient_name:'Synthetic fixture',storage_path:path}});const method=(await payload(r)).id;
 assert(ok(await admin.from('private_uploads').select('attachment_type,attachment_id,attached_at').eq('storage_reference',path).single()).attached_at,'QRIS upload was not attached');
 r=await request(`/payment-settings/${method}`,{token:other,method:'PATCH',body:{is_active:false}});assert.equal(r.status,403);
 const publicFile=await fetch(`${url}/storage/v1/object/public/dolend-payments/${path}`);assert.notEqual(publicFile.status,200);
 const activity=(await payload(await request('/activity-types')))[0];
 const now=Date.now();
 const event=await payload(await request('/events',{token:owner,method:'POST',body:{workspace_id:ownerWorkspace.id,activity_type_id:activity.id,title:'Hosted guest proof fixture',description:'Temporary hosted Storage verification',starts_at:new Date(now+86400000).toISOString(),ends_at:new Date(now+90000000).toISOString(),registration_closes_at:new Date(now+43200000).toISOString(),timezone:'Asia/Jakarta',capacity:4,estimated_total_cost:120000,payment_timing:'before_event',venue_snapshot:{name:'Fixture venue',address:'Temporary test only',maps_url:'',latitude:-6.2,longitude:106.816666,meeting_instructions:'Meet at the main lobby'}}}));
 events.push(event.id);
 const hostedEvent=await payload(await request(`/organizer/events/${event.id}`,{token:owner}));
 assert.equal(hostedEvent.venue.latitude,-6.2);assert.equal(hostedEvent.venue.longitude,106.816666);assert.equal(hostedEvent.venue.meeting_instructions,'Meet at the main lobby');assert(hostedEvent.venue.maps_url.includes('query=-6.2%2C106.816666'));
 r=await request(`/events/${event.id}/planning`,{token:owner,method:'PATCH',body:{expected_version:hostedEvent.version,venue_snapshot:{name:'Fixture venue',address:'Temporary test only',maps_url:'https://evil.example/maps'}}});assert.equal(r.status,422,'foreign Maps URL accepted');
 const editedEvent=await payload(await request(`/events/${event.id}/planning`,{token:owner,method:'PATCH',body:{expected_version:hostedEvent.version,venue_booking_status:'pending'}}));
 assert.equal(editedEvent.version,hostedEvent.version+1,'event version did not advance');
 r=await request(`/events/${event.id}/planning`,{token:owner,method:'PATCH',body:{expected_version:hostedEvent.version,venue_booking_status:'booked'}});const stalePayload=await r.json();assert.equal(r.status,409,`stale event edit did not conflict: ${JSON.stringify(stalePayload)}`);assert.equal(stalePayload.error.code,'VERSION_CONFLICT');
 r=await request(`/events/${event.id}/planning`,{token:other,method:'PATCH',body:{expected_version:editedEvent.version,venue_booking_status:'booked'}});assert.equal(r.status,403,'another organizer edited event');
 const eventAudit=ok(await admin.from('audit_logs').select('action,redacted_changes').eq('entity_id',event.id).eq('action','event.edit').single());
 assert.deepEqual(eventAudit.redacted_changes.fields,['venue_booking_status']);assert.equal(eventAudit.redacted_changes.from_version,hostedEvent.version);assert.equal(eventAudit.redacted_changes.to_version,editedEvent.version);
 await payload(await request(`/events/${event.id}/payment-methods`,{token:owner,method:'POST',body:{method_id:method,enabled:true}}));
 const booking=await payload(await request(`/events/${event.id}/guest-bookings`,{method:'POST',body:{display_name:'Hosted guest proof',whatsapp:phone()}}));
 const guest=ok(await admin.from('event_participants').select('user_id').eq('id',booking.participant_id).single());businessUsers.push(guest.user_id);
 const locks=await Promise.all(Array.from({length:10},()=>request(`/events/${event.id}/contributions/lock`,{token:owner,method:'POST',body:{}}).then(payload)));
 assert(locks.every(value=>Number(value)===120000),'concurrent locks returned different contribution amounts');
 const bookingStatus=await payload(await request(`/events/${event.id}/guest-bookings/me`,{bookingToken:booking.booking_token}));
 assert(bookingStatus.charge_id,'locked guest booking must expose a charge');
 const charge=bookingStatus.charge_id;
 r=await request(`/charges/${charge}/proof`,{bookingToken:booking.booking_token,method:'POST',body:image});const proof=(await payload(r)).storage_path;objects.push(proof);
 const stagedProof=ok(await admin.from('private_uploads').select('purpose,charge_id,attached_at').eq('storage_reference',proof).single());assert.equal(stagedProof.purpose,'payment_proof');assert.equal(stagedProof.charge_id,charge);assert.equal(stagedProof.attached_at,null);
 const invalidToken=randomBytes(32).toString('base64url');
 r=await request(`/charges/${charge}/proof`,{bookingToken:invalidToken,method:'POST',body:image});assert.equal(r.status,403,'another guest token uploaded proof');
 const idempotencyKey=`hosted-proof-${randomUUID()}`;
 const payments=await Promise.all(Array.from({length:10},()=>request(`/charges/${charge}/payments`,{bookingToken:booking.booking_token,method:'POST',body:{method_id:method,amount:120000,idempotency_key:idempotencyKey,proof_storage_path:proof}}).then(payload)));
 const payment=payments[0];assert(payments.every(row=>row.id===payment.id&&row.status==='pending_verification'),'concurrent payment retries diverged');
 const attachedProof=ok(await admin.from('private_uploads').select('attachment_type,attachment_id,attached_at').eq('storage_reference',proof).single());assert.equal(attachedProof.attachment_id,payment.id);assert(attachedProof.attached_at,'proof upload was not attached');
 r=await request(`/events/${event.id}/payment-reviews`,{token:other});assert.equal(r.status,403,'another organizer read payment proof');
 const reviews=await payload(await request(`/events/${event.id}/payment-reviews`,{token:owner}));
 const review=reviews.find(row=>row.id===payment.id);assert(review?.proof_url,'owner review must contain a signed proof URL');
 const signedProof=await fetch(review.proof_url);assert.equal(signedProof.status,200,'signed proof URL must be readable');
 const shortUrl=ok(await admin.storage.from('dolend-payments').createSignedUrl(proof,1)).signedUrl;
 await new Promise(resolve=>setTimeout(resolve,2100));
 assert.notEqual((await fetch(shortUrl)).status,200,'expired signed proof URL remained readable');
 const publicProof=await fetch(`${url}/storage/v1/object/public/dolend-payments/${proof}`);assert.notEqual(publicProof.status,200,'proof object became public');
 const verified=await Promise.all(Array.from({length:10},()=>request(`/payments/${payment.id}/review`,{token:owner,method:'POST',body:{decision:'verified',reason:'Hosted concurrent verification'}}).then(payload)));
 assert(verified.every(row=>row.id===payment.id&&row.status==='verified'),'concurrent reviews diverged');
 const receipts=ok(await admin.from('contribution_ledger').select('id').eq('payment_id',payment.id).eq('entry_type','receipt'));
 assert.equal(receipts.length,1,'concurrent reviews created duplicate receipts');
 r=await request(`/payment-settings/${method}`,{token:owner,method:'PATCH',body:{is_active:false}});assert.equal(r.status,200);
 r=await request('/payment-settings/qris-image',{token:owner,method:'POST',body:image});const orphan=(await payload(r)).storage_path;objects.push(orphan);
 ok(await admin.from('private_uploads').update({expires_at:new Date(Date.now()-60000).toISOString()}).eq('storage_reference',orphan));
 const cleanupResponse=await fetch(`${url}/functions/v1/dolend-api/v1/internal/storage/orphans/cleanup`,{method:'POST',headers:{apikey:service,authorization:`Bearer ${service}`},signal:AbortSignal.timeout(30000)});
 const cleanup=await payload(cleanupResponse);assert(cleanup.deleted>=1,'expired orphan was not deleted');
 assert.equal(ok(await admin.from('private_uploads').select('storage_reference').eq('storage_reference',orphan)).length,0,'orphan registry row survived cleanup');
 assert.equal((await admin.storage.from('dolend-payments').download(orphan)).data,null,'orphan object survived cleanup');
 console.log('PASS hosted private lifecycle, expired URL/orphan cleanup, real guest-token proof flow, and concurrent lock/report/review with one receipt');
 await writeFile('docs/manual-storage-hosted-results.json',JSON.stringify({date:jakartaDate(),project,passed:true,scope:'Supabase Storage lifecycle, venue, and versioned event-edit API with synthetic Google-metadata organizer sessions and real guest booking token; staging/atomic attachment, expired signed URL denial, 24-hour orphan claim/delete, optimistic conflict/audit/cross-owner denial, coordinate snapshot/Maps URL generation/foreign-host denial, QRIS upload/save/disable, guest proof upload/report/review, 10 concurrent lock/report/review requests with one payment and receipt, cross-token denial, private objects; not real Google OAuth'},null,2)+'\n');
}catch(error){console.error('Hosted storage test:',error.message);throw error;}finally{
 if(objects.length){ok(await admin.storage.from('dolend-payments').remove(objects));ok(await admin.from('private_uploads').delete().in('storage_reference',objects));}
 if(users.length){
  const ids=users.map(id=>`'${id}'::uuid`).join(',');
  const eventIds=events.length?events.map(id=>`'${id}'::uuid`).join(','):'null::uuid';
  const workspaceIds=workspaces.length?workspaces.map(id=>`'${id}'::uuid`).join(','):'null::uuid';
  const domainIds=businessUsers.length?[...new Set(businessUsers)].map(id=>`'${id}'::uuid`).join(','):'null::uuid';
  const ratePredicate=events.length?events.map(id=>`bucket_key like 'guest-booking:%:${id}:%'`).join(' or '):'false';
  const sql=`begin;
create temporary table dolend_storage_cleanup_ids(id uuid primary key) on commit drop;
insert into dolend_storage_cleanup_ids select id from public.events where id in (${eventIds});
insert into dolend_storage_cleanup_ids select id from public.event_participants where event_id in (${eventIds});
insert into dolend_storage_cleanup_ids select id from public.participant_charges where participant_id in (select id from dolend_storage_cleanup_ids);
insert into dolend_storage_cleanup_ids select id from public.manual_payment_records where charge_id in (select id from dolend_storage_cleanup_ids);
delete from public.audit_logs where entity_id in (select id from dolend_storage_cleanup_ids);
delete from public.contribution_ledger where charge_id in (select id from dolend_storage_cleanup_ids);
delete from public.manual_payment_records where charge_id in (select id from dolend_storage_cleanup_ids);
delete from public.participant_charges where participant_id in (select id from dolend_storage_cleanup_ids);
delete from public.participant_history where participant_id in (select id from dolend_storage_cleanup_ids);
delete from public.guest_sessions where scope_event_id in (${eventIds});
delete from public.rate_limit_counters where ${ratePredicate};
delete from public.manual_event_methods where event_id in (${eventIds});
delete from public.event_organizers where event_id in (${eventIds});
delete from public.event_participants where event_id in (${eventIds});
delete from public.events where id in (${eventIds});
delete from public.organizer_payment_methods where organizer_id in (${ids});
delete from public.workspace_members where workspace_id in (${workspaceIds});
delete from public.workspaces where id in (${workspaceIds});
delete from public.profiles where id in (${ids});
delete from public.users where id in (${domainIds});
commit;`;
  const file=join(directory,'cleanup.sql');await writeFile(file,sql,{mode:0o600});await cli('db','query','--linked','--project-ref',project,'--file',file,'--output','json');
  for(const id of users)ok(await admin.auth.admin.deleteUser(id));
 }
 await rm(directory,{recursive:true,force:true});
}

const report=JSON.parse(await readFile('docs/manual-storage-hosted-results.json','utf8'));
report.cleanup_verified=true;
await writeFile('docs/manual-storage-hosted-results.json',JSON.stringify(report,null,2)+'\n');
