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
  coarse_region_code:t.Optional(t.String({maxLength:32,pattern:'^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$'})),
});
type VenueSnapshot = {name:string;address:string;maps_url:string;latitude?:number;longitude?:number;meeting_instructions?:string;coarse_region_code?:string};
export function organizerPaymentMethodDto(row: Record<string, unknown>) {
  return { id: row.id, type: row.type, recipient_name: row.recipient_name, is_active: row.is_active, created_at: row.created_at };
}
export function manualPaymentReviewDto(row: Record<string, unknown>, proofUrl: string | null) {
  return { id: row.id, amount: row.amount, status: row.status, proof_url: proofUrl };
}
export function isSafeMapsUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && (url.hostname === 'maps.app.goo.gl' || url.hostname === 'maps.google.com' || (url.hostname === 'www.google.com' && url.pathname.startsWith('/maps')));
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
  const region=venue.coarse_region_code?.trim().toUpperCase();
  if(region&&!/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(region))throw new FinanceError('INVALID_REQUEST');
  return {name:venue.name.trim(),address:venue.address.trim(),maps_url:mapsUrl,...(hasLatitude?{latitude:venue.latitude,longitude:venue.longitude}:{}),...(instructions?{meeting_instructions:instructions}:{}),...(region?{coarse_region_code:region}:{})};
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
  if(!serviceKey||serviceKey.length<32||supplied.length!==serviceKey.length)return false;
  let mismatch=0;
  for(let index=0;index<serviceKey.length;index++)mismatch|=supplied.charCodeAt(index)^serviceKey.charCodeAt(index);
  return mismatch===0;
}
export function manualPaymentRoutes(accounts: AccountService | null | undefined, url?: string, serviceKey?: string, rateLimitPepper?: string, guestBookingService?: GuestBookingService | null, objectStorage?: ObjectStorageRouter | null, eventInviteService?: EventInviteService | null, privateUploadService?:PrivateUploadService|null, storageCleanupKey?:string, maintenanceKey?:string) {
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
      const domain=['EVENT_FULL','REGISTRATION_CLOSED','INVALID_EVENT_STATE','ATTENDANCE_RECORDED','ATTENDANCE_NOT_STARTED','REASON_REQUIRED','INVALID_UPLOAD','INVALID_PAYMENT_MODE','INVALID_BILLING_CONFIGURATION','INVALID_PAYMENT_DUE_AT','INVALID_PAYMENT_METHOD','INVOICE_NOT_PAYABLE','HOLD_EXPIRED','IDEMPOTENCY_MISMATCH','INVALID_EVIDENCE_STATE','EVIDENCE_REQUIRED','REVIEW_REASON_REQUIRED'];
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
  async function shareToken(eventId: string, nonce: string) {
    if (!rateLimitPepper || rateLimitPepper.length < 32) throw new FinanceError('STORAGE_UNAVAILABLE');
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(rateLimitPepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`dolend:event-share:v1:${eventId}:${nonce}`));
    return btoa(String.fromCharCode(...new Uint8Array(signature))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  }
  async function shareLinkDto(eventId: string, invite: { id: string; share_nonce: string; token_hash: string; expires_at: string; created_at: string }) {
    const token = await shareToken(eventId, invite.share_nonce);
    if (await tokenHash(token) !== invite.token_hash) throw new FinanceError('STORAGE_UNAVAILABLE');
    return { id: invite.id, expires_at: invite.expires_at, created_at: invite.created_at, revoked_at: null, token };
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
    const { data: c, error } = await client().from('participant_charges').select('id,amount,participant_id,event_participants!inner(event_id,user_id)').eq('id',charge).single();
    if (error || !c) throw new FinanceError('FORBIDDEN');
    const p = Array.isArray(c.event_participants) ? c.event_participants[0] : c.event_participants;
    if (!p) throw new FinanceError('FORBIDDEN');
    const chargeRow = { ...c, event_participants: p };
    const token = request.headers.get('x-booking-token');
    if (token) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new FinanceError('FORBIDDEN');
      const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
      const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
      const { data: booking } = await client().rpc('get_guest_booking',{ p_event: p.event_id,p_token_hash: hash });
      if (!booking?.some((b: { participant_id: string }) => b.participant_id === chargeRow.participant_id)) throw new FinanceError('FORBIDDEN');
      return { c: chargeRow, actor: null, hash };
    }
    const id = await actor(request);
    const { data: profile } = await client().from('profiles').select('user_id').eq('id',id).single();
    if (profile?.user_id !== p.user_id) await rpc('manual_event_access',{p_event:p.event_id,p_actor:id});
    return { c: chargeRow, actor: id, hash: null };
  }
  async function invoiceAccess(invoice:string,request:Request) {
    const {data,error}=await client().from('invoices').select('id,participant_id,invoice_number,amount_due,currency,due_at,status,pricing_snapshot,event_participants!inner(id,event_id,user_id,status)').eq('id',invoice).single();
    if(error||!data)throw new FinanceError('FORBIDDEN');
    const participant=Array.isArray(data.event_participants)?data.event_participants[0]:data.event_participants;
    if(!participant)throw new FinanceError('FORBIDDEN');
    const token=request.headers.get('x-booking-token');
    if(token) {
      const hash=await tokenHash(token);
      const booking=await rpc('get_guest_booking',{p_event:participant.event_id,p_token_hash:hash});
      if(!booking?.some((row:{participant_id:string})=>row.participant_id===participant.id))throw new FinanceError('FORBIDDEN');
      return {invoice:data,participant,actor:null,hash};
    }
    const actorId=await actor(request);
    const {data:profile}=await client().from('profiles').select('user_id').eq('id',actorId).single();
    if(profile?.user_id!==participant.user_id)await rpc('manual_event_access',{p_event:participant.event_id,p_actor:actorId});
    return {invoice:data,participant,actor:actorId,hash:null};
  }
  function canViewAsParticipant(status: string, holdExpiresAt: string | null) {
    return ['confirmed', 'attended', 'no_show'].includes(status) ||
      (status === 'held' && holdExpiresAt !== null && Date.parse(holdExpiresAt) > Date.now());
  }

  async function participantUser(request: Request) {
    const id = await actor(request);
    const {data, error} = await client().from('profiles').select('user_id').eq('id', id).single();
    if (error || !data?.user_id) throw new FinanceError('FORBIDDEN');
    return data.user_id;
  }

  async function participantDtoWithInvoice(participant:Record<string,unknown>) {
    const {data:invoice}=await client().from('invoices').select('id').eq('participant_id',participant.id).maybeSingle();
    return {...participantDto(participant),invoice_id:invoice?.id??null};
  }
  async function eventDto(eventId: string, publicOnly: boolean) {
    let query=client().from('events').select('id,title,description,starts_at,ends_at,registration_closes_at,timezone,capacity,price_amount,currency,status,visibility,venue_snapshot,venue_booking_status,estimated_total_cost,contributions_locked_at,contribution_mode,payment_mode,payment_due_at,payment_timing,hold_minutes,version,activity_types(slug,name)').eq('id',eventId);
    if(publicOnly)query=query.in('status',['published','recruiting','confirmed','completed']);
    const {data:e,error}=await query.single();
    if(error)throw new FinanceError('FORBIDDEN');
    const {count}=await client().from('event_participants').select('id',{count:'exact',head:true}).eq('event_id',e.id).in('status',['confirmed','attended','no_show']);
    const {count:chargeable}=await client().from('event_participants').select('id',{count:'exact',head:true}).eq('event_id',e.id).eq('chargeable',true).eq('status','confirmed');
    const {venue_snapshot,activity_types,...rest}=e;
    const activityType = Array.isArray(activity_types) ? activity_types[0] : activity_types;
    return {...rest,activity_type_slug:activityType?.slug??null,...(!publicOnly?{activity_type_name:activityType?.name??null}:{}),participants_count:count??0,estimated_per_person:chargeable?Math.ceil(Number(e.estimated_total_cost)/chargeable):null,venue:{name:venue_snapshot?.name?.trim()||'Venue belum ditentukan',address:venue_snapshot?.address??'',maps_url:venue_snapshot?.maps_url??'',...(venue_snapshot?.latitude!==undefined?{latitude:Number(venue_snapshot.latitude),longitude:Number(venue_snapshot.longitude)}:{}),...(venue_snapshot?.meeting_instructions?{meeting_instructions:venue_snapshot.meeting_instructions}:{}),...(!publicOnly&&venue_snapshot?.coarse_region_code?{coarse_region_code:venue_snapshot.coarse_region_code}:{})}};
  }
  return new Elysia({ aot: false })
    .onBeforeHandle(({set}) => {set.headers['cache-control']='no-store';})
    .onError(({ error, set }) => {
      const code = error instanceof Error ? error.message : '';
      if (!['UNAUTHORIZED','FORBIDDEN','CONFLICT','VERSION_CONFLICT','EVENT_FULL','REGISTRATION_CLOSED','INVALID_EVENT_STATE','ATTENDANCE_RECORDED','REASON_REQUIRED','STORAGE_UNAVAILABLE','INVALID_IMAGE','IMAGE_TOO_LARGE','INVALID_REQUEST','INVALID_UPLOAD','INVALID_PAYMENT_MODE','INVALID_BILLING_CONFIGURATION','INVALID_PAYMENT_DUE_AT','INVALID_PAYMENT_METHOD','INVOICE_NOT_PAYABLE','HOLD_EXPIRED','IDEMPOTENCY_MISMATCH','INVALID_EVIDENCE_STATE','EVIDENCE_REQUIRED','REVIEW_REASON_REQUIRED'].includes(code)) return;
      set.status = code === 'UNAUTHORIZED' ? 401 : code === 'FORBIDDEN' ? 403 : ['CONFLICT','VERSION_CONFLICT','EVENT_FULL','REGISTRATION_CLOSED','INVALID_EVENT_STATE','ATTENDANCE_RECORDED'].includes(code) ? 409 : code === 'STORAGE_UNAVAILABLE' ? 503 : 422;
      return { error: { code, message: 'Permintaan belum dapat diproses.' } };
    })
    .get('/participant/events', async ({request}) => {
      const userId = await participantUser(request);
      const {data, error} = await client().from('event_participants')
        .select('id,status,hold_expires_at,events!inner(id,title,starts_at,timezone,status,visibility),invoices(id,status)')
        .eq('user_id', userId).order('updated_at', {ascending:false}).order('id').limit(100);
      if (error) throw new FinanceError('STORAGE_UNAVAILABLE');
      return {data: (data ?? []).map(row => {
        const event = Array.isArray(row.events) ? row.events[0] : row.events;
        const invoice = Array.isArray(row.invoices) ? row.invoices[0] : row.invoices;
        return {
          id: event.id, title: event.title, starts_at: event.starts_at, timezone: event.timezone,
          event_status: event.status, participation_status: row.status,
          can_view: ['published','recruiting','confirmed','completed'].includes(event.status) &&
            (event.visibility === 'public' || canViewAsParticipant(row.status, row.hold_expires_at)),
          invoice: invoice ?? null,
        };
      })};
    })
    .get('/participant/events/:id', async ({request,params}) => {
      const userId = await participantUser(request);
      const {data, error} = await client().from('event_participants').select('status,hold_expires_at')
        .eq('event_id', params.id).eq('user_id', userId).maybeSingle();
      if (error) throw new FinanceError('STORAGE_UNAVAILABLE');
      if (!data || !canViewAsParticipant(data.status, data.hold_expires_at)) throw new FinanceError('FORBIDDEN');
      return {data: await eventDto(params.id, true)};
    },{params:t.Object({id:uuid})})
    .get('/organizer/events',async ({request,query})=>{
      const id=await actor(request);
      const {data:members,error:me}=await client().from('workspace_members').select('workspace_id').eq('profile_id',id).in('role',['owner','organizer']);
      const {data:roles,error:re}=await client().from('event_organizers').select('event_id').eq('profile_id',id).in('role',['owner','organizer']);
      if(me||re)throw new FinanceError('STORAGE_UNAVAILABLE');
      const filters=[...(members?.length?[`workspace_id.in.(${members.map(m=>m.workspace_id).join(',')})`]:[]),...(roles?.length?[`id.in.(${roles.map(r=>r.event_id).join(',')})`]:[])];
      if(!filters.length)return {data:[]};
      let events=client().from('events').select('id,title,status,visibility,starts_at,ends_at,timezone,venue_booking_status,estimated_total_cost,contributions_locked_at,archived_at').or(filters.join(','));
      if(query.view==='active') events=events.is('archived_at',null);
      if(query.view==='archived') events=events.not('archived_at','is',null);
      const {data,error}=await events.order('starts_at',{ascending:false}).order('id').limit(100);
      if(error)throw new FinanceError('STORAGE_UNAVAILABLE');return {data};
    },{query:t.Object({view:t.Optional(t.Union([t.Literal('active'),t.Literal('archived')]))})})
    .patch('/organizer/events/:id/archive',async ({request,params,body})=>{
      const actorId=await actor(request);
      const archived_at=await rpc('set_organizer_event_archive',{p_event:params.id,p_actor:actorId,p_archived:body.archived});
      return {data:{archived_at}};
    },{params:t.Object({id:uuid}),body:t.Object({archived:t.Boolean()},{additionalProperties:false})})
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
      const [event, { data, error }] = await Promise.all([
        eventDto(params.id, false),
        client().from('events').select('workspaces(name)').eq('id', params.id).single(),
      ]);
      if (error) throw new FinanceError('STORAGE_UNAVAILABLE');
      const workspace = Array.isArray(data.workspaces) ? data.workspaces[0] : data.workspaces;
      return { data: { ...event, workspace_name: workspace?.name ?? null } };
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
      if(body.billing_mode) {
        if(body.estimated_total_cost!==undefined||body.payment_timing!==undefined||!venue)throw new FinanceError('INVALID_REQUEST');
        return {data:await rpc('create_billed_event',{
          p_actor:id,p_workspace:body.workspace_id,p_activity_type:body.activity_type_id,p_title:body.title,
          p_description:body.description??'',p_starts_at:body.starts_at,p_ends_at:body.ends_at,
          p_registration_closes_at:body.registration_closes_at,p_timezone:body.timezone,p_capacity:body.capacity,
          p_visibility:body.visibility,p_venue_snapshot:venue,p_payment_mode:body.billing_mode,
          p_price_amount:body.price_amount??0,p_payment_due_at:body.payment_due_at??null,
          p_hold_minutes:body.hold_minutes??15,p_payment_method:body.payment_method_id??null,
        })};
      }
      if(body.estimated_total_cost===undefined||body.payment_timing===undefined||body.price_amount!==undefined||body.payment_due_at!==undefined||body.hold_minutes!==undefined||body.payment_method_id!==undefined)throw new FinanceError('INVALID_REQUEST');
      const {data,error}=await client().from('events').insert({...body,...(venue?{venue_snapshot:venue}:{}),organizer_profile_id:id,contribution_mode:'dynamic',payment_mode:'free',price_amount:0,status:'recruiting'}).select('id').single();
      if(error) throw new FinanceError('CONFLICT');
      return {data};
    },{body:t.Object({workspace_id:uuid,activity_type_id:uuid,title:t.String({minLength:1,maxLength:200}),description:t.Optional(t.String({maxLength:10000})),starts_at:t.String({format:'date-time'}),ends_at:t.String({format:'date-time'}),registration_closes_at:t.String({format:'date-time'}),timezone:t.String({minLength:1,maxLength:100}),capacity:t.Integer({minimum:1,maximum:100000}),estimated_total_cost:t.Optional(amount),payment_timing:t.Optional(t.Union([t.Literal('before_event'),t.Literal('after_event')])),billing_mode:t.Optional(t.Union([t.Literal('free'),t.Literal('before_event'),t.Literal('after_event')])),price_amount:t.Optional(amount),payment_due_at:t.Optional(t.String({format:'date-time'})),hold_minutes:t.Optional(t.Integer({minimum:1,maximum:1440})),payment_method_id:t.Optional(uuid),visibility:t.Union([t.Literal('public'),t.Literal('unlisted')]),venue_snapshot:t.Optional(venueSnapshot)},{additionalProperties:false})})
    .patch('/events/:id/planning',async ({request,params,body}) => {
      const actorId=await actor(request);
      const {expected_version,...patch}=body;
      const {data:event,error}=await client().from('events').select('contribution_mode').eq('id',params.id).single();
      if(error||!event)throw new FinanceError('FORBIDDEN');
      const common={
        p_event:params.id,p_actor:actorId,p_expected_version:expected_version,
        ...Object.fromEntries(Object.entries(patch).map(([field,value])=>[`p_${field}`,field==='venue_snapshot'&&value?normalizeVenueSnapshot(value as VenueSnapshot):value])),
      };
      if(event.contribution_mode==='dynamic')return {data:await rpc('update_dynamic_event',common)};
      const billed:Record<string,unknown>={...common};
      delete billed.p_estimated_total_cost;delete billed.p_payment_timing;delete billed.p_timezone;
      return {data:await rpc('update_billed_event',billed)};
    },{params:t.Object({id:uuid}),body:t.Object({expected_version:t.Integer({minimum:1}),title:t.Optional(t.String({minLength:1,maxLength:200})),description:t.Optional(t.String({maxLength:10000})),starts_at:t.Optional(t.String({format:'date-time'})),ends_at:t.Optional(t.String({format:'date-time'})),registration_closes_at:t.Optional(t.String({format:'date-time'})),timezone:t.Optional(t.String({minLength:1,maxLength:100})),capacity:t.Optional(t.Integer({minimum:1,maximum:100000})),estimated_total_cost:t.Optional(amount),payment_timing:t.Optional(t.Union([t.Literal('before_event'),t.Literal('after_event')])),venue_booking_status:t.Optional(t.Union([t.Literal('not_booked'),t.Literal('pending'),t.Literal('booked'),t.Literal('cancelled')])),status:t.Optional(t.Union([t.Literal('confirmed'),t.Literal('completed')])),venue_snapshot:t.Optional(venueSnapshot)},{additionalProperties:false,minProperties:2})})
    .post('/events/:id/join',async ({request,params}) => {
      const id=await actor(request);
      try { await publicEventAccess(params.id,request); }
      catch(error) { if(error instanceof FinanceError&&error.message==='FORBIDDEN')await rpc('manual_event_access',{p_event:params.id,p_actor:id});else throw error; }
      const {data:p}=await client().from('profiles').select('user_id').eq('id',id).single();
      if(!p) throw new FinanceError('FORBIDDEN');
      return {data:await participantDtoWithInvoice(await rpc('join_event',{p_event_id:params.id,p_user_id:p.user_id,p_actor_profile_id:id}))};
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
      return {data:data?await participantDtoWithInvoice(data):null};
    },{params:t.Object({id:uuid})})
    .post('/events/:id/participation/cancel',async ({request,params,body})=>{
      const bookingToken=request.headers.get('x-booking-token');
      const actorId=bookingToken?null:await actor(request);
      const guestHash=bookingToken?await tokenHash(bookingToken):null;
      const {data:event,error:eventError}=await client().from('events').select('contribution_mode').eq('id',params.id).single();
      if(eventError||!event)throw new FinanceError('FORBIDDEN');
      let participant;
      if(event.contribution_mode==='dynamic')participant=await rpc('cancel_own_dynamic_participation',{p_event:params.id,p_actor:actorId,p_guest_hash:guestHash,p_reason:body.reason});
      else {
        let participantId:string|undefined;
        if(guestHash) {
          const booking=await rpc('get_guest_booking',{p_event:params.id,p_token_hash:guestHash});
          participantId=(Array.isArray(booking)?booking[0]:booking)?.participant_id;
        } else {
          const {data:profile}=await client().from('profiles').select('user_id').eq('id',actorId!).single();
          const {data:own}=profile?await client().from('event_participants').select('id').eq('event_id',params.id).eq('user_id',profile.user_id).maybeSingle():{data:null};
          participantId=own?.id;
        }
        if(!participantId)throw new FinanceError('FORBIDDEN');
        participant=await rpc('cancel_participation',{p_participant_id:participantId,p_reason:body.reason,p_actor_profile_id:actorId,p_guest_session_hash:guestHash});
      }
      return {data:await participantDtoWithInvoice(participant)};
    },{params:t.Object({id:uuid}),body:t.Object({reason:t.String({minLength:1,maxLength:1000})},{additionalProperties:false})})
    .get('/events/:id/invites',async ({request,params})=>{
      await ownEvent(params.id,request);
      const {data,error}=await client().from('event_invites').select('id,expires_at,revoked_at,created_at').eq('event_id',params.id).order('created_at',{ascending:false});
      if(error)throw new FinanceError('STORAGE_UNAVAILABLE');
      return {data:data??[]};
    },{params:t.Object({id:uuid})})
    .get('/events/:id/share-link', async ({ request, params }) => {
      await ownEvent(params.id, request);
      const { data: invite, error } = await client().from('event_invites')
        .select('id,share_nonce,token_hash,expires_at,created_at,events!inner(visibility,status)')
        .eq('event_id', params.id).eq('events.visibility', 'unlisted')
        .in('events.status', ['published', 'recruiting', 'confirmed', 'completed'])
        .is('revoked_at', null).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('share_nonce', { ascending: true, nullsFirst: false }).limit(1).maybeSingle();
      if (error) throw new FinanceError('STORAGE_UNAVAILABLE');
      const link = invite?.share_nonce ? await shareLinkDto(params.id, invite) : null;
      return { data: { link, legacy_active: Boolean(invite && !link) } };
    }, { params: t.Object({ id: uuid }) })
    .post('/events/:id/invites',async ({request,params,body})=>{
      const actorId=await ownEvent(params.id,request);
      const nonce = crypto.randomUUID();
      const token = await shareToken(params.id, nonce);
      const invite = await rpc('ensure_event_share_link', {
        p_event: params.id, p_actor: actorId, p_share_nonce: nonce,
        p_token_hash: await tokenHash(token), p_expires_at: body.expires_at ?? null,
      });
      return { data: await shareLinkDto(params.id, invite) };
    },{params:t.Object({id:uuid}),body:t.Object({expires_at:t.Optional(t.String({format:'date-time'}))},{additionalProperties:false})})
    .post('/invites/:id/revoke',async ({request,params})=>{
      const invite=await rpc('revoke_event_invite',{p_invite:params.id,p_actor:await actor(request)});
      return {data:{id:invite.id,expires_at:invite.expires_at,revoked_at:invite.revoked_at,created_at:invite.created_at}};
    },{params:t.Object({id:uuid}),parse:'none'})
    .get('/payment-settings', async ({ request }) => {
      const id = await actor(request);
      const { data,error } = await client().from('organizer_payment_methods').select('id,type,recipient_name,is_active,created_at').eq('organizer_id',id).order('created_at');
      if (error) throw new FinanceError('STORAGE_UNAVAILABLE');
      return { data: (data ?? []).map(organizerPaymentMethodDto) };
    })
    .post('/payment-settings', async ({ request,body }) => {
      const id = await actor(request);
      if (body.type === 'static_qris') {
        if (!body.storage_path || !new RegExp(`^qris/${id}/[0-9a-f-]{36}\\.(png|jpg)$`).test(logicalKey(body.storage_path))) throw new FinanceError('FORBIDDEN');
        if (!await objectExists(body.storage_path)) throw new FinanceError('INVALID_IMAGE');
      }
      const method=await rpc('create_organizer_payment_method',{
        p_actor:id,p_type:body.type,p_recipient_name:body.recipient_name,
        p_storage_reference:body.storage_path??null,p_bank_details:body.bank_details??null,
      });
      return {data:organizerPaymentMethodDto(method as Record<string,unknown>)};
    }, { body:t.Object({type:t.Union([t.Literal('static_qris'),t.Literal('bank_transfer'),t.Literal('cash')]),recipient_name:t.String({minLength:1,maxLength:120}),storage_path:t.Optional(t.String({maxLength:512})),bank_details:t.Optional(t.Object({bank:t.String({minLength:1,maxLength:120}),account:t.String({minLength:1,maxLength:100})}))},{additionalProperties:false}) })
    .patch('/payment-settings/:id', async ({ request,params,body }) => {
      const id = await actor(request);
      const { data,error } = await client().from('organizer_payment_methods').update({is_active:body.is_active}).eq('id',params.id).eq('organizer_id',id).select('id,type,recipient_name,is_active,created_at').single();
      if (error) throw new FinanceError('FORBIDDEN');
      return { data: organizerPaymentMethodDto(data) };
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
      const {data:e,error}=await client().from('events').select('estimated_total_cost,contributions_locked_at,payment_timing,contribution_mode,price_amount,payment_mode').eq('id',params.id).single();
      const {data:participants,error:pe}=await client().from('event_participants').select('id,status,attendance_at,chargeable,users(display_name,profiles(id)),participant_charges(id,amount),invoices(id,amount_due,status,due_at)').eq('event_id',params.id);
      if(error||pe)throw new FinanceError('STORAGE_UNAVAILABLE');
      const rosterParticipants = (participants ?? []).map(({ users, ...participant }) => {
        const user = Array.isArray(users) ? users[0] : users;
        const profiles = user?.profiles;
        return {
          ...participant,
          users: user ? { display_name: user.display_name } : null,
          is_guest: Array.isArray(profiles) ? profiles.length === 0 : !profiles,
        };
      });
      if(e.contribution_mode==='legacy') {
        const invoices=(participants??[]).flatMap(participant=>participant.invoices??[]);
        const {data:entries,error:ledgerError}=invoices.length?await client().from('payment_ledger').select('invoice_id,entry_type,amount').in('invoice_id',invoices.map(invoice=>invoice.id)):{data:[],error:null};
        if(ledgerError)throw new FinanceError('STORAGE_UNAVAILABLE');
        const received=(entries??[]).filter(entry=>entry.entry_type==='receipt').reduce((sum,entry)=>sum+Number(entry.amount),0);
        const refunded=(entries??[]).filter(entry=>entry.entry_type==='refund').reduce((sum,entry)=>sum+Number(entry.amount),0);
        const charged=invoices.filter(invoice=>!['void','waived'].includes(invoice.status)).reduce((sum,invoice)=>sum+Number(invoice.amount_due),0);
        return {data:{...e,estimated_per_person:e.price_amount,summary:{charged,received,refunded,adjustments:0,outstanding:Math.max(charged-received+refunded,0),credit:Math.max(received-refunded-charged,0)},participants:rosterParticipants.map(participant=>({...participant,participant_charges:[]}))}};
      }
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
      return {data:{...e,estimated_per_person:n?Math.ceil(Number(e.estimated_total_cost)/n):null,summary,participants:rosterParticipants.map(p=>({...p,participant_charges:(p.participant_charges??[]).map(charge=>({...charge,balance:balanceByCharge.get(charge.id)??Number(charge.amount)}))}))}};
    },{params:t.Object({id:uuid})})
    .post('/participants/:id/attendance',async ({request,params,body})=>({data:await rpc('record_event_attendance',{p_participant:params.id,p_actor:await actor(request),p_status:body.status})}),{params:t.Object({id:uuid}),body:t.Object({status:t.Union([t.Literal('attended'),t.Literal('no_show')])},{additionalProperties:false})})
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
    .post('/participants/:id/cancel',async ({request,params,body})=>{
      const actorId=await actor(request);
      const {data:row}=await client().from('event_participants').select('event_id,events!inner(contribution_mode)').eq('id',params.id).single();
      if(!row)throw new FinanceError('FORBIDDEN');
      const event=Array.isArray(row.events)?row.events[0]:row.events;
      return {data:event?.contribution_mode==='dynamic'
        ?await rpc('cancel_dynamic_participant',{p_participant:params.id,p_actor:actorId,p_guest_hash:null,p_policy:body.policy,p_reason:body.reason,p_key:body.idempotency_key})
        :await rpc('cancel_participation',{p_participant_id:params.id,p_reason:body.reason,p_actor_profile_id:actorId,p_guest_session_hash:null})};
    },{params:t.Object({id:uuid}),body:t.Object({policy:t.Union([t.Literal('retain'),t.Literal('waive')]),reason,idempotency_key:key},{additionalProperties:false})})
    .post('/events/:id/cancel',async ({request,params,body})=>{
      const actorId=await actor(request);const {data:event}=await client().from('events').select('contribution_mode').eq('id',params.id).single();
      if(!event)throw new FinanceError('FORBIDDEN');
      if(event.contribution_mode==='dynamic')return {data:await rpc('cancel_dynamic_event',{p_event:params.id,p_actor:actorId,p_policy:body.policy,p_reason:body.reason,p_key:body.idempotency_key})};
      await rpc('cancel_event',{p_event_id:params.id,p_actor_profile_id:actorId,p_reason:body.reason});return {data:{ok:true}};
    },{params:t.Object({id:uuid}),body:t.Object({policy:t.Union([t.Literal('retain'),t.Literal('waive')]),reason,idempotency_key:t.String({minLength:1,maxLength:120})},{additionalProperties:false})})
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
    .get('/invoices/:id',async ({request,params,set})=>{
      set.headers['cache-control']='no-store';
      const {invoice,participant}=await invoiceAccess(params.id,request);
      const {data:methods,error:methodsError}=await client().from('event_payment_methods').select('id,method_type,instruction_snapshot').eq('event_id',participant.event_id).eq('enabled',true).order('created_at');
      const {data:attempts,error:attemptsError}=await client().from('payment_attempts').select('id,method_type,amount,currency,status,expires_at,review_deadline,exception_reason,created_at').eq('invoice_id',invoice.id).order('created_at',{ascending:false});
      if(methodsError||attemptsError)throw new FinanceError('STORAGE_UNAVAILABLE');
      return {data:{...invoice,participant_status:participant.status,overdue:invoice.status==='open'&&Date.parse(invoice.due_at)<Date.now(),methods:methods??[],attempts:attempts??[]}};
    },{params:t.Object({id:uuid})})
    .post('/invoices/:id/attempts',async ({request,params,body})=>{
      const access=await invoiceAccess(params.id,request);
      return {data:await rpc('create_payment_attempt',{p_invoice_id:params.id,p_method_id:body.method_id,p_key:body.idempotency_key,p_actor_profile_id:access.actor,p_guest_session_hash:access.hash})};
    },{params:t.Object({id:uuid}),body:t.Object({method_id:uuid,idempotency_key:key},{additionalProperties:false})})
    .post('/attempts/:id/proof',async ({request,params})=>{
      const {data:attempt,error}=await client().from('payment_attempts').select('id,invoice_id').eq('id',params.id).single();
      if(error||!attempt)throw new FinanceError('FORBIDDEN');
      const access=await invoiceAccess(attempt.invoice_id,request);
      const {bytes,mime,extension}=await imageBytes(request);
      const path=`proof/attempt/${params.id}/${crypto.randomUUID()}.${extension}`;
      let reference:string;
      try{reference=await files().put(path,{bytes,contentType:mime});}catch{throw new FinanceError('STORAGE_UNAVAILABLE');}
      try{return {data:await rpc('submit_manual_evidence',{p_attempt_id:params.id,p_storage_path:reference,p_mime:mime,p_size:bytes.byteLength,p_actor_profile_id:access.actor,p_guest_session_hash:access.hash})};}
      catch(error){try{await files().remove(reference);}catch{/* A later storage reconciliation can remove an object without evidence metadata. */}throw error;}
    },{params:t.Object({id:uuid}),parse:'none'})
    .get('/events/:id/invoice-reviews',async ({request,params,set})=>{
      set.headers['cache-control']='no-store';await ownEvent(params.id,request);
      const {data,error}=await client().from('payment_attempts').select('id,amount,currency,status,review_deadline,created_at,invoices!inner(invoice_number,event_participants!inner(event_id,users(display_name))),payment_evidence(storage_path,created_at)').eq('invoices.event_participants.event_id',params.id).in('status',['pending_review','expired','rejected']).order('created_at');
      if(error)throw new FinanceError('STORAGE_UNAVAILABLE');
      const reviews=await Promise.all((data??[]).map(async attempt=>({
        ...attempt,
        evidence:await Promise.all((attempt.payment_evidence??[]).map(async evidence=>({
          ...evidence,url:await files().signedDownloadUrl(evidence.storage_path,120),
        }))),
      })));
      return {data:reviews};
    },{params:t.Object({id:uuid})})
    .post('/attempts/:id/review',async ({request,params,body})=>({data:await rpc('approve_manual_payment',{p_attempt_id:params.id,p_actor_profile_id:await actor(request),p_decision:body.decision,p_reason:body.reason})}),{params:t.Object({id:uuid}),body:t.Object({decision:t.Union([t.Literal('approve'),t.Literal('reject')]),reason},{additionalProperties:false})})
    .post('/attempts/:id/refunds',async ({request,params,body})=>({data:await rpc('request_refund',{p_attempt_id:params.id,p_actor_profile_id:await actor(request),p_amount:body.amount,p_reason:body.reason,p_key:body.idempotency_key})}),{params:t.Object({id:uuid}),body:t.Object({amount:t.Integer({minimum:1,maximum:1e12}),reason,idempotency_key:key},{additionalProperties:false})})
    .post('/refunds/:id/complete',async ({request,params,body})=>({data:await rpc('record_refund',{p_refund_id:params.id,p_actor_profile_id:await actor(request),p_reference:body.reference,p_evidence_path:body.evidence_path})}),{params:t.Object({id:uuid}),body:t.Object({reference:t.String({minLength:1,maxLength:500}),evidence_path:t.String({minLength:1,maxLength:512})},{additionalProperties:false})})
    .get('/events/:id/payment-exceptions',async ({request,params,set})=>{
      set.headers['cache-control']='no-store';await ownEvent(params.id,request);
      const {data:attempts,error:attemptError}=await client().from('payment_attempts').select('id,status,exception_reason,amount,currency,created_at,invoices!inner(event_participants!inner(event_id))').eq('invoices.event_participants.event_id',params.id).not('exception_reason','is',null);
      const {data:refunds,error:refundError}=await client().from('refunds').select('id,attempt_id,amount,status,reason,provider_reference,evidence_path,created_at,invoices!inner(event_participants!inner(event_id))').eq('invoices.event_participants.event_id',params.id).order('created_at',{ascending:false});
      if(attemptError||refundError)throw new FinanceError('STORAGE_UNAVAILABLE');
      return {data:{attempts:attempts??[],refunds:refunds??[]}};
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
      const {data,error}=await client().from('manual_payment_records').select('id,amount,status,proof_storage_path,participant_charges!inner(event_participants!inner(event_id))').eq('participant_charges.event_participants.event_id',params.id);
      if(error) throw new FinanceError('STORAGE_UNAVAILABLE');
      return {data:await Promise.all((data??[]).map(async r=>{let proof_url:string|null=null;if(r.proof_storage_path)try{proof_url=await files().signedDownloadUrl(r.proof_storage_path,120);}catch{throw new FinanceError('STORAGE_UNAVAILABLE');}return manualPaymentReviewDto(r,proof_url);}))};
    },{params:t.Object({id:uuid})})
    .post('/payments/:id/review',async ({request,params,body}) => ({data:await rpc('review_manual_payment',{p_payment:params.id,p_actor:await actor(request),p_decision:body.decision,p_reason:body.reason})}),{params:t.Object({id:uuid}),body:t.Object({decision:t.Union([t.Literal('verified'),t.Literal('rejected')]),reason},{additionalProperties:false})})
    .post('/charges/:id/adjustments',async ({request,params,body}) => ({data:await rpc('adjust_contribution',{p_charge:params.id,p_actor:await actor(request),p_type:body.type,p_amount:body.amount,p_reason:body.reason,p_key:body.idempotency_key})}),{params:t.Object({id:uuid}),body:t.Object({type:t.Union([t.Literal('refund'),t.Literal('adjustment')]),amount:t.Integer({minimum:-1e12,maximum:1e12}),reason,idempotency_key:key},{additionalProperties:false})})
    .post('/internal/storage/orphans/cleanup',async ({request})=>{
      if(!serviceBearerMatches(request,storageCleanupKey))throw new FinanceError('FORBIDDEN');
      try{return {data:await uploads().cleanup(100)};}catch{throw new FinanceError('STORAGE_UNAVAILABLE');}
    },{parse:'none'})
    .post('/internal/jobs/payment-maintenance',async ({request,body})=>{
      if(!serviceBearerMatches(request,maintenanceKey))throw new FinanceError('FORBIDDEN');
      return {data:await rpc('run_payment_maintenance',{p_limit:body.limit??100})};
    },{body:t.Object({limit:t.Optional(t.Integer({minimum:1,maximum:500}))},{additionalProperties:false})});
}
