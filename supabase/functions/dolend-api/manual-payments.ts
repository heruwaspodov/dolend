import { createClient } from '@supabase/supabase-js';
import { Elysia, t } from 'elysia';
import { clientAddressFrom, createSupabaseGuestBookingService } from './guest-booking.ts';
import type { GuestBookingService } from './guest-booking.ts';
import type { AccountService } from './account.ts';

export class FinanceError extends Error {}

const uuid = t.String({ format: 'uuid' });
const amount = t.Integer({ minimum: 0, maximum: 1e12 });
const key = t.String({ minLength: 1, maxLength: 200 });
const reason = t.String({ minLength: 1, maxLength: 1000 });
const bucket = 'dolend-payments';
export function isSafeMapsUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'maps.google.com' || (url.hostname === 'www.google.com' && url.pathname.startsWith('/maps')));
  } catch {
    return false;
  }
}
export async function imageBytes(request: Request) {
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

export function manualPaymentRoutes(accounts: AccountService | null | undefined, url?: string, serviceKey?: string, rateLimitPepper?: string, guestBookingService?: GuestBookingService | null) {
  const db = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  const guestBookings=guestBookingService ?? (url&&serviceKey&&rateLimitPepper&&rateLimitPepper.length>=32?createSupabaseGuestBookingService(url,serviceKey,rateLimitPepper):null);
  async function actor(request: Request) {
    const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    const identity = token && accounts ? await accounts.authenticate(token) : null;
    if (!identity?.googleVerified) throw new FinanceError('UNAUTHORIZED');
    return identity.id;
  }
  function client() { if (!db) throw new FinanceError('STORAGE_UNAVAILABLE'); return db; }
  async function rpc(name: string, params: Record<string, unknown>) {
    const { data, error } = await client().rpc(name, params);
    if (error) throw new FinanceError(error.code === '42501' ? 'FORBIDDEN' : 'CONFLICT');
    return data;
  }
  async function ownEvent(event: string, request: Request) {
    const id = await actor(request);
    await rpc('manual_event_access', { p_event: event, p_actor: id });
    return id;
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
  return new Elysia({ aot: false })
    .onBeforeHandle(({set}) => {set.headers['cache-control']='no-store';})
    .onError(({ error, set }) => {
      const code = error instanceof Error ? error.message : '';
      if (!['UNAUTHORIZED','FORBIDDEN','CONFLICT','STORAGE_UNAVAILABLE','INVALID_IMAGE','IMAGE_TOO_LARGE','INVALID_REQUEST'].includes(code)) return;
      set.status = code === 'UNAUTHORIZED' ? 401 : code === 'FORBIDDEN' ? 403 : code === 'CONFLICT' ? 409 : code === 'STORAGE_UNAVAILABLE' ? 503 : 422;
      return { error: { code, message: 'Permintaan belum dapat diproses.' } };
    })
    .get('/organizer/events',async ({request})=>{
      const id=await actor(request);
      const {data:members,error:me}=await client().from('workspace_members').select('workspace_id').eq('profile_id',id).in('role',['owner','organizer']);
      const {data:roles,error:re}=await client().from('event_organizers').select('event_id').eq('profile_id',id).in('role',['owner','organizer']);
      if(me||re)throw new FinanceError('STORAGE_UNAVAILABLE');
      const filters=[...(members?.length?[`workspace_id.in.(${members.map(m=>m.workspace_id).join(',')})`]:[]),...(roles?.length?[`id.in.(${roles.map(r=>r.event_id).join(',')})`]:[])];
      if(!filters.length)return {data:[]};
      const {data,error}=await client().from('events').select('id,title,status,starts_at,ends_at,timezone,venue_booking_status,estimated_total_cost,contributions_locked_at').or(filters.join(',')).order('starts_at',{ascending:false}).limit(100);
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
    .get('/events/:id',async ({params}) => {
      const {data:e,error}=await client().from('events').select('id,title,description,starts_at,ends_at,timezone,capacity,price_amount,currency,status,venue_snapshot,venue_booking_status,estimated_total_cost,contributions_locked_at,contribution_mode').eq('id',params.id).in('status',['published','recruiting','confirmed','completed']).single();
      if(error) throw new FinanceError('FORBIDDEN');
      const {count}=await client().from('event_participants').select('id',{count:'exact',head:true}).eq('event_id',e.id).in('status',['confirmed','attended','no_show']);
      const {count:chargeable}=await client().from('event_participants').select('id',{count:'exact',head:true}).eq('event_id',e.id).eq('chargeable',true).eq('status','confirmed');
      const {venue_snapshot,...rest}=e;
      return {data:{...rest,participants_count:count??0,estimated_per_person:chargeable?Math.ceil(Number(e.estimated_total_cost)/chargeable):null,venue:{name:venue_snapshot?.name??'Venue belum ditentukan',address:venue_snapshot?.address??'',maps_url:venue_snapshot?.maps_url??''}}};
    },{params:t.Object({id:uuid})})
    .post('/events',async ({request,body}) => {
      const id=await actor(request);
      if(body.venue_snapshot && !isSafeMapsUrl(body.venue_snapshot.maps_url)) throw new FinanceError('INVALID_REQUEST');
      const {data:membership}=await client().from('workspace_members').select('role').eq('workspace_id',body.workspace_id).eq('profile_id',id).in('role',['owner','organizer']).maybeSingle();
      if(!membership) throw new FinanceError('FORBIDDEN');
      const {data,error}=await client().from('events').insert({...body,organizer_profile_id:id,contribution_mode:'dynamic',payment_mode:'free',price_amount:0,status:'recruiting'}).select('id').single();
      if(error) throw new FinanceError('CONFLICT');
      return {data};
    },{body:t.Object({workspace_id:uuid,activity_type_id:uuid,title:t.String({minLength:1,maxLength:200}),description:t.Optional(t.String({maxLength:10000})),starts_at:t.String({format:'date-time'}),ends_at:t.String({format:'date-time'}),registration_closes_at:t.String({format:'date-time'}),timezone:t.String({minLength:1,maxLength:100}),capacity:t.Integer({minimum:1,maximum:100000}),estimated_total_cost:amount,payment_timing:t.Union([t.Literal('before_event'),t.Literal('after_event')]),venue_snapshot:t.Optional(t.Object({name:t.String({maxLength:200}),address:t.String({maxLength:1000}),maps_url:t.String({maxLength:2000})}))},{additionalProperties:false})})
    .patch('/events/:id/planning',async ({request,params,body}) => {
      await ownEvent(params.id,request);
      if(body.venue_snapshot && !isSafeMapsUrl(body.venue_snapshot.maps_url)) throw new FinanceError('INVALID_REQUEST');
      const {data,error}=await client().from('events').update(body).eq('id',params.id).eq('contribution_mode','dynamic').select('id,status,estimated_total_cost,venue_booking_status').single();
      if(error) throw new FinanceError('CONFLICT');
      return {data};
    },{params:t.Object({id:uuid}),body:t.Object({estimated_total_cost:t.Optional(amount),venue_booking_status:t.Optional(t.Union([t.Literal('not_booked'),t.Literal('pending'),t.Literal('booked'),t.Literal('cancelled')])),status:t.Optional(t.Union([t.Literal('confirmed'),t.Literal('completed')])),venue_snapshot:t.Optional(t.Object({name:t.String({maxLength:200}),address:t.String({maxLength:1000}),maps_url:t.String({maxLength:2000})}))},{additionalProperties:false,minProperties:1})})
    .post('/events/:id/join',async ({request,params}) => {
      const id=await actor(request);
      const {data:p}=await client().from('profiles').select('user_id').eq('id',id).single();
      if(!p) throw new FinanceError('FORBIDDEN');
      return {data:await rpc('join_event',{p_event_id:params.id,p_user_id:p.user_id,p_actor_profile_id:id})};
    },{params:t.Object({id:uuid})})
    .get('/payment-settings', async ({ request }) => {
      const id = await actor(request);
      const { data,error } = await client().from('organizer_payment_methods').select('*').eq('organizer_id',id).order('created_at');
      if (error) throw new FinanceError('STORAGE_UNAVAILABLE');
      return { data };
    })
    .post('/payment-settings', async ({ request,body }) => {
      const id = await actor(request);
      if (body.type === 'static_qris') {
        if (!body.storage_path || !new RegExp(`^qris/${id}/[0-9a-f-]{36}\\.(png|jpg)$`).test(body.storage_path)) throw new FinanceError('FORBIDDEN');
        const { data,error } = await client().storage.from(bucket).download(body.storage_path);
        if (error || !data) throw new FinanceError('INVALID_IMAGE');
      }
      const { data,error } = await client().from('organizer_payment_methods').insert({ ...body,organizer_id:id }).select().single();
      if (error) throw new FinanceError('CONFLICT');
      return { data };
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
      const {error} = await client().storage.from(bucket).upload(path,bytes,{contentType:mime,upsert:false});
      if (error) throw new FinanceError('STORAGE_UNAVAILABLE');
      return {data:{storage_path:path}};
    }, {parse: 'none'})
    .get('/events/:id/roster',async ({request,params,set})=>{
      set.headers['cache-control']='no-store';await ownEvent(params.id,request);
      const {data:e,error}=await client().from('events').select('estimated_total_cost,contributions_locked_at,payment_timing').eq('id',params.id).single();
      const {data:participants,error:pe}=await client().from('event_participants').select('id,status,chargeable,users(display_name,profiles(id)),participant_charges(id,amount)').eq('event_id',params.id);
      if(error||pe)throw new FinanceError('STORAGE_UNAVAILABLE');
      const n=(participants??[]).filter(p=>p.chargeable&&p.status==='confirmed').length;
      return {data:{...e,estimated_per_person:n?Math.ceil(Number(e.estimated_total_cost)/n):null,participants:(participants??[]).map(p=>({...p,is_guest:!(p.users??[]).some(user=>user.profiles?.length)}))}};
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
        const signed = storage_path ? await client().storage.from(bucket).createSignedUrl(storage_path,120,{download:true}) : null;
        return {...rest,qris_url:signed?.data?.signedUrl ?? null};
      }));
      const net = (ledger ?? []).reduce((sum,l)=>sum+(l.entry_type==='receipt'? -Number(l.amount):Number(l.amount)),Number(c.amount));
      return {data:{id:c.id,amount:c.amount,balance:net,records:records??[],methods:visibleMethods}};
    },{params:t.Object({id:uuid})})
    .post('/charges/:id/proof',async ({request,params}) => {
      await chargeAccess(params.id,request);
      const {bytes,mime,extension}=await imageBytes(request);
      const path=`proof/${params.id}/${crypto.randomUUID()}.${extension}`;
      const {error}=await client().storage.from(bucket).upload(path,bytes,{contentType:mime});
      if (error) throw new FinanceError('STORAGE_UNAVAILABLE');
      return {data:{storage_path:path}};
    },{params:t.Object({id:uuid}),parse:'none'})
    .post('/charges/:id/payments',async ({request,params,body}) => {
      const access=await chargeAccess(params.id,request);
      if (body.proof_storage_path) {
        if (!new RegExp(`^proof/${params.id}/[0-9a-f-]{36}\\.(png|jpg)$`).test(body.proof_storage_path)) throw new FinanceError('FORBIDDEN');
        const {error}=await client().storage.from(bucket).download(body.proof_storage_path);
        if (error) throw new FinanceError('INVALID_IMAGE');
      }
      return {data:await rpc('report_manual_payment',{p_charge:params.id,p_method:body.method_id,p_amount:body.amount,p_key:body.idempotency_key,p_actor:access.actor,p_guest_hash:access.hash,p_proof:body.proof_storage_path??null})};
    },{params:t.Object({id:uuid}),body:t.Object({method_id:uuid,amount:t.Integer({minimum:1,maximum:1e12}),idempotency_key:key,proof_storage_path:t.Optional(t.String({maxLength:512}))},{additionalProperties:false})})
    .get('/events/:id/payment-reviews',async ({request,params,set}) => {
      set.headers['cache-control']='no-store';
      await ownEvent(params.id,request);
      const {data,error}=await client().from('manual_payment_records').select('*,participant_charges!inner(participant_id,event_participants!inner(event_id))').eq('participant_charges.event_participants.event_id',params.id);
      if(error) throw new FinanceError('STORAGE_UNAVAILABLE');
      return {data:await Promise.all((data??[]).map(async r=>({...r,proof_url:r.proof_storage_path?(await client().storage.from(bucket).createSignedUrl(r.proof_storage_path,120)).data?.signedUrl:null})))};
    },{params:t.Object({id:uuid})})
    .post('/payments/:id/review',async ({request,params,body}) => ({data:await rpc('review_manual_payment',{p_payment:params.id,p_actor:await actor(request),p_decision:body.decision,p_reason:body.reason})}),{params:t.Object({id:uuid}),body:t.Object({decision:t.Union([t.Literal('verified'),t.Literal('rejected')]),reason},{additionalProperties:false})})
    .post('/charges/:id/adjustments',async ({request,params,body}) => ({data:await rpc('adjust_contribution',{p_charge:params.id,p_actor:await actor(request),p_type:body.type,p_amount:body.amount,p_reason:body.reason,p_key:body.idempotency_key})}),{params:t.Object({id:uuid}),body:t.Object({type:t.Union([t.Literal('refund'),t.Literal('adjustment')]),amount:t.Integer({minimum:-1e12,maximum:1e12}),reason,idempotency_key:key},{additionalProperties:false})});
}
