import { FinanceError, manualPaymentRoutes } from './manual-payments.ts';
import { Elysia, t } from 'elysia';
import { AccountServiceError, createSupabaseAccountService, type AccountIdentity, type AccountService, type ProfilePatch } from './account.ts';
import { clientAddressFrom, createSupabaseGuestBookingService, GuestBookingError, type GuestBookingService } from './guest-booking.ts';

type Options = { allowedOrigins: string[]; pocMode?: boolean; accountService?: AccountService | null; guestBookingService?: GuestBookingService | null };
export function createApp({ allowedOrigins, pocMode = false, accountService, guestBookingService }: Options) {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const rateLimitPepper = Deno.env.get('RATE_LIMIT_PEPPER');
  const accounts = accountService === undefined && url && key ? createSupabaseAccountService(url, key) : accountService;
  const guestBookings = guestBookingService === undefined && url && serviceRoleKey && rateLimitPepper && rateLimitPepper.length>=32
    ? createSupabaseGuestBookingService(url, serviceRoleKey, rateLimitPepper)
    : guestBookingService;
  const tokenFrom = (request: Request) => request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  const authenticate = async (request: Request): Promise<{ token: string; identity: AccountIdentity } | null> => {
    const token = tokenFrom(request);
    if (!token || !accounts) return null;
    const identity = await accounts.authenticate(token);
    return identity ? { token, identity } : null;
  };
  const serviceFailure = (error: unknown, set: { status?: number | string }) => {
    if (error instanceof AccountServiceError && error.code === 'IDENTITY_MISMATCH') {
      set.status = 403;
      return { code: 'IDENTITY_MISMATCH', message: 'Identitas akun tidak cocok.' };
    }
    if (error instanceof AccountServiceError && error.code === 'INVALID_PROFILE') {
      set.status = 422;
      return { code: 'INVALID_PROFILE', message: 'Data profil tidak valid.' };
    }
    set.status = 503;
    return { code: 'ACCOUNT_STORAGE_UNAVAILABLE', message: 'Profil belum dapat diakses.' };
  };
  const app = new Elysia({ prefix: '/dolend-api/v1', aot: false })
    .derive(() => ({ requestId: crypto.randomUUID() }))
    .onRequest(({ request, set }) => {
      const origin = request.headers.get('origin');
      if (origin && !allowedOrigins.includes(origin)) {
        set.status = 403;
        return { error: { code: 'ORIGIN_DENIED', message: 'Origin tidak diizinkan.' }, request_id: crypto.randomUUID() };
      }
      if (origin) {
        set.headers['access-control-allow-origin'] = origin;
        set.headers['vary'] = 'Origin';
      }
      set.headers['access-control-allow-methods'] = 'GET, PATCH, POST, OPTIONS';
      set.headers['access-control-allow-headers'] = 'authorization, apikey, content-type, idempotency-key, x-booking-token';
      if (request.method === 'OPTIONS') { set.status = 204; return new Response(null, { status: 204 }); }
      if (request.method === 'POST' && request.headers.get('content-type')?.includes('application/json') && (request.body === null || request.headers.get('content-length') === '0')) {
        set.status = 400;
        return {error:{code:'INVALID_REQUEST',message:'Body JSON tidak boleh kosong.'}};
      }
    })
    .onError(({ code, error, set }) => {
      if (error instanceof GuestBookingError && error.code==='RATE_LIMITED') {
        set.status=429;
        set.headers['retry-after']=String(error.retryAfterSeconds ?? 60);
        return {error:{code:error.code,message:'Terlalu banyak percobaan. Coba lagi nanti.'}};
      }
      if (error instanceof GuestBookingError) {
        set.status=error.code==='BOOKING_UNAVAILABLE'?503:409;
        return {error:{code:error.code,message:'Booking guest belum dapat diproses.'}};
      }
      if (error instanceof FinanceError) {
        const kind=error.message;
        set.status=kind==='UNAUTHORIZED'?401:kind==='FORBIDDEN'?403:kind==='CONFLICT'?409:kind==='STORAGE_UNAVAILABLE'?503:422;
        return {error:{code:kind,message:'Permintaan pembayaran belum dapat diproses.'}};
      }
      const request_id = crypto.randomUUID();
      if (code === 'VALIDATION' || code === 'PARSE') {
        set.status = 400;
        return { error: { code: 'INVALID_REQUEST', message: 'Permintaan tidak valid.' }, request_id };
      }
      if (code === 'NOT_FOUND') {
        set.status = 404;
        return { error: { code: 'NOT_FOUND', message: 'Halaman tidak ditemukan.' }, request_id };
      }
      set.status = 500;
      return { error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan.' }, request_id };
    })
    .use(manualPaymentRoutes(accounts, url, serviceRoleKey, rateLimitPepper, guestBookings))
    .get('/health', ({ requestId }) => ({ data: { status: 'ok', service: 'dolend-api' }, request_id: requestId }))
    .get('/me', async ({ request, set, requestId }) => {
      if (!tokenFrom(request)) {
        set.status = 401;
        return { error: { code: 'UNAUTHORIZED', message: 'Silakan masuk.' }, request_id: requestId };
      }
      if (!accounts) {
        set.status = 503;
        return { error: { code: 'AUTH_UNAVAILABLE', message: 'Layanan akun belum tersedia.' }, request_id: requestId };
      }
      const auth = await authenticate(request);
      if (!auth) {
        set.status = 401;
        return { error: { code: 'UNAUTHORIZED', message: 'Sesi tidak valid.' }, request_id: requestId };
      }
      return { data: { id: auth.identity.id, email: auth.identity.email, google_verified: auth.identity.googleVerified }, request_id: requestId };
    })
    .post('/profile/bootstrap', async ({ request, set, requestId }) => {
      if (!accounts) {
        set.status = 503;
        return { error: { code: 'AUTH_UNAVAILABLE', message: 'Layanan akun belum tersedia.' }, request_id: requestId };
      }
      const auth = await authenticate(request);
      if (!auth) {
        set.status = 401;
        return { error: { code: 'UNAUTHORIZED', message: 'Sesi tidak valid.' }, request_id: requestId };
      }
      if (!auth.identity.googleVerified) {
        set.status = 403;
        return { error: { code: 'GOOGLE_ACCOUNT_REQUIRED', message: 'Masuk dengan Google diperlukan.' }, request_id: requestId };
      }
      try {
        const profile = await accounts.bootstrapProfile(auth.token, auth.identity);
        if (!profile) {
          set.status = 503;
          return { error: { code: 'ACCOUNT_STORAGE_UNAVAILABLE', message: 'Profil belum dapat dibuat.' }, request_id: requestId };
        }
        set.status = 201;
        return { data: profile, request_id: requestId };
      } catch (error) {
        return { error: serviceFailure(error, set), request_id: requestId };
      }
    }, {parse:'none'})
    .get('/profile', async ({ request, set, requestId }) => {
      if (!accounts) {
        set.status = 503;
        return { error: { code: 'AUTH_UNAVAILABLE', message: 'Layanan akun belum tersedia.' }, request_id: requestId };
      }
      const auth = await authenticate(request);
      if (!auth) {
        set.status = 401;
        return { error: { code: 'UNAUTHORIZED', message: 'Sesi tidak valid.' }, request_id: requestId };
      }
      if (!auth.identity.googleVerified) {
        set.status = 403;
        return { error: { code: 'GOOGLE_ACCOUNT_REQUIRED', message: 'Masuk dengan Google diperlukan.' }, request_id: requestId };
      }
      try {
        const profile = await accounts.getProfile(auth.token, auth.identity);
        if (!profile) {
          set.status = 404;
          return { error: { code: 'PROFILE_NOT_FOUND', message: 'Profil belum dibuat.' }, request_id: requestId };
        }
        return { data: profile, request_id: requestId };
      } catch (error) {
        return { error: serviceFailure(error, set), request_id: requestId };
      }
    })
    .patch('/profile', async ({ request, body, set, requestId }) => {
      if (!accounts) {
        set.status = 503;
        return { error: { code: 'AUTH_UNAVAILABLE', message: 'Layanan akun belum tersedia.' }, request_id: requestId };
      }
      const auth = await authenticate(request);
      if (!auth) {
        set.status = 401;
        return { error: { code: 'UNAUTHORIZED', message: 'Sesi tidak valid.' }, request_id: requestId };
      }
      if (!auth.identity.googleVerified) {
        set.status = 403;
        return { error: { code: 'GOOGLE_ACCOUNT_REQUIRED', message: 'Masuk dengan Google diperlukan.' }, request_id: requestId };
      }
      try {
        const profile = await accounts.updateProfile(auth.token, auth.identity, body as ProfilePatch);
        if (!profile) {
          set.status = 404;
          return { error: { code: 'PROFILE_NOT_FOUND', message: 'Profil belum dibuat.' }, request_id: requestId };
        }
        return { data: profile, request_id: requestId };
      } catch (error) {
        return { error: serviceFailure(error, set), request_id: requestId };
      }
    }, {
      body: t.Object({
        bio: t.Optional(t.Union([t.String({ maxLength: 1000 }), t.Null()])),
        avatar_path: t.Optional(t.Union([t.String({ minLength: 1, maxLength: 512 }), t.Null()])),
        default_timezone: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
      }, { additionalProperties: false, minProperties: 1 }),
    })
    .post('/events/:id/guest-bookings', async ({ params, body, request, set, requestId }) => {
      set.headers['cache-control'] = 'no-store';
      if (!guestBookings) {
        set.status = 503;
        return { error: { code: 'BOOKING_UNAVAILABLE', message: 'Booking guest belum tersedia.' }, request_id: requestId };
      }
      try {
        const booking = await guestBookings.create({
          eventId: params.id,
          displayName: body.display_name,
          whatsapp: body.whatsapp,
          clientAddress: clientAddressFrom(request),
        });
        set.status = 201;
        return { data: booking, request_id: requestId };
      } catch (error) {
        if (error instanceof GuestBookingError && error.code === 'INVALID_WHATSAPP') {
          set.status = 422;
          return { error: { code: error.code, message: 'Nomor WhatsApp Indonesia tidak valid.' }, request_id: requestId };
        }
        if (error instanceof GuestBookingError && error.code === 'BOOKING_ALREADY_EXISTS') {
          set.status = 409;
          return { error: { code: error.code, message: 'Booking untuk nomor ini sudah ada. Gunakan tautan booking sebelumnya.' }, request_id: requestId };
        }
        if (error instanceof GuestBookingError && error.code === 'RATE_LIMITED') {
          set.status = 429;
          set.headers['retry-after'] = String(error.retryAfterSeconds ?? 60);
          return { error: { code: error.code, message: 'Terlalu banyak percobaan. Coba lagi nanti.' }, request_id: requestId };
        }
        if (error instanceof GuestBookingError && error.code === 'EVENT_NOT_OPEN') {
          set.status = 409;
          return { error: { code: error.code, message: 'Event tidak menerima booking.' }, request_id: requestId };
        }
        set.status = 503;
        return { error: { code: 'BOOKING_UNAVAILABLE', message: 'Booking guest belum dapat dibuat.' }, request_id: requestId };
      }
    }, {
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      body: t.Object({
        display_name: t.String({ minLength: 1, maxLength: 120 }),
        whatsapp: t.String({ minLength: 8, maxLength: 32 }),
      }, { additionalProperties: false }),
    })
    .get('/events/:id/guest-bookings/me', async ({ params, request, set, requestId }) => {
      set.headers['cache-control'] = 'no-store';
      if (!guestBookings) {
        set.status = 503;
        return { error: { code: 'BOOKING_UNAVAILABLE', message: 'Status booking belum tersedia.' }, request_id: requestId };
      }
      const bookingToken = request.headers.get('x-booking-token');
      if (!bookingToken) {
        set.status = 401;
        return { error: { code: 'BOOKING_TOKEN_REQUIRED', message: 'Tautan booking tidak lengkap.' }, request_id: requestId };
      }
      try {
        const booking = await guestBookings.get(params.id, bookingToken);
        if (!booking) {
          set.status = 404;
          return { error: { code: 'BOOKING_NOT_FOUND', message: 'Booking tidak ditemukan atau tautan sudah kedaluwarsa.' }, request_id: requestId };
        }
        return { data: booking, request_id: requestId };
      } catch {
        set.status = 404;
        return { error: { code: 'BOOKING_NOT_FOUND', message: 'Booking tidak ditemukan atau tautan sudah kedaluwarsa.' }, request_id: requestId };
      }
    }, {
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
    });
  if (pocMode) {
    app.post('/poc/echo', ({ body, requestId }) => ({ data: body, request_id: requestId }), {
      body: t.Object({ message: t.String({ minLength: 1, maxLength: 200 }) }),
    });
  }
  return app;
}
