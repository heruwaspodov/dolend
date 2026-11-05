import { assert, assertEquals } from 'jsr:@std/assert@1.0.14';
import { challengeRoutes, type ChallengeService } from './challenge-routes.ts';
import type { AccountService } from './account.ts';

const actorId = '11111111-1111-4111-8111-111111111111';
const token = 'verified-challenge-token';
function accounts() {
  return {
    async authenticate(value: string) { return value === token ? { id: actorId, email: 'member@example.test', googleVerified: true } : null; },
    async getProfile(_value: string, identity: { id: string }) { return identity.id === actorId ? { id: actorId } : null; },
  } as unknown as AccountService;
}

Deno.test('challenge API binds membership and progress to verified profile identity', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const service: ChallengeService = { async rpc(name, args) { calls.push({ name, args }); return { ok: true }; } };
  const app = challengeRoutes(accounts(), undefined, undefined, service);
  const joined = await app.handle(new Request('http://local/challenges/22222222-2222-4222-8222-222222222222/join', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: '{}' }));
  assertEquals(joined.status, 200);
  assertEquals(calls[0].name, 'join_challenge');
  assertEquals(calls[0].args.p_actor, actorId);
  assertEquals('actor' in calls[0].args, false);
  const edited = await app.handle(new Request('http://local/challenges/22222222-2222-4222-8222-222222222222', { method: 'PATCH', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ expected_version: 1, title: 'Challenge updated', target: 4, starts_on: '2026-11-05', ends_on: '2026-11-12', timezone: 'Asia/Jakarta' }) }));
  assertEquals(edited.status, 200);
  assertEquals(calls[1].name, 'update_challenge');
  assertEquals(calls[1].args.p_actor, actorId);
  assertEquals(calls[1].args.p_expected_version, 1);
  const progress = await app.handle(new Request('http://local/challenges/22222222-2222-4222-8222-222222222222/progress', { headers: { authorization: `Bearer ${token}` } }));
  assertEquals(progress.status, 200);
  assertEquals(calls[2].name, 'get_challenge_progress');
  assertEquals(calls[2].args.p_actor, actorId);
});

Deno.test('challenge API refuses anonymous writes and bounds pagination', async () => {
  const service: ChallengeService = { async rpc() { throw new Error('SHOULD_NOT_CALL'); } };
  const app = challengeRoutes(accounts(), undefined, undefined, service);
  const anonymous = await app.handle(new Request('http://local/challenges/22222222-2222-4222-8222-222222222222/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }));
  assertEquals(anonymous.status, 401);
  const badPage = await app.handle(new Request('http://local/challenges?limit=100', { headers: { authorization: `Bearer ${token}` } }));
  assertEquals(badPage.status, 400);
});

Deno.test('achievement badges are queried for the verified viewer and requested profile', async () => {
  let args: Record<string, unknown> | undefined;
  const service: ChallengeService = { async rpc(name, value) { assertEquals(name, 'get_profile_achievements'); args = value; return []; } };
  const app = challengeRoutes(accounts(), undefined, undefined, service);
  const response = await app.handle(new Request('http://local/profiles/22222222-2222-4222-8222-222222222222/achievements', { headers: { authorization: `Bearer ${token}` } }));
  assertEquals(response.status, 200);
  assertEquals(args?.p_viewer, actorId);
  assertEquals(args?.p_target, '22222222-2222-4222-8222-222222222222');
  assert(response.headers.get('cache-control') !== 'public');
});

Deno.test('scheduled challenge and achievement batch requires internal service credential', async () => {
  const calls: string[] = [];
  const service: ChallengeService = { async rpc(name) { calls.push(name); return { processed: 2 }; } };
  const key = 'internal-challenge-job-key-32-characters';
  const app = challengeRoutes(accounts(), undefined, undefined, service, key);
  const denied = await app.handle(new Request('http://local/internal/jobs/challenge-maintenance', { method: 'POST', headers: { authorization: 'Bearer wrong', 'content-type': 'application/json' }, body: '{}' }));
  assertEquals(denied.status, 403);
  assertEquals(calls.length, 0);
  const allowed = await app.handle(new Request('http://local/internal/jobs/challenge-maintenance', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ limit: 15 }) }));
  assertEquals(allowed.status, 200);
  assertEquals(calls, ['run_challenge_maintenance', 'run_achievement_maintenance']);
});
