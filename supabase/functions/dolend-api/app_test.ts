import { createApp } from './app.ts';
import { AccountServiceError, type AccountIdentity, type AccountService, type Profile, type ProfilePatch } from './account.ts';
import { GuestBookingError, type GuestBookingService } from './guest-booking.ts';
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
Deno.test('health, CORS and prefix', async () => {
  const response = await app.handle(new Request(`${base}/health`, { headers: { origin: 'http://localhost:3000' } }));
  assert(response.status === 200, `health: ${response.status}`);
  assert(response.headers.get('access-control-allow-origin') === 'http://localhost:3000', 'CORS missing');
  assert((await response.json()).data.service === 'dolend-api', 'wrong service');
});
Deno.test('preflight allowed and untrusted origin rejected', async () => {
  const allowed = await app.handle(new Request(`${base}/me`, { method: 'OPTIONS', headers: { origin: 'http://localhost:3000' } }));
  assert(allowed.status === 204, `preflight: ${allowed.status}`);
  assert(allowed.headers.get('access-control-allow-origin') === 'http://localhost:3000', 'preflight CORS missing');
  const denied = await app.handle(new Request(`${base}/health`, { headers: { origin: 'https://untrusted.example' } }));
  assert(denied.status === 403, 'origin accepted');
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
  const bookingApp = createApp({ allowedOrigins: [], guestBookingService });
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
  const conflictApp = createApp({ allowedOrigins: [], guestBookingService: {
    create: async () => { throw new GuestBookingError('BOOKING_ALREADY_EXISTS'); },
    get: async () => null,
    recover: async () => { throw new GuestBookingError('BOOKING_UNAVAILABLE'); },
  } });
  const conflict = await conflictApp.handle(new Request(`${base}/events/${eventId}/guest-bookings`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ display_name: 'Guest', whatsapp: '081234567890' }),
  }));
  assert(conflict.status === 409, 'duplicate booking did not conflict');
  assert(!JSON.stringify(await conflict.json()).includes('secret-token'), 'booking token leaked');
  const limitedApp = createApp({ allowedOrigins: [], guestBookingService: {
    create: async () => { throw new GuestBookingError('RATE_LIMITED',321); },
    get: async () => null,
    recover: async () => { throw new GuestBookingError('BOOKING_UNAVAILABLE'); },
  } });
  const limited = await limitedApp.handle(new Request(`${base}/events/${eventId}/guest-bookings`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ display_name: 'Guest', whatsapp: '081234567890' }),
  }));
  assert(limited.status === 429, 'rate limit did not return 429');
  assert(limited.headers.get('retry-after') === '321', 'retry window missing');
  const recoveryApp=createApp({allowedOrigins:[],accountService:accountMock(),guestBookingService});
  const recovered=await recoveryApp.handle(new Request(`${base}/participants/${eventId}/guest-token`,{method:'POST',headers:{authorization:'Bearer valid-token'}}));
  assert(recovered.status===200,'organizer could not rotate guest token');
  assert(recovered.headers.get('cache-control')==='no-store','recovered token response is cacheable');
  assert((await recovered.json()).data.booking_token==='recovered-token','recovered token missing');
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
    ['/events/11111111-1111-4111-8111-111111111111/contributions/lock','POST',undefined],
    ['/participants/11111111-1111-4111-8111-111111111111/guest-token','POST',undefined],
    ['/payments/11111111-1111-4111-8111-111111111111/review','POST',{decision:'verified',reason:'Cash received'}],
  ] as const) {
    const response=await finance.handle(new Request(`http://localhost/dolend-api/v1${path}`,{method,headers:{'content-type':'application/json'},...(method==='POST'?{body:JSON.stringify(body??{})}:{})}));
    if(response.status!==401) throw new Error(`Expected 401 for ${path}, got ${response.status}: ${await response.text()}`);
  }
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
