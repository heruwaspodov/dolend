import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const exec = promisify(execFile);
const project = process.env.POC_PROJECT_REF;
if (project !== 'fpbefabsqryxmnmxufjw') throw new Error('Set POC_PROJECT_REF to the explicitly selected Dolend project.');
const mode = process.argv[2] ?? 'test';
const stateFile = '.env.poc-state.json';
const url = `https://${project}.supabase.co`;
const base = `${url}/functions/v1/dolend-compat-poc/v1`;
const cli = async (...args) => (await exec('node_modules/.bin/supabase', args, { timeout: 120000, maxBuffer: 1024 * 1024 })).stdout;
const keyOutput = JSON.parse(await cli('projects', 'api-keys', '--project-ref', project, '--output', 'json'));
const anon = keyOutput.find((key) => key.name === 'anon')?.api_key;
const service = keyOutput.find((key) => key.name === 'service_role')?.api_key;
if (!anon || !service) throw new Error('Required project keys unavailable.');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, service, options);
const check = (condition, message) => { if (!condition) throw new Error(message); };
const ok = (result, action) => { if (result.error) throw new Error(`${action}: ${result.error.message}`); return result.data; };
let state;
try { state = JSON.parse(await readFile(stateFile, 'utf8')); } catch { /* no fixture state yet */ }
const save = async () => writeFile(stateFile, JSON.stringify(state), { mode: 0o600 });
if (mode === 'prepare') {
  check(!state, 'Existing fixture state: finish cleanup before preparing another run.');
  state = { project, token: randomBytes(32).toString('hex'), secret: randomBytes(32).toString('hex'), users: [], paths: [], runId: randomUUID() };
  await save();
  ok(await admin.storage.createBucket('dolend-compat-poc', { public: false, fileSizeLimit: 65536, allowedMimeTypes: ['text/plain'] }), 'create fixture bucket');
  const secretsFile = '.env.poc-secrets';
  try {
    await writeFile(secretsFile, `DOLEND_POC_RUN_TOKEN=${state.token}\nDOLEND_POC_WEBHOOK_SECRET=${state.secret}\n`, { mode: 0o600 });
    await cli('secrets', 'set', '--project-ref', project, '--env-file', secretsFile);
  } finally { await unlink(secretsFile).catch(() => {}); }
  for (let i = 0; i < 2; i++) {
    const email = `poc-${randomUUID()}@dolend.example`;
    const password = randomBytes(32).toString('base64url');
    const user = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { dolend_compat_fixture: state.runId } }), 'create fixture user').user;
    state.users.push({ id: user.id, email, password });
    await save();
  }
  console.log('Prepared two temporary Auth users and POC-only secrets. No credentials printed.');
  process.exit(0);
}
check(state?.project === project, 'Missing or mismatched fixture state. Run prepare first.');
if (mode === 'cleanup') {
  // This bucket is dedicated to the POC; only remove paths within fixture-user folders.
  for (const user of state.users) {
    const files = state.bucketDeleted ? [] : ok(await admin.storage.from('dolend-compat-poc').list(user.id), 'list fixture objects');
    if (files.length) ok(await admin.storage.from('dolend-compat-poc').remove(files.map((file) => `${user.id}/${file.name}`)), 'remove fixture objects');
    if (!user.deleted) { ok(await admin.auth.admin.deleteUser(user.id), 'delete fixture user'); user.deleted = true; await save(); }
  }
  if (!state.bucketDeleted) { ok(await admin.storage.deleteBucket('dolend-compat-poc'), 'delete fixture bucket'); state.bucketDeleted = true; await save(); }
  await cli('db', 'query', '--linked', '--project-ref', project, '--file', 'supabase/poc/cleanup.sql', '--output', 'json');
  const functions = JSON.parse(await cli('functions', 'list', '--project-ref', project, '--output', 'json'));
  if (functions.some((fn) => fn.slug === 'dolend-compat-poc')) await cli('functions', 'delete', 'dolend-compat-poc', '--project-ref', project, '--yes');
  await cli('secrets', 'unset', 'DOLEND_POC_RUN_TOKEN', 'DOLEND_POC_WEBHOOK_SECRET', '--project-ref', project, '--yes');
  await unlink(stateFile);
  console.log('Removed POC users, objects, bucket, SQL fixtures, hosted probe, and POC secrets.');
  process.exit(0);
}
check(mode === 'test', 'Use prepare, test, or cleanup.');
const report = { date: '2026-10-27', project, checks: [], timings: {} };
const record = (name) => { report.checks.push(name); console.log(`PASS ${name}`); };
async function request(path, { user, method = 'GET', body, headers = {}, token = true } = {}) {
  return fetch(`${base}${path}`, { method, headers: { ...(token ? { 'x-poc-token': state.token } : {}), ...(user ? { Authorization: `Bearer ${user}` } : {}), ...headers }, body, signal: AbortSignal.timeout(30000) });
}
try {
  let response = await request('/runtime', { token: false });
  check(response.status === 401, 'POC run-token missing was accepted'); await response.text(); record('probe requires run token');
  const started = performance.now(); response = await request('/runtime');
  check(response.ok, `runtime ${response.status}`); report.timings.first_ms = performance.now() - started;
  const runtime = (await response.json()).data; report.runtime = runtime; record('hosted Elysia runtime and secrets');
  const sessions = [];
  for (const user of state.users) {
    const client = createClient(url, anon, options);
    sessions.push({ client, ...ok(await client.auth.signInWithPassword({ email: user.email, password: user.password }), 'fixture login').session });
  }
  const a = sessions[0], b = sessions[1];
  const apiMe = await fetch(`${url}/functions/v1/dolend-api/v1/me`, { headers: { apikey: anon, Authorization: `Bearer ${a.access_token}` }, signal: AbortSignal.timeout(30000) });
  check(apiMe.ok, `Main API valid user JWT failed: ${apiMe.status}`);
  check((await apiMe.json()).data.id === state.users[0].id, 'main API identity mismatch'); record('main API validates real user JWT');
  for (const bearer of ['invalid.jwt.token', anon]) {
    response = await request('/counter', { user: bearer, method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ run_id: state.runId }) });
    check(response.status === 401, 'invalid/anon token accepted'); await response.text();
  }
  record('invalid JWT and anon identity rejected');
  response = await request('/counter', { user: a.access_token, method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"run_id":"invalid"}' });
  check(response.status === 400, `invalid JSON schema returned ${response.status}`); check((await response.json()).error.code === 'INVALID_REQUEST', 'validation envelope'); record('hosted JSON validation envelope');
  response = await request('/runtime', { headers: { origin: 'https://untrusted.example' } }); check(response.status === 403, 'CORS origin accepted'); await response.text();
  response = await request('/counter', { token: false, method: 'OPTIONS', headers: { origin: 'http://localhost:3000', 'access-control-request-method': 'POST', 'access-control-request-headers': 'x-poc-token,authorization,content-type' } });
  check(response.status === 204 && response.headers.get('access-control-allow-origin') === 'http://localhost:3000', 'preflight failed'); record('hosted CORS deny and preflight');
  response = await request('/missing'); check(response.status === 404 && (await response.json()).error.code === 'NOT_FOUND', '404 envelope'); record('hosted safe error path');
  const writeTimings = [];
  const writes = await Promise.all(Array.from({ length: 20 }, async () => {
    const start = performance.now();
    const res = await request('/counter', { user: a.access_token, method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ run_id: state.runId }) });
    check(res.ok, `write RPC ${res.status}`); const data = (await res.json()).data;
    writeTimings.push(performance.now() - start); return data.value;
  }));
  check(new Set(writes).size === 20, 'lost concurrent writes');
  const row = ok(await a.client.from('dolend_poc_counters').select('value').eq('run_id', state.runId).single(), 'read counter');
  check(row.value === 20, `counter ${row.value}`); record('20 concurrent hosted transactional RPC writes without lost updates');
  const hidden = ok(await b.client.from('dolend_poc_counters').select('*').eq('run_id', state.runId), 'cross-user select'); check(hidden.length === 0, 'RLS read leak');
  const denied = await b.client.from('dolend_poc_counters').insert({ owner_id: state.users[0].id, run_id: randomUUID(), value: 999 }); check(!!denied.error, 'RLS insert allowed impersonation'); record('RLS cross-user read and insert denied');
  const content = 'Dolend private compatibility fixture\n'; const form = new FormData(); form.append('file', new Blob([content], { type: 'text/plain' }), 'fixture.txt');
  response = await request('/upload', { method: 'POST', user: a.access_token, body: form }); check(response.ok, `upload ${response.status}`);
  const uploaded = (await response.json()).data; state.paths.push(uploaded.path); await save();
  const download = await fetch(uploaded.signed_url, { signal: AbortSignal.timeout(30000) }); check(download.ok && await download.text() === content, 'signed download mismatch');
  const crossFile = await b.client.storage.from('dolend-compat-poc').download(uploaded.path); check(!!crossFile.error, 'cross-user storage read leak');
  const publicFile = await fetch(`${url}/storage/v1/object/public/dolend-compat-poc/${uploaded.path}`, { signal: AbortSignal.timeout(30000) }); check(!publicFile.ok, 'private bucket public'); await publicFile.text(); record('multipart upload, private storage, signed download and cross-user denial');
  const eventId = randomUUID(); const raw = `{ "id": "${eventId}", "amount": 123 }`;
  async function webhook(payload, timestamp = String(Math.floor(Date.now()/1000)), signature) {
    return request('/webhook', { method: 'POST', token: false, body: payload, headers: { 'content-type': 'application/json', 'x-poc-timestamp': timestamp, 'x-poc-signature': signature ?? createHmac('sha256', state.secret).update(`${timestamp}.${payload}`).digest('hex') } });
  }
  response = await webhook(raw); check(response.ok && !(await response.json()).data.duplicate, 'raw webhook first');
  const duplicates = await Promise.all(Array.from({ length: 20 }, () => webhook(raw)));
  for (const res of duplicates) check(res.ok && (await res.json()).data.duplicate, 'webhook replay not deduped');
  const entries = ok(await admin.from('dolend_poc_webhooks').select('event_id').eq('event_id', eventId), 'webhook dedupe'); check(entries.length === 1, 'duplicate persisted');
  response = await webhook(raw, undefined, '0'.repeat(64)); check(response.status === 401, 'bad signature accepted'); await response.text();
  response = await webhook(raw, String(Math.floor(Date.now()/1000) - 600)); check(response.status === 401, 'stale signature accepted'); await response.text();
  response = await webhook(JSON.stringify({ id: eventId, amount: 999 })); check(response.status === 409, 'same ID different payload accepted'); await response.text(); record('raw HMAC webhook, signature/expiry rejection, 20 duplicate callbacks and payload conflict');
  // Deleting only the fixture user proves user-bound authorization rejects a removed identity.
  ok(await admin.auth.admin.deleteUser(state.users[1].id), 'delete revoked identity'); state.users[1].deleted = true; await save();
  response = await request('/counter', { user: b.access_token, method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ run_id: state.runId }) }); check(response.status === 401, 'deleted identity JWT accepted'); await response.text(); record('deleted user JWT rejected');
  const warm = [];
  for (let i = 0; i < 100; i++) { const start=performance.now(); response=await request('/runtime'); check(response.ok,'runtime smoke'); await response.text(); warm.push(performance.now()-start); }
  const summary = (values) => { values.sort((a,b)=>a-b); return { p50_ms: +values[Math.floor(values.length*.5)].toFixed(2), p95_ms: +values[Math.floor(values.length*.95)].toFixed(2) }; };
  report.timings.warm_read = summary(warm); report.timings.concurrent_rpc = summary(writeTimings); record('100 hosted smoke requests');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.message; console.error(`FAIL ${error.message}`); process.exitCode = 1;
} finally {
  await writeFile('docs/poc-hosted-results.json', JSON.stringify(report, null, 2)+'\n');
  console.log('Sanitized report saved; run cleanup after reviewing.');
}
