import { Elysia, t } from 'elysia';
import { createClient } from '@supabase/supabase-js';

type Config = { url: string; publicKey: string; serviceKey: string; runToken: string; webhookSecret: string };
const encoder = new TextEncoder();
export async function verifySignature(secret: string, timestamp: string, raw: string, signature: string, now = Date.now()) {
  if (!secret || !/^\d{10}$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300 || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const bytes = Uint8Array.from(signature.match(/../g)!, (hex) => parseInt(hex, 16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return await crypto.subtle.verify('HMAC', key, bytes, encoder.encode(`${timestamp}.${raw}`));
}
async function equalSecret(expected: string, actual: string) {
  const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  const [a, b] = await Promise.all([digest(expected), digest(actual)]);
  return a.reduce((diff, byte, i) => diff | (byte ^ b[i]), 0) === 0;
}
export function createPocApp(config: Config) {
  const admin = createClient(config.url, config.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  async function session(request: Request) {
    const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return null;
    const client = createClient(config.url, config.publicKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.getUser(token);
    return error || !data.user ? null : { client, user: data.user };
  }
  const fail = (code: string) => ({ error: { code }, request_id: crypto.randomUUID() });
  return new Elysia({ prefix: '/dolend-compat-poc/v1', aot: false })
    .onRequest(async ({ request, set }) => {
      if (!config.runToken || !config.webhookSecret) { set.status = 503; return fail('POC_DISABLED'); }
      const origin = request.headers.get('origin');
      if (origin && origin !== 'http://localhost:3000') { set.status = 403; return fail('ORIGIN_DENIED'); }
      if (origin) { set.headers['access-control-allow-origin'] = origin; set.headers.vary = 'Origin'; }
      set.headers['access-control-allow-methods'] = 'GET, POST, OPTIONS';
      set.headers['access-control-allow-headers'] = 'authorization, apikey, content-type, x-poc-token';
      if (request.method === 'OPTIONS') { set.status = 204; return new Response(null, { status: 204 }); }
      if (request.method === 'POST' && new URL(request.url).pathname === '/dolend-compat-poc/v1/webhook') return;
      if (!await equalSecret(config.runToken, request.headers.get('x-poc-token') ?? '')) {
        set.status = 401; return fail('UNAUTHORIZED');
      }
    })
    .onError(({ code, set }) => {
      set.status = code === 'VALIDATION' || code === 'PARSE' ? 400 : code === 'NOT_FOUND' ? 404 : 500;
      return fail(code === 'VALIDATION' || code === 'PARSE' ? 'INVALID_REQUEST' : code === 'NOT_FOUND' ? 'NOT_FOUND' : 'INTERNAL_ERROR');
    })
    .get('/runtime', () => ({ data: { deno: Deno.version, boot_id: bootId, uptime_ms: performance.now() - bootAt } }))
    .post('/counter', async ({ request, body, set }) => {
      const auth = await session(request);
      if (!auth) { set.status = 401; return fail('UNAUTHORIZED'); }
      const { data, error } = await auth.client.rpc('dolend_poc_increment', { p_run_id: body.run_id });
      if (error) { set.status = 502; return fail('RPC_FAILED'); }
      return { data: { value: data, user_id: auth.user.id } };
    }, { body: t.Object({ run_id: t.String({ format: 'uuid' }) }) })
    .post('/upload', async ({ request, body, set }) => {
      const auth = await session(request);
      if (!auth) { set.status = 401; return fail('UNAUTHORIZED'); }
      const path = `${auth.user.id}/${crypto.randomUUID()}.txt`;
      const bucket = auth.client.storage.from('dolend-compat-poc');
      const { error } = await bucket.upload(path, body.file, { contentType: 'text/plain' });
      if (error) { set.status = 502; return fail('UPLOAD_FAILED'); }
      const signed = await bucket.createSignedUrl(path, 60);
      if (signed.error) { set.status = 502; return fail('SIGN_FAILED'); }
      return { data: { path, signed_url: signed.data.signedUrl } };
    }, { body: t.Object({ file: t.File({ maxSize: 65536, type: 'text/plain' }) }) })
    .post('/webhook', async ({ request, body, set }) => {
      const raw = typeof body === 'string' ? body : '';
      if (encoder.encode(raw).byteLength > 16384) { set.status = 413; return fail('TOO_LARGE'); }
      const timestamp = request.headers.get('x-poc-timestamp') ?? '';
      if (!await verifySignature(config.webhookSecret, timestamp, raw, request.headers.get('x-poc-signature') ?? '')) {
        set.status = 401; return fail('BAD_SIGNATURE');
      }
      let event: { id: string };
      try {
        event = JSON.parse(raw);
        if (typeof event.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(event.id)) throw new Error();
      } catch { set.status = 400; return fail('INVALID_EVENT'); }
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(raw))), (b) => b.toString(16).padStart(2, '0')).join('');
      const { data, error } = await admin.from('dolend_poc_webhooks').upsert({ event_id: event.id, payload_hash: hash }, { onConflict: 'event_id', ignoreDuplicates: true }).select('event_id');
      if (error) { set.status = 502; return fail('PERSIST_FAILED'); }
      const original = await admin.from('dolend_poc_webhooks').select('payload_hash').eq('event_id', event.id).single();
      if (original.error) { set.status = 502; return fail('PERSIST_FAILED'); }
      if (original.data.payload_hash !== hash) { set.status = 409; return fail('EVENT_MISMATCH'); }
      return { data: { accepted: true, duplicate: data.length === 0 } };
    }, { parse: 'text' });
}
const bootAt = performance.now();
const bootId = crypto.randomUUID();
