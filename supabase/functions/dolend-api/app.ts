import { Elysia, t } from 'elysia';
import { createClient } from '@supabase/supabase-js';

type Options = { allowedOrigins: string[]; pocMode?: boolean };
export function createApp({ allowedOrigins, pocMode = false }: Options) {
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
      set.headers['access-control-allow-methods'] = 'GET, POST, OPTIONS';
      set.headers['access-control-allow-headers'] = 'authorization, apikey, content-type, idempotency-key';
      if (request.method === 'OPTIONS') { set.status = 204; return new Response(null, { status: 204 }); }
    })
    .onError(({ code, set }) => {
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
    .get('/health', ({ requestId }) => ({ data: { status: 'ok', service: 'dolend-api' }, request_id: requestId }))
    .get('/me', async ({ request, set, requestId }) => {
      const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
      if (!token) {
        set.status = 401;
        return { error: { code: 'UNAUTHORIZED', message: 'Silakan masuk.' }, request_id: requestId };
      }
      const url = Deno.env.get('SUPABASE_URL');
      const key = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY');
      if (!url || !key) {
        set.status = 503;
        return { error: { code: 'AUTH_UNAVAILABLE', message: 'Layanan akun belum tersedia.' }, request_id: requestId };
      }
      const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) {
        set.status = 401;
        return { error: { code: 'UNAUTHORIZED', message: 'Sesi tidak valid.' }, request_id: requestId };
      }
      return { data: { id: data.user.id }, request_id: requestId };
    });
  if (pocMode) {
    app.post('/poc/echo', ({ body, requestId }) => ({ data: body, request_id: requestId }), {
      body: t.Object({ message: t.String({ minLength: 1, maxLength: 200 }) }),
    });
  }
  return app;
}
