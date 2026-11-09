import { createApp } from './app.ts';
import { reverseGeoapify, searchGeoapify } from './venues.ts';
import { manualPaymentReviewDto, manualPaymentRoutes, organizerPaymentMethodDto } from './manual-payments.ts';
import { AccountServiceError, type AccountIdentity, type AccountService, type Profile, type ProfilePatch } from './account.ts';
import { GuestBookingError, type GuestBookingService } from './guest-booking.ts';
import type { EventInviteService } from './event-invite.ts';
import type { PrivateUploadService } from './private-uploads.ts';
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const app = createApp({ allowedOrigins: ['http://localhost:3000'], pocMode: true });
const base = 'http://localhost/dolend-api/v1';
const identity: AccountIdentity = { id: '11111111-1111-4111-8111-111111111111', email: 'dolen@example.com', googleVerified: true };
const profile: Profile = { id: identity.id, user_id: '22222222-2222-4222-8222-222222222222', display_name: 'Dolen', email: 'dolen@example.com', phone_normalized: null, bio: null, avatar_path: null, default_timezone: 'Asia/Jakarta', updated_at: '2026-10-27T00:00:00.000Z' };
function accountMock(overrides: Partial<AccountService> = {}): AccountService {
  return {
    authenticate: async (token) => token === 'valid-token' ? identity : null,
    bootstrapProfile: async () => profile,
    getProfile: async () => profile,
    updateProfile: async (_token, account, patch) => ({ ...profile, id: account.id, ...patch, updated_at: '2026-10-27T01:00:00.000Z' }),
    ...overrides,
  };
}
const authHeaders = { authorization: 'Bearer valid-token', 'content-type': 'application/json' };
const openEventInvites:EventInviteService={canAccess:async()=>true};
Deno.test('health, CORS and prefix', async () => {
  const response = await app.handle(new Request(`${base}/health`, { headers: { origin: 'http://localhost:3000' } }));
  assert(response.status === 200, `health: ${response.status}`);
  assert(response.headers.get('access-control-allow-origin') === 'http://localhost:3000', 'CORS missing');
  assert((await response.json()).data.service === 'dolend-api', 'wrong service');
  assert(response.headers.get('cache-control')==='no-store','API response is cacheable');
  assert(response.headers.get('x-content-type-options')==='nosniff','nosn header missing');
  assert(response.headers.get('referrer-policy')==='no-referrer','referrer policy missing');
});
Deno.test('preflight allowed and untrusted origin rejected', async () => {
  const allowed = await app.handle(new Request(`${base}/me`, { method: 'OPTIONS', headers: { origin: 'http://localhost:3000' } }));
  assert(allowed.status === 204, `preflight: ${allowed.status}`);
  assert(allowed.headers.get('access-control-allow-origin') === 'http://localhost:3000', 'preflight CORS missing');
  const denied = await app.handle(new Request(`${base}/health`, { headers: { origin: 'https://untrusted.example' } }));
  assert(denied.status === 403, 'origin accepted');
});
Deno.test('orphan cleanup requires the server credential',async()=>{
  let calls=0;
  const privateUploadService:PrivateUploadService={
    upload:async()=>{throw new Error('not used');},
    cleanup:async()=>{calls++;return {claimed:1,deleted:1,failed:0};},
  };
  const cleanupKey='server-cleanup-key'.padEnd(32,'x');
  const cleanupApp=createApp({allowedOrigins:[],privateUploadService,storageCleanupKey:cleanupKey});
  const endpoint=`${base}/internal/storage/orphans/cleanup`;
  const shortKeyApp=createApp({allowedOrigins:[],privateUploadService,storageCleanupKey:'too-short'});
  assert((await shortKeyApp.handle(new Request(endpoint,{method:'POST',headers:{authorization:'Bearer too-short'}}))).status===403,'short cleanup credential accepted');
  assert((await cleanupApp.handle(new Request(endpoint,{method:'POST'}))).status===403,'missing cleanup credential accepted');
  assert((await cleanupApp.handle(new Request(endpoint,{method:'POST',headers:{authorization:'Bearer wrong-key'}}))).status===403,'wrong cleanup credential accepted');
  const response=await cleanupApp.handle(new Request(endpoint,{method:'POST',headers:{authorization:`Bearer ${cleanupKey}`}}));
  assert(response.status===200,`cleanup failed: ${response.status}`);
  assert((await response.json()).data.deleted===1&&calls===1,'cleanup service not called exactly once');
});
Deno.test('payment maintenance rejects missing or wrong job credential',async()=>{
  const workerApp=createApp({allowedOrigins:[],maintenanceKey:'maintenance-key'.padEnd(32,'x')});
  const endpoint=`${base}/internal/jobs/payment-maintenance`;
  const request=(authorization?:string)=>new Request(endpoint,{method:'POST',headers:{'content-type':'application/json',...(authorization?{authorization}:{})},body:'{}'});
  assert((await workerApp.handle(request())).status===403,'missing job credential accepted');
  assert((await workerApp.handle(request('Bearer wrong-key'))).status===403,'wrong job credential accepted');
});
Deno.test('missing member session rejected before SDK', async () => {
  const response = await app.handle(new Request(`${base}/me`));
  assert(response.status === 401, 'missing JWT accepted');
});
Deno.test('profile requires a valid Google member session', async () => {
  const protectedApp = createApp({ allowedOrigins: [], accountService: accountMock() });
  assert((await protectedApp.handle(new Request(`${base}/profile`))).status === 401, 'missing token accepted');
  assert((await protectedApp.handle(new Request(`${base}/profile`, { headers: { authorization: 'Bearer invalid' } }))).status === 401, 'invalid token accepted');
  const unverified = createApp({ allowedOrigins: [], accountService: accountMock({ authenticate: async () => ({ ...identity, googleVerified: false }) }) });
  const response = await unverified.handle(new Request(`${base}/profile`, { headers: authHeaders }));
  assert(response.status === 403, 'non-Google identity accepted');
  assert((await response.json()).error.code === 'GOOGLE_ACCOUNT_REQUIRED', 'wrong verification error');
});
Deno.test('Google profile bootstrap binds owner to the JWT', async () => {
  let seenIdentity = '';
  const protectedApp = createApp({ allowedOrigins: [], accountService: accountMock({
    bootstrapProfile: async (_token, account) => { seenIdentity = account.id; return profile; },
  }) });
  const response = await protectedApp.handle(new Request(`${base}/profile/bootstrap`, { method: 'POST', headers: authHeaders, body: '{}' }));
  assert(response.status === 201, `profile bootstrap: ${response.status}`);
  assert(seenIdentity === identity.id, 'bootstrap owner not bound to JWT');
});
Deno.test('profile read returns only the authenticated owner projection', async () => {
  let seenIdentity = '';
  const protectedApp = createApp({ allowedOrigins: [], accountService: accountMock({
    getProfile: async (_token, account) => { seenIdentity = account.id; return profile; },
  }) });
  const response = await protectedApp.handle(new Request(`${base}/profile`, { headers: authHeaders }));
  assert(response.status === 200, `profile read: ${response.status}`);
  const payload = await response.json();
  assert(seenIdentity === identity.id, 'identity came from request input');
  assert(payload.data.email === identity.email, 'owner email missing');
  assert(payload.data.phone_normalized === null, 'unexpected phone identity');
});
Deno.test('profile update allowlists editable fields and binds owner to JWT', async () => {
  let seenIdentity = '';
  let seenPatch: ProfilePatch = {};
  const protectedApp = createApp({ allowedOrigins: [], accountService: accountMock({
    updateProfile: async (_token, account, patch) => { seenIdentity = account.id; seenPatch = patch; return { ...profile, ...patch }; },
  }) });
  const response = await protectedApp.handle(new Request(`${base}/profile`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ bio: 'Main tiap pekan', default_timezone: 'Asia/Jakarta' }) }));
  assert(response.status === 200, `profile update: ${response.status}`);
  assert(seenIdentity === identity.id, 'profile owner not bound to JWT');
  assert(seenPatch.bio === 'Main tiap pekan', 'bio not forwarded');
  const injected = await protectedApp.handle(new Request(`${base}/profile`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ user_id: '33333333-3333-4333-8333-333333333333', bio: 'ambil akun' }) }));
  assert(injected.status === 400, 'foreign user_id accepted');
});
Deno.test('profile identity mismatch, invalid data and storage failure do not leak internals', async () => {
  for (const [code, status] of [['IDENTITY_MISMATCH', 403], ['INVALID_PROFILE', 422], ['ACCOUNT_STORAGE_UNAVAILABLE', 503]] as const) {
    const protectedApp = createApp({ allowedOrigins: [], accountService: accountMock({ getProfile: async () => { throw new AccountServiceError(code); } }) });
    const response = await protectedApp.handle(new Request(`${base}/profile`, { headers: authHeaders }));
    assert(response.status === status, `wrong ${code} status`);
    const payload = await response.json();
    assert(!JSON.stringify(payload).includes('stack'), 'internal detail leaked');
  }
});
Deno.test('JSON validation rejects invalid data', async () => {
  const response = await app.handle(new Request(`${base}/poc/echo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: '' }) }));
  assert(response.status === 400, `validation: ${response.status}`);
});
Deno.test('guest booking returns a one-time bearer token and maps safe errors', async () => {
  let seenClientAddress = '';
  const guestBookingService: GuestBookingService = {
    create: async (input) => { seenClientAddress=input.clientAddress; return { participant_id: input.eventId, status: 'confirmed', booking_token: 'secret-token' }; },
    get: async (eventId, token) => token === 'a'.repeat(43) ? { participant_id: eventId, charge_id: null, status: 'confirmed', hold_expires_at: null, confirmed_at: '2026-10-28T00:00:00.000Z', updated_at: '2026-10-28T00:00:00.000Z' } : null,
    recover: async () => ({participant_id:eventId,event_id:eventId,booking_token:'recovered-token'}),
  };
  const bookingApp = createApp({ allowedOrigins: [], guestBookingService,eventInviteService:openEventInvites });
  const eventId = '44444444-4444-4444-8444-444444444444';
  const response = await bookingApp.handle(new Request(`${base}/events/${eventId}/guest-bookings`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': 'spoofed, 203.0.113.8' }, body: JSON.stringify({ display_name: 'Guest', whatsapp: '081234567890' }),
  }));
  assert(response.status === 201, `guest booking: ${response.status}`);
  assert(seenClientAddress === '203.0.113.8', 'proxy client address not forwarded');
  assert(response.headers.get('cache-control') === 'no-store', 'booking token response is cacheable');
  assert((await response.json()).data.booking_token === 'secret-token', 'booking token missing');
  const statusResponse = await bookingApp.handle(new Request(`${base}/events/${eventId}/guest-bookings/me`, { headers: { 'x-booking-token': 'a'.repeat(43) } }));
  assert(statusResponse.status === 200, 'booking status unavailable with token');
  assert((await statusResponse.json()).data.status === 'confirmed', 'wrong booking status');
  assert((await bookingApp.handle(new Request(`${base}/events/${eventId}/guest-bookings/me`))).status === 401, 'missing booking token accepted');
  const conflictApp = createApp({ allowedOrigins: [], eventInviteService:openEventInvites,guestBookingService: {
    create: async () => { throw new GuestBookingError('BOOKING_ALREADY_EXISTS'); },
    get: async () => null,
    recover: async () => { throw new GuestBookingError('BOOKING_UNAVAILABLE'); },
  } });
  const conflict = await conflictApp.handle(new Request(`${base}/events/${eventId}/guest-bookings`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ display_name: 'Guest', whatsapp: '081234567890' }),
  }));
  assert(conflict.status === 409, 'duplicate booking did not conflict');
  assert(!JSON.stringify(await conflict.json()).includes('secret-token'), 'booking token leaked');
  const limitedApp = createApp({ allowedOrigins: [], eventInviteService:openEventInvites,guestBookingService: {
    create: async () => { throw new GuestBookingError('RATE_LIMITED',321); },
    get: async () => null,
    recover: async () => { throw new GuestBookingError('BOOKING_UNAVAILABLE'); },
  } });
  const limited = await limitedApp.handle(new Request(`${base}/events/${eventId}/guest-bookings`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ display_name: 'Guest', whatsapp: '081234567890' }),
  }));
  assert(limited.status === 429, 'rate limit did not return 429');
  assert(limited.headers.get('retry-after') === '321', 'retry window missing');
  const recoveryApp=createApp({allowedOrigins:[],accountService:accountMock(),guestBookingService,eventInviteService:openEventInvites});
  const recovered=await recoveryApp.handle(new Request(`${base}/participants/${eventId}/guest-token`,{method:'POST',headers:{authorization:'Bearer valid-token'}}));
  assert(recovered.status===200,'organizer could not rotate guest token');
  assert(recovered.headers.get('cache-control')==='no-store','recovered token response is cacheable');
  assert((await recovered.json()).data.booking_token==='recovered-token','recovered token missing');
});
Deno.test('guest booking rejects a missing or revoked event invitation',async()=>{
  let created=false;
  const protectedApp=createApp({allowedOrigins:[],eventInviteService:{canAccess:async(_event,token)=>token==='valid-invite'},guestBookingService:{
    create:async()=>{created=true;return {participant_id:'44444444-4444-4444-8444-444444444444',status:'confirmed',booking_token:'booking'};},
    get:async()=>null,recover:async()=>{throw new GuestBookingError('BOOKING_UNAVAILABLE');},
  }});
  const response=await protectedApp.handle(new Request(`${base}/events/44444444-4444-4444-8444-444444444444/guest-bookings`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({display_name:'Guest',whatsapp:'081234567890'})}));
  assert(response.status===403,`missing invite accepted: ${response.status}`);
  assert((await response.json()).error.code==='INVITE_REQUIRED','wrong invite error');
  assert(!created,'booking was created before invite verification');
});
Deno.test('POC route absent by default', async () => {
  const production = createApp({ allowedOrigins: [] });
  const response = await production.handle(new Request(`${base}/poc/echo`, { method: 'POST' }));
  assert(response.status === 404, 'POC exposed by default');
});
Deno.test('100 smoke requests and 20 concurrent JSON requests', async () => {
  for (let i = 0; i < 100; i++) {
    const response = await app.handle(new Request(`${base}/health`));
    assert(response.status === 200, 'smoke failed');
    await response.text();
  }
  const responses = await Promise.all(Array.from({ length: 20 }, (_, i) => app.handle(new Request(`${base}/poc/echo`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: String(i) }),
  }))));
  for (const [i, response] of responses.entries()) {
    assert(response.status === 200, `concurrent ${i}: ${response.status}`);
    assert((await response.json()).data.message === String(i), 'request data crossed');
  }
});

Deno.test('manual finance endpoints reject anonymous organizers and invalid payloads', async () => {
  const finance = createApp({allowedOrigins:[], accountService:null});
  for (const [path,method,body] of [
    ['/payment-settings','GET',undefined],
    ['/organizer/workspaces','GET',undefined],
    ['/participant/events','GET',undefined],
    ['/participant/events/11111111-1111-4111-8111-111111111111','GET',undefined],
    ['/events/11111111-1111-4111-8111-111111111111/participation','GET',undefined],
    ['/events/11111111-1111-4111-8111-111111111111/participation/cancel','POST',{reason:'Tidak jadi ikut'}],
    ['/events/11111111-1111-4111-8111-111111111111/contributions/lock','POST',undefined],
    ['/events/11111111-1111-4111-8111-111111111111/cancel','POST',{policy:'waive',reason:'Cancelled',idempotency_key:'cancel-1'}],
    ['/participants/11111111-1111-4111-8111-111111111111/guest-token','POST',undefined],
    ['/payments/11111111-1111-4111-8111-111111111111/review','POST',{decision:'verified',reason:'Cash received'}],
  ] as const) {
    const response=await finance.handle(new Request(`http://localhost/dolend-api/v1${path}`,{method,headers:{'content-type':'application/json'},...(method==='POST'?{body:JSON.stringify(body??{})}:{})}));
    if(response.status!==401) throw new Error(`Expected 401 for ${path}, got ${response.status}: ${await response.text()}`);
  }
});

Deno.test('organizer roster reads participant users embedded as objects', async () => {
  const originalFetch = globalThis.fetch;
  let contributionMode = 'legacy';
  const participants = [
    { id: 'member', users: { display_name: 'Anggota', profiles: { id: 'profile' } } },
    { id: 'guest', users: { display_name: 'Tamu', profiles: null } },
  ];
  globalThis.fetch = (input) => {
    const path = new URL(String(input)).pathname;
    if (path === '/rest/v1/rpc/manual_event_access') return Promise.resolve(Response.json(null));
    if (path === '/rest/v1/events') return Promise.resolve(Response.json({ contribution_mode: contributionMode }));
    if (path === '/rest/v1/event_participants') return Promise.resolve(Response.json(participants));
    throw new Error(`Unexpected roster request: ${path}`);
  };
  try {
    const routes = manualPaymentRoutes(accountMock(), 'http://supabase.test', 'test-key');
    for (contributionMode of ['legacy', 'dynamic']) {
      const response = await routes.handle(new Request(`http://localhost/events/${identity.id}/roster`, { headers: authHeaders }));
      assert(response.ok, `Expected ${contributionMode} roster, got ${response.status}`);
      const { data } = await response.json();
      assert(data.participants[0]?.is_guest === false, 'Member marked as guest');
      assert(data.participants[1]?.is_guest === true, 'Guest marked as member');
      assert(data.participants[0]?.users?.display_name === 'Anggota', 'Member name missing');
      assert(!('profiles' in data.participants[0].users), 'Roster exposes internal profile data');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('event roster exposes display names only after event access is verified', async () => {
  const originalFetch = globalThis.fetch;
  let rosterRequests = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === '/rest/v1/events') return Response.json({ id: identity.id, venue_snapshot: {} });
    if (url.pathname === '/rest/v1/event_participants') {
      assert(url.searchParams.get('event_id') === `eq.${identity.id}`, 'Roster is not scoped to the event');
      if (init?.method === 'HEAD') return new Response(null, { headers: { 'content-range': '*/12' } });
      rosterRequests++;
      assert(url.searchParams.get('select') === 'users(display_name)', 'Roster selected non-display fields');
      assert(url.searchParams.get('status') === 'in.(confirmed,attended,no_show)', 'Roster includes unconfirmed participants');
      assert(url.searchParams.get('offset') === '10' && url.searchParams.get('limit') === '10', 'Roster is not paginated');
      return Response.json([{ users: { display_name: 'Tamu Contoh' } }, { users: [{ display_name: 'Anggota Contoh' }] }]);
    }
    throw new Error(`Unexpected event roster request: ${url.pathname}`);
  };
  try {
    const validInvite = 'i'.repeat(43);
    const invites: EventInviteService = { canAccess: async (_, token) => token === validInvite };
    const routes = manualPaymentRoutes(null, 'http://supabase.test', 'test-key', undefined, null, null, invites);
    const endpoint = `http://localhost/events/${identity.id}?roster_page=2`;
    const denied = await routes.handle(new Request(endpoint));
    assert(denied.status === 403, 'Restricted event exposed roster to anonymous visitor');
    const response = await routes.handle(new Request(endpoint, { headers: { 'x-invite-token': validInvite } }));
    assert(response.ok, `Expected event detail, got ${response.status}`);
    const { data } = await response.json();
    assert(rosterRequests === 1, 'Denied request queried the roster');
    assert(JSON.stringify(data.participant_roster) === JSON.stringify({ page: 2, names: ['Tamu Contoh', 'Anggota Contoh'] }), 'Unexpected roster projection');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('event share link returns the same organizer-only token after creation', async () => {
  const originalFetch = globalThis.fetch;
  let status = 'recruiting';
  let stored: { id: string; share_nonce: string; token_hash: string; expires_at: string; created_at: string } | null = null;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const path = url.pathname;
    if (path === '/rest/v1/rpc/manual_event_access') return Response.json(null);
    if (path === '/rest/v1/events') return Response.json({ status });
    if (path === '/rest/v1/rpc/ensure_event_share_link') {
      const body = JSON.parse(String(init?.body));
      stored ??= {
        id: identity.id,
        share_nonce: body.p_share_nonce,
        token_hash: body.p_token_hash,
        expires_at: '2027-01-01T00:00:00Z',
        created_at: '2026-11-07T00:00:00Z',
      };
      return Response.json(stored);
    }
    if (path === '/rest/v1/event_invites') {
      assert(url.searchParams.get('events.status') === 'in.(published,confirmed,completed)', 'Share-link lookup must filter event status');
      return Response.json(stored ? [stored] : []);
    }
    throw new Error(`Unexpected share-link request: ${path}`);
  };
  try {
    const routes = manualPaymentRoutes(accountMock(), 'http://supabase.test', 'test-key', 'fixture-pepper'.repeat(3));
    const endpoint = `http://localhost/events/${identity.id}`;
    const create = () => routes.handle(new Request(`${endpoint}/invites`, { method: 'POST', headers: authHeaders, body: '{}' }));
    const blocked = await create();
    assert(!blocked.ok && stored === null, 'Unconfirmed event created an invite');
    status = 'confirmed';
    const created = await create();
    assert(created.ok, `Expected share-link creation, got ${created.status}`);
    const first = (await created.json()).data;
    assert(/^[A-Za-z0-9_-]{43}$/.test(first.token), 'Invalid invite token format');
    assert((await (await create()).json()).data?.token === first.token, 'Retry returned a different token');
    const read = await routes.handle(new Request(`${endpoint}/share-link`, { headers: authHeaders }));
    assert(read.ok && read.headers.get('cache-control') === 'no-store', 'Share link must be served without caching');
    const { link } = (await read.json()).data;
    assert(link?.token === first.token && !('token_hash' in link) && !('share_nonce' in link), 'Share-link response changed token or exposed internals');
    const anonymous = await routes.handle(new Request(`${endpoint}/share-link`));
    assert(!anonymous.ok, 'Anonymous request obtained a share link');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('venue links only accept HTTPS Google Maps destinations', async () => {
  const {isSafeMapsUrl,normalizeVenueSnapshot}=await import('./manual-payments.ts');
  assert(isSafeMapsUrl(''),'empty optional URL rejected');
  assert(isSafeMapsUrl('https://www.google.com/maps/place/Jakarta'),'Google Maps URL rejected');
  assert(isSafeMapsUrl('https://maps.google.com/?q=Jakarta'),'maps.google.com URL rejected');
  assert(isSafeMapsUrl('https://maps.app.goo.gl/o2iqwBVxs92kWVyZ6'),'official Google Maps short URL rejected');
  assert(!isSafeMapsUrl('http://www.google.com/maps/place/Jakarta'),'HTTP Maps URL accepted');
  assert(!isSafeMapsUrl('https://evil.example/maps'),'foreign venue URL accepted');
  assert(!isSafeMapsUrl('https://user@www.google.com/maps/place/Jakarta'),'credentialed Maps URL accepted');
  const venue=normalizeVenueSnapshot({name:' GOR ',address:' Jakarta ',maps_url:'',latitude:-6.2,longitude:106.816666,meeting_instructions:' Lobi utama '});
  assert(venue.maps_url.includes('query=-6.2%2C106.816666'),'coordinate Maps URL was not generated');
  assert(venue.name==='GOR'&&venue.meeting_instructions==='Lobi utama','venue snapshot was not normalized');
  let pairRejected=false;
  try{normalizeVenueSnapshot({name:'GOR',address:'Jakarta',maps_url:'',latitude:-6.2});}catch{pairRejected=true;}
  assert(pairRejected,'partial coordinates accepted');
});

Deno.test('manual payment DTOs exclude raw storage and internal payment fields', () => {
  const method = organizerPaymentMethodDto({
    id: 'method-id', type: 'static_qris', recipient_name: 'Organizer', is_active: true,
    created_at: '2026-11-05T00:00:00Z', storage_path: 'qris/private.png', bank_details: { account: 'private' },
    organizer_id: 'owner-id', provider_payload: { secret: 'excluded' },
  });
  assert(JSON.stringify(method) === JSON.stringify({
    id: 'method-id', type: 'static_qris', recipient_name: 'Organizer', is_active: true, created_at: '2026-11-05T00:00:00Z',
  }), 'payment method DTO contains fields outside its allowlist');

  const review = manualPaymentReviewDto({
    id: 'payment-id', amount: 1000, status: 'pending_verification', proof_storage_path: 'proof/private.png',
    idempotency_key: 'internal-key', recorded_by: 'profile-id', participant_charges: { participant_id: 'participant-id' },
  }, 'https://signed.example.test/proof');
  assert(JSON.stringify(review) === JSON.stringify({
    id: 'payment-id', amount: 1000, status: 'pending_verification', proof_url: 'https://signed.example.test/proof',
  }), 'payment review DTO contains raw evidence path or internal fields');
});

Deno.test('event planning requires an optimistic version', async () => {
  const protectedApp=createApp({allowedOrigins:[],accountService:accountMock()});
  const eventId='44444444-4444-4444-8444-444444444444';
  const missing=await protectedApp.handle(new Request(`${base}/events/${eventId}/planning`,{method:'PATCH',headers:authHeaders,body:JSON.stringify({status:'confirmed'})}));
  assert(missing.status===422||missing.status===400,`missing version accepted: ${missing.status}`);
  const empty=await protectedApp.handle(new Request(`${base}/events/${eventId}/planning`,{method:'PATCH',headers:authHeaders,body:JSON.stringify({expected_version:1})}));
  assert(empty.status===422||empty.status===400,`empty event patch accepted: ${empty.status}`);
});

Deno.test('payment images reject spoofed content and oversized streams', async () => {
  const {imageBytes}=await import('./manual-payments.ts');
  for (const bytes of [new TextEncoder().encode('not a PNG'),new Uint8Array(2097153)]) {
    let rejected=false;
    try { await imageBytes(new Request('http://localhost/upload',{method:'POST',body:bytes})); } catch { rejected=true; }
    if(!rejected)throw new Error('Invalid image accepted');
  }
  const result=await imageBytes(new Request('http://localhost/upload',{method:'POST',body:Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='),c=>c.charCodeAt(0))}));
  if(result.mime!=='image/png')throw new Error('PNG detection failed');
});

Deno.test('empty declared JSON is rejected before parsing',async()=>{
 const response=await app.handle(new Request(`${base}/profile/bootstrap`,{method:'POST',headers:{'content-type':'application/json'}}));
 assert(response.status===400,'empty JSON must return a safe validation error');
});

Deno.test('venue suggestions use Indonesia filter and return only usable fields', async () => {
  const request: typeof fetch = async (input) => {
    const url = new URL(String(input));
    assert(url.hostname === 'api.geoapify.com' && url.searchParams.get('filter') === 'countrycode:id', 'expected Indonesia search');
    return Response.json({ results: [
      { name: 'GOR Uji', formatted: 'Jalan Uji', lat: -6.2, lon: 106.8, place_id: 'mock-place', ignored: 'mock' },
      { name: 'Invalid', lat: 120, lon: 106.8 },
    ] });
  };
  const places = await searchGeoapify('GOR Uji', 'fixture', request);
  assert(places?.length === 1 && places[0].place_id === 'mock-place' && !('ignored' in places[0]), 'expected allowlisted venue');
  const limited = await searchGeoapify('GOR Uji', 'fixture', async () => new Response(null, { status: 429 }));
  assert(limited === null, 'provider throttling must activate fallback');
});

Deno.test('reverse venue lookup keeps the pin and accepts a name only for a nearby named place', async () => {
  const mock = (result_type: string, distance: number): typeof fetch => async input => {
    const url = new URL(String(input));
    assert(url.pathname === '/v1/geocode/reverse' && url.searchParams.get('lat') === '-7.98', 'expected reverse lookup at pin');
    return Response.json({ results: [{
      name: 'GOR Uji', formatted: 'Jalan Uji, Malang', result_type, distance, lat: -8, lon: 112.6,
    }] });
  };
  const named = (await reverseGeoapify(-7.98, 112.63, 'fixture', mock('amenity', 20)))?.[0];
  assert(named?.name === 'GOR Uji' && named.latitude === -7.98 && named.longitude === 112.63, 'named nearby result must preserve pin');
  const street = (await reverseGeoapify(-7.98, 112.63, 'fixture', mock('street', 20)))?.[0];
  assert(street?.name === '' && street.address === 'Jalan Uji, Malang', 'a street is an address, not a venue name');
  const distant = await reverseGeoapify(-7.98, 112.63, 'fixture', mock('amenity', 300));
  assert(distant?.length === 0, 'distant matches must not fill the form');
});
