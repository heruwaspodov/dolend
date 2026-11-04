import { createClient } from '@supabase/supabase-js';
import { Elysia, t } from 'elysia';
import { clientAddressFrom, createSupabaseGuestBookingService } from './guest-booking.ts';
import type { GuestBookingService } from './guest-booking.ts';
import type { AccountService } from './account.ts';
import type { ObjectStorageRouter } from './object-storage.ts';
import type { EventInviteService } from './event-invite.ts';
import type { PrivateUploadService } from './private-uploads.ts';

export class FinanceError extends Error {}

const uuid = t.String({ format: 'uuid' });
const amount = t.Integer({ minimum: 0, maximum: 1e12 });
const key = t.String({ minLength: 1, maxLength: 200 });
const reason = t.String({ minLength: 1, maxLength: 1000 });
const venueSnapshot = t.Object({
  name:t.String({maxLength:200}),address:t.String({maxLength:1000}),maps_url:t.String({maxLength:2000}),
  latitude:t.Optional(t.Number({minimum:-90,maximum:90})),longitude:t.Optional(t.Number({minimum:-180,maximum:180})),
  meeting_instructions:t.Optional(t.String({maxLength:1000})),
});
type VenueSnapshot = {name:string;address:string;maps_url:string;latitude?:number;longitude?:number;meeting_instructions?:string};
export function isSafeMapsUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && (url.hostname === 'maps.google.com' || (url.hostname === 'www.google.com' && url.pathname.startsWith('/maps')));
  } catch {
    return false;
  }
}
export function normalizeVenueSnapshot(venue:VenueSnapshot) {
  const hasLatitude=venue.latitude!==undefined,hasLongitude=venue.longitude!==undefined;
  if(hasLatitude!==hasLongitude)throw new FinanceError('INVALID_REQUEST');
  const mapsUrl=venue.maps_url.trim() || (hasLatitude?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.latitude},${venue.longitude}`)}`:'');
  if(!isSafeMapsUrl(mapsUrl))throw new FinanceError('INVALID_REQUEST');
  const instructions=venue.meeting_instructions?.trim();
  return {name:venue.name.trim(),address:venue.address.trim(),maps_url:mapsUrl,...(hasLatitude?{latitude:venue.latitude,longitude:venue.longitude}:{}),...(instructions?{meeting_instructions:instructions}:{})};
}
export async function imageBytes(request: Request):Promise<{bytes:Uint8Array;mime:'image/png'|'image/jpeg';extension:'png'|'jpg'}> {
  const reader = request.body?.getReader();
  if (!reader) throw new FinanceError('INVALID_IMAGE');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2097152) { await reader.cancel(); throw new FinanceError('IMAGE_TOO_LARGE'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const view = new DataView(bytes.buffer);
  const png = size >= 45 && [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v) && view.getUint32(8) === 13 && String.fromCharCode(...bytes.slice(12,16)) === 'IHDR' && view.getUint32(16) > 0 && view.getUint32(16) <= 8192 && view.getUint32(20) > 0 && view.getUint32(20) <= 8192 && String.fromCharCode(...bytes.slice(size-8,size-4)) === 'IEND';
  const jpeg = size >= 64 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes[size-2] === 255 && bytes[size-1] === 217;
  if (!png && !jpeg) throw new FinanceError('INVALID_IMAGE');
  return { bytes, mime: png ? 'image/png' : 'image/jpeg', extension: png ? 'png' : 'jpg' };
}

export function serviceBearerMatches(request:Request,serviceKey?:string) {
  const supplied=request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1]??'';
  if(!serviceKey||supplied.length!==serviceKey.length)return false;
  let mismatch=0;
  for(let index=0;index<serviceKey.length;index++)mismatch|=supplied.charCodeAt(index)^serviceKey.charCodeAt(index);
  return mismatch===0;
}
export function manualPaymentRoutes(accounts: AccountService | null | undefined, url?: string, serviceKey?: string, rateLimitPepper?: string, guestBookingService?: GuestBookingService | null, objectStorage?: ObjectStorageRouter | null, eventInviteService?: EventInviteService | null, privateUploadService?:PrivateUploadService|null, storageCleanupKey?:string) {
  const db = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  const guestBookings=guestBookingService ?? (url&&serviceKey&&rateLimitPepper&&rateLimitPepper.length>=32?createSupabaseGuestBookingService(url,serviceKey,rateLimitPepper):null);
  async function actor(request: Request) {
    const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    const identity = token && accounts ? await accounts.authenticate(token) : null;
    if (!identity?.googleVerified) throw new FinanceError('UNAUTHORIZED');
    return identity.id;
  }
  function client() { if (!db) throw new FinanceError('STORAGE_UNAVAILABLE'); return db; }
  function files() {if(!objectStorage)throw new FinanceError('STORAGE_UNAVAILABLE');return objectStorage;}
  function uploads() {if(!privateUploadService)throw new FinanceError('STORAGE_UNAVAILABLE');return privateUploadService;}
  function logicalKey(reference:string) {const storage=files();try{return storage.logicalKey(reference);}catch{throw new FinanceError('FORBIDDEN');}}
  async function objectExists(reference:string) {try{return await files().exists(reference);}catch{throw new FinanceError('STORAGE_UNAVAILABLE');}}
  async function rpc(name: string, params: Record<string, unknown>) {
    const { data, error } = await client().rpc(name, params);
    if (error) {
      const domain=['EVENT_FULL','REGISTRATION_CLOSED','INVALID_EVENT_STATE','ATTENDANCE_RECORDED','REASON_REQUIRED','INVALID_UPLOAD'];
      const known=domain.find(code=>error.message.includes(code));
      throw new FinanceError(error.code === '42501' ? 'FORBIDDEN' : error.message.includes('EVENT_VERSION_CONFLICT') ? 'VERSION_CONFLICT' : known??'CONFLICT');
    }
    return data;
  }
  const participantDto=(participant:Record<string,unknown>)=>({
    id:participant.id,status:participant.status,joined_as:participant.joined_as,hold_expires_at:participant.hold_expires_at,
    confirmed_at:participant.confirmed_at,cancelled_at:participant.cancelled_at,updated_at:participant.updated_at,
  });
  async function tokenHash(token:string) {
    if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new FinanceError('FORBIDDEN');
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
    return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
  }
  async function ownEvent(event: string, request: Request) {
    const id = await actor(request);
    await rpc('manual_event_access', { p_event: event, p_actor: id });
    return id;
  }
  async function publicEventAccess(event:string,request:Request) {
    if(!eventInviteService)throw new FinanceError('STORAGE_UNAVAILABLE');
    try {
      if(!await eventInviteService.canAccess(event,request.headers.get('x-invite-token'),request.headers.get('x-booking-token')))throw new FinanceError('FORBIDDEN');
    } catch(error) {
      if(error instanceof FinanceError)throw error;
      throw new FinanceError('STORAGE_UNAVAILABLE');
    }
  }
  async function chargeAccess(charge: string, request: Request) {
    const { data: c, error } = await client().from('participant_charges').select('*,event_participants!inner(event_id,user_id)').eq('id',charge).single();
    if (error || !c) throw new FinanceError('FORBIDDEN');
    const p = c.event_participants;
    const token = request.headers.get('x-booking-token');
    if (token) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new FinanceError('FORBIDDEN');
      const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
      const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
      const { data: booking } = await client().rpc('get_guest_booking',{ p_event: p.event_id,p_token_hash: hash });
      if (!booking?.some((b: { participant_id: string }) => b.participant_id === c.participant_id)) throw new FinanceError('FORBIDDEN');
      return { c, actor: null, hash };
    }
    const id = await actor(request);
    const { data: profile } = await client().from('profiles').select('user_id').eq('id',id).single();
    if (profile?.user_id !== p.user_id) await rpc('manual_event_access',{p_event:p.event_id,p_actor:id});
    return { c, actor: id, hash: null };
  }
  async function eventDto(eventId: string, publicOnly: boolean) {
    let query=client().from('events').select('id,title,description,starts_at,ends_at,registration_closes_at,timezone,capacity,price_amount,currency,status,visibility,venue_snapshot,venue_booking_status,estimated_total_cost,contributions_locked_at,contribution_mode,payment_timing,version').eq('id',eventId);
    if(publicOnly)query=query.in('status',['published','recruiting','confirmed','completed']);
    const {data:e,error}=await query.single();
    if(error)throw new FinanceError('FORBIDDEN');
    const {count}=await client().from('event_participants').select('id',{count:'exact',head:true}).eq('event_id',e.id).in('status',['confirmed','attended','no_show']);
    const {count:chargeable}=await client().from('event_participants').select('id',{count:'exact',head:true}).eq('event_id',e.id).eq('chargeable',true).eq('status','confirmed');
    const {venue_snapshot,...rest}=e;
    return {...rest,participants_count:count??0,estimated_per_person:chargeable?Math.ceil(Number(e.estimated_total_cost)/chargeable):null,venue:{name:venue_snapshot?.name?.trim()||'Venue belum ditentukan',address:venue_snapshot?.address??'',maps_url:venue_snapshot?.maps_url??'',...(venue_snapshot?.latitude!==undefined?{latitude:Number(venue_snapshot.latitude),longitude:Number(venue_snapshot.longitude)}:{}),...(venue_snapshot?.meeting_instructions?{meeting_instructions:venue_snapshot.meeting_instructions}:{})}};
  }
  return new Elysia({ aot: false })
    .onBeforeHandle(({set}) => {set.headers['cache-control']='no-store';})
    .onError(({ error, set }) => {
      const code = error instanceof Error ? error.message : '';
      if (!['UNAUTHORIZED','FORBIDDEN','CONFLICT','VERSION_CONFLICT','EVENT_FULL','REGISTRATION_CLOSED','INVALID_EVENT_STATE','ATTENDANCE_RECORDED','REASON_REQUIRED','STORAGE_UNAVAILABLE','INVALID_IMAGE','IMAGE_TOO_LARGE','INVALID_REQUEST','INVALID_UPLOAD'].includes(code)) return;
      set.status = code === 'UNAUTHORIZED' ? 401 : code === 'FORBIDDEN' ? 403 : ['CONFLICT','VERSION_CONFLICT','EVENT_FULL','REGISTRATION_CLOSED','INVALID_EVENT_STATE','ATTENDANCE_RECORDED'].includes(code) ? 409 : code === 'STORAGE_UNAVAILABLE' ? 503 : 422;
      return { error: { code, message: 'Permintaan belum dapat diproses.' } };
    })
    .get('/organizer/events',async ({request})=>{
      const id=await actor(request);
      const {data:members,error:me}=await client().from('workspace_members').select('workspace_id').eq('profile_id',id).in('role',['owner','organizer']);
      const {data:roles,error:re}=await client().from('event_organizers').select('event_id').eq('profile_id',id).in('role',['owner','organizer']);
      if(me||re)throw new FinanceError('STORAGE_UNAVAILABLE');
      const filters=[...(members?.length?[`workspace_id.in.(${members.map(m=>m.workspace_id).join(',')})`]:[]),...(roles?.length?[`id.in.(${roles.map(r=>r.event_id).join(',')})`]:[])];
      if(!filters.length)return {data:[]};
      const {data,error}=await client().from('events').select('id,title,status,visibility,starts_at,ends_at,timezone,venue_booking_status,estimated_total_cost,contributions_locked_at').or(filters.join(',')).order('starts_at',{ascending:false}).limit(100);
      if(error)throw new FinanceError('STORAGE_UNAVAILABLE');return {data};
    })
    .get('/organizer/workspaces',async ({request})=>{
      const id=await actor(request);
      const {data,error}=await client().from('workspace_members').select('role,workspaces!inner(id,name)').eq('profile_id',id).in('role',['owner','organizer']).order('created_at');
      if(error)throw new FinanceError('STORAGE_UNAVAILABLE');
      return {data:(data??[]).map(row=>({...row.workspaces,role:row.role}))};
    })
    .get('/activity-types',async ()=>{
      const {data,error}=await client().from('activity_types').select('id,slug,name').eq('active',true).order('name');
      if(error)throw new FinanceError('STORAGE_UNAVAILABLE');
      return {data};
    })
    .get('/organizer/events/:id',async ({request,params})=>{
      await ownEvent(params.id,request);
      return {data:await eventDto(params.id,false)};
    },{params:t.Object({id:uuid})})
    .get('/events/:id',async ({params,request}) => {
      await publicEventAccess(params.id,request);
      return {data:await eventDto(params.id,true)};
    },{params:t.Object({id:uuid})})
    .post('/events',async ({request,body}) => {
      const id=await actor(request);
      const venue=body.venue_snapshot?normalizeVenueSnapshot(body.venue_snapshot):undefined;
      const {data:membership}=await client().from('workspace_members').select('role').eq('workspace_id',body.workspace_id).eq('profile_id',id).in('role',['owner','organizer']).maybeSingle();
      if(!membership) throw new FinanceError('FORBIDDEN');
      const {data,error}=await client().from('events').insert({...body,...(venue?{venue_snapshot:venue}:{}),organizer_profile_id:id,contribution_mode:'dynamic',payment_mode:'free',price_amount:0,status:'recruiting'}).select('id').single();
      if(error) throw new FinanceError('CONFLICT');
      return {data};
    },{body:t.Object({workspace_id:uuid,activity_type_id:uuid,title:t.String({minLength:1,maxLength:200}),description:t.Optional(t.String({maxLength:10000})),starts_at:t.String({format:'date-time'}),ends_at:t.String({format:'date-time'}),registration_closes_at:t.String({format:'date-time'}),timezone:t.String({minLength:1,maxLength:100}),capacity:t.Integer({minimum:1,maximum:100000}),estimated_total_cost:amount,payment_timing:t.Union([t.Literal('before_event'),t.Literal('after_event')]),visibility:t.Union([t.Literal('public'),t.Literal('unlisted')]),venue_snapshot:t.Optional(venueSnapshot)},{additionalProperties:false})})
    .patch('/events/:id/planning',async ({request,params,body}) => {
      const actorId=await actor(request);
      const {expected_version,...patch}=body;
      return {data:await rpc('update_dynamic_event',{
        p_event:params.id,p_actor:actorId,p_expected_version:expected_version,
        ...Object.fromEntries(Object.entries(patch).map(([field,value])=>[`p_${field}`,field==='venue_snapshot'&&value?normalizeVenueSnapshot(value as VenueSnapshot):value])),
      })};
    },{params:t.Object({id:uuid}),body:t.Object({expected_version:t.Integer({minimum:1}),title:t.Optional(t.String({minLength:1,maxLength:200})),description:t.Optional(t.String({maxLength:10000})),starts_at:t.Optional(t.String({format:'date-time'})),ends_at:t.Optional(t.String({format:'date-time'})),registration_closes_at:t.Optional(t.String({format:'date-time'})),timezone:t.Optional(t.String({minLength:1,maxLength:100})),capacity:t.Optional(t.Integer({minimum:1,maximum:100000})),estimated_total_cost:t.Optional(amount),payment_timing:t.Optional(t.Union([t.Literal('before_event'),t.Literal('after_event')])),venue_booking_status:t.Optional(t.Union([t.Literal('not_booked'),t.Literal('pending'),t.Literal('booked'),t.Literal('cancelled')])),status:t.Optional(t.Union([t.Literal('confirmed'),t.Literal('completed')])),venue_snapshot:t.Optional(venueSnapshot)},{additionalProperties:false,minProperties:2})})
    .post('/events/:id/join',async ({request,params}) => {
      const id=await actor(request);
      try { await publicEventAccess(params.id,request); }
      catch(error) { if(error instanceof FinanceError&&error.message==='FORBIDDEN')await rpc('manual_event_access',{p_event:params.id,p_actor:id});else throw error; }
      const {data:p}=await client().from('profiles').select('user_id').eq('id',id).single();
      if(!p) throw new FinanceError('FORBIDDEN');
      return {data:participantDto(await rpc('join_event',{p_event_id:params.id,p_user_id:p.user_id,p_actor_profile_id:id}))};
    },{params:t.Object({id:uuid})})
    .get('/events/:id/participation',async ({request,params})=>{
      const bookingToken=request.headers.get('x-booking-token');
      if(bookingToken) {
        const rows=await rpc('get_guest_booking',{p_event:params.id,p_token_hash:await tokenHash(bookingToken)});
        return {data:(Array.isArray(rows)?rows[0]:rows)??null};
      }
      const actorId=await actor(request);
      const {data:profile,error:profileError}=await client().from('profiles').select('user_id').eq('id',actorId).single();
      if(profileError||!profile)throw new FinanceError('FORBIDDEN');
      const {data,error}=await client().from('event_participants').select('id,status,joined_as,hold_expires_at,confirmed_at,cancelled_at,updated_at').eq('event_id',params.id).eq('user_id',profile.user_id).maybeSingle();
      if(error)throw new FinanceError('STORAGE_UNAVAILABLE');
      return {data:data??null};
    },{params:t.Object({id:uuid})})
    .post('/events/:id/participation/cancel',async ({request,params,body})=>{
      const bookingToken=request.headers.get('x-booking-token');
      const actorId=bookingToken?null:await actor(request);
      const participant=await rpc('cancel_own_dynamic_participation',{
        p_event:params.id,p_actor:actorId,p_guest_hash:bookingToken?await tokenHash(bookingToken):null,p_reason:body.reason,
      });
      return {data:participantDto(participant)};
    },{params:t.Object({id:uuid}),body:t.Object({reason:t.String({minLength:1,maxLength:1000})},{additionalProperties:false})})
    .get('/events/:id/invites',async ({request,params})=>{
      await ownEvent(params.id,request);
      const {data,error}=await client().from('event_invites').select('id,expires_at,revoked_at,created_at').eq('event_id',params.id).order('created_at',{ascending:false});
      if(error)throw new FinanceError('STORAGE_UNAVAILABLE');
      return {data:data??[]};
    },{params:t.Object({id:uuid})})
    .post('/events/:id/invites',async ({request,params,body,set})=>{
      const actorId=await ownEvent(params.id,request);
      const bytes=crypto.getRandomValues(new Uint8Array(32));
      const token=btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
      const tokenHash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
      const invite=await rpc('create_event_invite',{p_event:params.id,p_actor:actorId,p_token_hash:tokenHash,p_expires_at:body.expires_at??null});
      set.headers['cache-control']='no-store';
      return {data:{id:invite.id,expires_at:invite.expires_at,revoked_at:invite.revoked_at,created_at:invite.created_at,token}};
    },{params:t.Object({id:uuid}),body:t.Object({expires_at:t.Optional(t.String({format:'date-time'}))},{additionalProperties:false})})
    .post('/invites/:id/revoke',async ({request,params})=>{
      const invite=await rpc('revoke_event_invite',{p_invite:params.id,p_actor:await actor(request)});
      return {data:{id:invite.id,expires_at:invite.expires_at,revoked_at:invite.revoked_at,created_at:invite.created_at}};
    },{params:t.Object({id:uuid}),parse:'none'})
    .get('/payment-settings', async ({ request }) => {
      const id = await actor(request);
      const { data,error } = await client().from('organizer_payment_methods').select('*').eq('organizer_id',id).order('created_at');
      if (error) throw new FinanceError('STORAGE_UNAVAILABLE');
      return { data };
    })
    .post('/payment-settings', async ({ request,body }) => {
      const id = await actor(request);
      if (body.type === 'static_qris') {
        if (!body.storage_path || !new RegExp(`^qris/${id}/[0-9a-f-]{36}\\.(png|jpg)$`).test(logicalKey(body.storage_path))) throw new FinanceError('FORBIDDEN');
        if (!await objectExists(body.storage_path)) throw new FinanceError('INVALID_IMAGE');
      }
      return {data:await rpc('create_organizer_payment_method',{
        p_actor:id,p_type:body.type,p_recipient_name:body.recipient_name,
        p_storage_reference:body.storage_path??null,p_bank_details:body.bank_details??null,
      })};
    }, { body:t.Object({type:t.Union([t.Literal('static_qris'),t.Literal('bank_transfer'),t.Literal('cash')]),recipient_name:t.String({minLength:1,maxLength:120}),storage_path:t.Optional(t.String({maxLength:512})),bank_details:t.Optional(t.Object({bank:t.String({minLength:1,maxLength:120}),account:t.String({minLength:1,maxLength:100})}))},{additionalProperties:false}) })
    .patch('/payment-settings/:id', async ({ request,params,body }) => {
      const id = await actor(request);
      const { data,error } = await client().from('organizer_payment_methods').update({is_active:body.is_active}).eq('id',params.id).eq('organizer_id',id).select().single();
      if (error) throw new FinanceError('FORBIDDEN');
      return { data };
    }, {params:t.Object({id:uuid}),body:t.Object({is_active:t.Boolean()},{additionalProperties:false})})
    .post('/payment-settings/qris-image', async ({request}) => {
      const id = await actor(request);
      const { bytes,mime,extension } = await imageBytes(request);
      const path = `qris/${id}/${crypto.randomUUID()}.${extension}`;
      try{return {data:{storage_path:await uploads().upload({key:path,purpose:'qris',ownerProfileId:id,object:{bytes,contentType:mime}})}};}
      catch{throw new FinanceError('STORAGE_UNAVAILABLE');}
    }, {parse: 'none'})
    .get('/events/:id/roster',async ({request,params,set})=>{
      set.headers['cache-control']='no-store';await ownEvent(params.id,request);
      const {data:e,error}=await client().from('events').select('estimated_total_cost,contributions_locked_at,payment_timing').eq('id',params.id).single();
      const {data:participants,error:pe}=await client().from('event_participants').select('id,status,chargeable,users(display_name,profiles(id)),participant_charges(id,amount)').eq('event_id',params.id);
      if(error||pe)throw new FinanceError('STORAGE_UNAVAILABLE');
      const n=(participants??[]).filter(p=>p.chargeable&&p.status==='confirmed').length;
      const charges=(participants??[]).flatMap(p=>p.participant_charges??[]);
      const {data:ledger,error:le}=charges.length?await client().from('contribution_ledger').select('charge_id,entry_type,amount').in('charge_id',charges.map(c=>c.id)):{data:[],error:null};
      if(le)throw new FinanceError('STORAGE_UNAVAILABLE');
      const balanceByCharge=new Map(charges.map(charge=>[charge.id,Number(charge.amount)]));
      let received=0,refunded=0,adjustments=0;
      for(const entry of ledger??[]){
        const value=Number(entry.amount);
        if(entry.entry_type==='receipt'){received+=value;balanceByCharge.set(entry.charge_id,(balanceByCharge.get(entry.charge_id)??0)-value);}
        else if(entry.entry_type==='refund'){refunded+=value;balanceByCharge.set(entry.charge_id,(balanceByCharge.get(entry.charge_id)??0)+value);}
        else {adjustments+=value;balanceByCharge.set(entry.charge_id,(balanceByCharge.get(entry.charge_id)??0)+value);}
      }
      const balances=[...balanceByCharge.values()];
      const summary={charged:charges.reduce((sum,c)=>sum+Number(c.amount),0),received,refunded,adjustments,outstanding:balances.reduce((sum,value)=>sum+Math.max(value,0),0),credit:balances.reduce((sum,value)=>sum+Math.max(-value,0),0)};
      return {data:{...e,estimated_per_person:n?Math.ceil(Number(e.estimated_total_cost)/n):null,summary,participants:(participants??[]).map(p=>({...p,is_guest:!(p.users??[]).some(user=>user.profiles?.length),participant_charges:(p.participant_charges??[]).map(charge=>({...charge,balance:balanceByCharge.get(charge.id)??Number(charge.amount)}))}))}};
    },{params:t.Object({id:uuid})})
    .post('/events/:id/participants',async ({request,params,body})=>{
      await ownEvent(params.id,request);
      if(!guestBookings)throw new FinanceError('STORAGE_UNAVAILABLE');
      return {data:await guestBookings.create({eventId:params.id,displayName:body.display_name,whatsapp:body.whatsapp,clientAddress:clientAddressFrom(request)})};
    },{params:t.Object({id:uuid}),body:t.Object({display_name:t.String({minLength:1,maxLength:120}),whatsapp:t.String({minLength:8,maxLength:32})},{additionalProperties:false})})
    .post('/participants/:id/guest-token',async ({request,params,set})=>{
      set.headers['cache-control']='no-store';
      const id=await actor(request);
      if(!guestBookings)throw new FinanceError('STORAGE_UNAVAILABLE');
      return {data:await guestBookings.recover(params.id,id)};
    },{params:t.Object({id:uuid}),parse:'none'})
    .post('/participants/:id/cancel',async ({request,params,body})=>({data:await rpc('cancel_dynamic_participant',{p_participant:params.id,p_actor:await actor(request),p_guest_hash:null,p_policy:body.policy,p_reason:body.reason,p_key:body.idempotency_key})}),{params:t.Object({id:uuid}),body:t.Object({policy:t.Union([t.Literal('retain'),t.Literal('waive')]),reason,idempotency_key:key},{additionalProperties:false})})
    .post('/events/:id/cancel',async ({request,params,body})=>({data:await rpc('cancel_dynamic_event',{p_event:params.id,p_actor:await actor(request),p_policy:body.policy,p_reason:body.reason,p_key:body.idempotency_key})}),{params:t.Object({id:uuid}),body:t.Object({policy:t.Union([t.Literal('retain'),t.Literal('waive')]),reason,idempotency_key:t.String({minLength:1,maxLength:120})},{additionalProperties:false})})
    .post('/events/:id/contributions/lock',async ({request,params}) => ({ data:await rpc('lock_contributions',{p_event:params.id,p_actor:await actor(request)}) }),{params:t.Object({id:uuid})})
    .post('/participants/:id/charge',async ({request,params,body}) => ({ data:await rpc('assign_contribution',{p_participant:params.id,p_actor:await actor(request),p_amount:body.amount}) }),{params:t.Object({id:uuid}),body:t.Object({amount},{additionalProperties:false})})
    .post('/events/:id/payment-methods',async ({request,params,body}) => {
      const id = await ownEvent(params.id,request);
      const {data:m} = await client().from('organizer_payment_methods').select('id').eq('id',body.method_id).eq('organizer_id',id).eq('is_active',true).single();
      if (!m) throw new FinanceError('FORBIDDEN');
      const {error} = await client().from('manual_event_methods').upsert({event_id:params.id,method_id:m.id,enabled:body.enabled});
      if (error) throw new FinanceError('CONFLICT');
      return {data:{ok:true}};
    },{params:t.Object({id:uuid}),body:t.Object({method_id:uuid,enabled:t.Boolean()},{additionalProperties:false})})
    .get('/charges/:id',async ({request,params,set}) => {
      set.headers['cache-control']='no-store';
      const {c} = await chargeAccess(params.id,request);
      const {data:ledger,error} = await client().from('contribution_ledger').select('entry_type,amount,created_at').eq('charge_id',c.id);
      if (error) throw new FinanceError('STORAGE_UNAVAILABLE');
      const {data:records} = await client().from('manual_payment_records').select('id,amount,status,paid_at,reason').eq('charge_id',c.id);
      const {data:enabled} = await client().from('manual_event_methods').select('method_id').eq('event_id',c.event_participants.event_id).eq('enabled',true);
      const {data:methods} = enabled?.length ? await client().from('organizer_payment_methods').select('id,type,recipient_name,bank_details,storage_path').in('id',enabled.map(m=>m.method_id)).eq('is_active',true) : {data:[]};
      const visibleMethods = await Promise.all((methods ?? []).map(async m => {
        const {storage_path,...rest}=m;
        let qris_url:string|null=null;
        if(storage_path)try{qris_url=await files().signedDownloadUrl(storage_path,120);}catch{throw new FinanceError('STORAGE_UNAVAILABLE');}
        return {...rest,qris_url};
      }));
      const net = (ledger ?? []).reduce((sum,l)=>sum+(l.entry_type==='receipt'? -Number(l.amount):Number(l.amount)),Number(c.amount));
      return {data:{id:c.id,amount:c.amount,balance:net,records:records??[],methods:visibleMethods}};
    },{params:t.Object({id:uuid})})
    .post('/charges/:id/proof',async ({request,params}) => {
      const access=await chargeAccess(params.id,request);
      const {bytes,mime,extension}=await imageBytes(request);
      const path=`proof/${params.id}/${crypto.randomUUID()}.${extension}`;
      try{return {data:{storage_path:await uploads().upload({key:path,purpose:'payment_proof',ownerProfileId:access.actor,chargeId:params.id,object:{bytes,contentType:mime}})}};}
      catch{throw new FinanceError('STORAGE_UNAVAILABLE');}
    },{params:t.Object({id:uuid}),parse:'none'})
    .post('/charges/:id/payments',async ({request,params,body}) => {
      const access=await chargeAccess(params.id,request);
      if (body.proof_storage_path) {
        if (!new RegExp(`^proof/${params.id}/[0-9a-f-]{36}\\.(png|jpg)$`).test(logicalKey(body.proof_storage_path))) throw new FinanceError('FORBIDDEN');
        if (!await objectExists(body.proof_storage_path)) throw new FinanceError('INVALID_IMAGE');
      }
      return {data:await rpc('report_manual_payment',{p_charge:params.id,p_method:body.method_id,p_amount:body.amount,p_key:body.idempotency_key,p_actor:access.actor,p_guest_hash:access.hash,p_proof:body.proof_storage_path??null})};
    },{params:t.Object({id:uuid}),body:t.Object({method_id:uuid,amount:t.Integer({minimum:1,maximum:1e12}),idempotency_key:key,proof_storage_path:t.Optional(t.String({maxLength:512}))},{additionalProperties:false})})
    .get('/events/:id/payment-reviews',async ({request,params,set}) => {
      set.headers['cache-control']='no-store';
      await ownEvent(params.id,request);
      const {data,error}=await client().from('manual_payment_records').select('*,participant_charges!inner(participant_id,event_participants!inner(event_id))').eq('participant_charges.event_participants.event_id',params.id);
      if(error) throw new FinanceError('STORAGE_UNAVAILABLE');
      return {data:await Promise.all((data??[]).map(async r=>{let proof_url:string|null=null;if(r.proof_storage_path)try{proof_url=await files().signedDownloadUrl(r.proof_storage_path,120);}catch{throw new FinanceError('STORAGE_UNAVAILABLE');}return {...r,proof_url};}))};
    },{params:t.Object({id:uuid})})
    .post('/payments/:id/review',async ({request,params,body}) => ({data:await rpc('review_manual_payment',{p_payment:params.id,p_actor:await actor(request),p_decision:body.decision,p_reason:body.reason})}),{params:t.Object({id:uuid}),body:t.Object({decision:t.Union([t.Literal('verified'),t.Literal('rejected')]),reason},{additionalProperties:false})})
    .post('/charges/:id/adjustments',async ({request,params,body}) => ({data:await rpc('adjust_contribution',{p_charge:params.id,p_actor:await actor(request),p_type:body.type,p_amount:body.amount,p_reason:body.reason,p_key:body.idempotency_key})}),{params:t.Object({id:uuid}),body:t.Object({type:t.Union([t.Literal('refund'),t.Literal('adjustment')]),amount:t.Integer({minimum:-1e12,maximum:1e12}),reason,idempotency_key:key},{additionalProperties:false})})
    .post('/internal/storage/orphans/cleanup',async ({request})=>{
      if(!serviceBearerMatches(request,storageCleanupKey))throw new FinanceError('FORBIDDEN');
      try{return {data:await uploads().cleanup(100)};}catch{throw new FinanceError('STORAGE_UNAVAILABLE');}
    },{parse:'none'});
}
