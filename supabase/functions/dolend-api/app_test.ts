import { createApp } from './app.ts';
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const app = createApp({ allowedOrigins: ['http://localhost:3000'], pocMode: true });
const base = 'http://localhost/dolend-api/v1';
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
Deno.test('JSON validation rejects invalid data', async () => {
  const response = await app.handle(new Request(`${base}/poc/echo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: '' }) }));
  assert(response.status === 400, `validation: ${response.status}`);
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
