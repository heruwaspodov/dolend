import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const project = process.env.PROFILE_TEST_PROJECT_REF;
assert.equal(project, 'fpbefabsqryxmnmxufjw', 'Explicit Dolend profile test project required');
const exec = promisify(execFile);
const cli = async (...args) => (await exec('node_modules/.bin/supabase', args, { timeout: 120000, maxBuffer: 1024 * 1024 })).stdout;
const keys = JSON.parse(await cli('projects', 'api-keys', '--project-ref', project, '--output', 'json'));
const anon = keys.find((key) => key.name === 'anon')?.api_key;
const serviceRole = keys.find((key) => key.name === 'service_role')?.api_key;
assert(anon && serviceRole, 'Required project keys unavailable');
const url = `https://${project}.supabase.co`;
const api = `${url}/functions/v1/dolend-api/v1`;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceRole, options);
const statePath = '.env.profile-hosted-state.json';
const report = { date: '2026-10-27', project, checks: [], status: 'running', cleanup_verified: false };
const record = (name) => { report.checks.push(name); console.log(`PASS ${name}`); };
let state;
try { state = JSON.parse(await readFile(statePath, 'utf8')); } catch { /* No previous fixture. */ }
const save = () => writeFile(statePath, `${JSON.stringify(state)}\n`, { mode: 0o600 });
const ok = (result, action) => { if (result.error) throw new Error(`${action}: ${result.error.message}`); return result.data; };

async function cleanup() {
  if (!state) return;
  assert.equal(state.project, project, 'Fixture project mismatch');
  if (state.authUsers.length) ok(await admin.from('profiles').delete().in('id', state.authUsers.map((item) => item.id)), 'delete fixture profiles');
  if (state.businessUsers.length) ok(await admin.from('users').delete().in('id', state.businessUsers), 'delete fixture business users');
  for (const user of state.authUsers) {
    if (user.deleted) continue;
    const current = await admin.auth.admin.getUserById(user.id);
    if (!current.error) {
      assert.equal(current.data.user.app_metadata.dolend_profile_fixture, state.runId, 'Refusing to delete non-fixture user');
      ok(await admin.auth.admin.deleteUser(user.id), 'delete fixture auth user');
    }
    user.deleted = true;
    await save();
  }
  await unlink(statePath);
  state = undefined;
  console.log('PASS temporary profile fixtures removed');
}

if (process.argv[2] === 'cleanup') {
  await cleanup();
  process.exit(0);
}
assert(!state, 'Existing fixture state. Run the cleanup mode before another test.');
state = { project, runId: randomUUID(), authUsers: [], businessUsers: [] };
await save();
const phone = () => `62817${randomBytes(6).readUIntBE(0, 6).toString().padStart(12, '0').slice(0, 8)}`;

async function createFixture(index, verified = true) {
  const email = `profile-${randomUUID()}@dolend.example`;
  const password = randomBytes(32).toString('base64url');
  const normalized = phone();
  const authUser = ok(await admin.auth.admin.createUser({ email, password, phone: normalized, phone_confirm: verified, email_confirm: true, app_metadata: { dolend_profile_fixture: state.runId } }), 'create fixture auth user').user;
  state.authUsers.push({ id: authUser.id, deleted: false });
  await save();
  const businessUser = ok(await admin.from('users').insert({ display_name: `Dolen Fixture ${index}`, phone_normalized: normalized, phone_verified_at: new Date().toISOString() }).select('id').single(), 'create fixture business user');
  state.businessUsers.push(businessUser.id);
  await save();
  ok(await admin.from('profiles').insert({ id: authUser.id, user_id: businessUser.id }), 'create fixture profile');
  const client = createClient(url, anon, options);
  const session = ok(await client.auth.signInWithPassword({ email, password }), 'login fixture').session;
  return { id: authUser.id, userId: businessUser.id, token: session.access_token };
}

async function request(path, user, init = {}) {
  return fetch(`${api}${path}`, {
    ...init,
    headers: { apikey: anon, authorization: `Bearer ${user.token}`, 'content-type': 'application/json', ...init.headers },
    signal: AbortSignal.timeout(30000),
  });
}

try {
  const owner = await createFixture(1);
  const other = await createFixture(2);
  const unverified = await createFixture(3, false);

  let response = await request('/profile', owner);
  assert.equal(response.status, 200);
  let payload = await response.json();
  assert.equal(payload.data.id, owner.id);
  assert.equal(payload.data.user_id, owner.userId);
  assert(!('phone_verified_at' in payload.data));
  record('hosted profile read returns authenticated owner projection');

  response = await request('/profile', owner, { method: 'PATCH', body: JSON.stringify({ bio: 'Fixture Dolend', default_timezone: 'Asia/Jakarta' }) });
  assert.equal(response.status, 200);
  payload = await response.json();
  assert.equal(payload.data.bio, 'Fixture Dolend');
  const stored = ok(await admin.from('profiles').select('bio').eq('id', owner.id).single(), 'verify profile update');
  assert.equal(stored.bio, 'Fixture Dolend');
  record('hosted profile update persists through user JWT and RLS');

  response = await request('/profile', owner, { method: 'PATCH', body: JSON.stringify({ default_timezone: 'Mars/Olympus' }) });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, 'INVALID_PROFILE');
  record('hosted profile rejects an unknown timezone');

  response = await request('/profile', owner, { method: 'PATCH', body: JSON.stringify({ user_id: other.userId, bio: 'impersonation' }) });
  assert.equal(response.status, 400);
  response = await request('/profile', other);
  assert.equal(response.status, 200);
  payload = await response.json();
  assert.equal(payload.data.id, other.id);
  assert.notEqual(payload.data.id, owner.id);
  record('hosted API rejects identity injection and isolates owners');

  response = await request('/profile', unverified);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'VERIFIED_PHONE_REQUIRED');
  record('hosted API rejects unverified phone identity');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = error.message;
  process.exitCode = 1;
} finally {
  try {
    await cleanup();
    report.cleanup_verified = true;
  } catch (error) {
    report.cleanup_failure = error.message;
    process.exitCode = 1;
  }
  await writeFile('docs/profile-hosted-results.json', `${JSON.stringify(report, null, 2)}\n`);
}
