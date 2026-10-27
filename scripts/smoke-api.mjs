// Uses an explicitly supplied endpoint; no secrets or tokens are logged.
const base = process.env.API_BASE_URL;
if (!base) throw new Error('Set API_BASE_URL to the function prefix ending in /v1');
const headers = {};
if (process.env.SUPABASE_PUBLISHABLE_KEY) {
  headers.apikey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (process.env.SUPABASE_PUBLISHABLE_KEY.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${process.env.SUPABASE_PUBLISHABLE_KEY}`;
  }
}
const timings = [];
for (let i = 0; i < 100; i++) {
  const start = performance.now();
  const response = await fetch(`${base}/health`, { headers, signal: AbortSignal.timeout(10000) });
  if (!response.ok || (await response.json()).data?.service !== 'dolend-api') {
    throw new Error(`Health request ${i} failed: ${response.status}`);
  }
  timings.push(performance.now() - start);
}
await Promise.all(Array.from({ length: 20 }, async () => {
  const response = await fetch(`${base}/health`, { headers, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Concurrent health failed: ${response.status}`);
  await response.arrayBuffer();
}));
const sorted = timings.slice(1).sort((a, b) => a - b);
console.log(JSON.stringify({ requests: 120, failed: 0, first_request_ms: +timings[0].toFixed(2), warm_p50_ms: +sorted[Math.floor(sorted.length * .5)].toFixed(2), warm_p95_ms: +sorted[Math.floor(sorted.length * .95)].toFixed(2), note: 'First request is not proof of a cold start. Read-only smoke, not DB write concurrency.' }, null, 2));
