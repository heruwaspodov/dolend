import { createPocApp, verifySignature } from './app.ts';
const config = { url: 'https://example.supabase.co', publicKey: 'test', serviceKey: 'test', runToken: 'fixture-run-token', webhookSecret: 'fixture-signature-secret' };
const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); };
Deno.test('HMAC binds timestamp and exact raw body, rejects stale or malformed input', async () => {
  const timestamp = '1793070000', now = Number(timestamp) * 1000;
  const raw = '{ "id": "fixture" }';
  const bytes = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', bytes.encode(config.webhookSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, bytes.encode(`${timestamp}.${raw}`));
  const hex = Array.from(new Uint8Array(signed), (b) => b.toString(16).padStart(2, '0')).join('');
  assert(await verifySignature(config.webhookSecret, timestamp, raw, hex, now), 'valid signature failed');
  assert(!await verifySignature(config.webhookSecret, timestamp, JSON.stringify(JSON.parse(raw)), hex, now), 'rewritten body accepted');
  assert(!await verifySignature(config.webhookSecret, timestamp, raw, hex, now + 301000), 'stale accepted');
  assert(!await verifySignature(config.webhookSecret, timestamp, raw, hex, now - 301000), 'future accepted');
  assert(!await verifySignature(config.webhookSecret, timestamp, raw, 'xyz', now), 'malformed accepted');
});
Deno.test('probe is fail-closed without secrets, guarded with secrets', async () => {
  const base = 'http://localhost/dolend-compat-poc/v1';
  const disabled = createPocApp({ ...config, runToken: '' });
  assert((await disabled.handle(new Request(`${base}/runtime`))).status === 503, 'disabled probe open');
  const app = createPocApp(config);
  assert((await app.handle(new Request(`${base}/runtime`))).status === 401, 'missing run token accepted');
  assert((await app.handle(new Request(`${base}/runtime`, { headers: { 'x-poc-token': config.runToken } }))).status === 200, 'valid run token denied');
  assert((await app.handle(new Request(`${base}/webhook`, { method: 'POST', body: '{}' }))).status === 401, 'unsigned webhook accepted');
});
