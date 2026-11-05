import { assertEquals } from 'jsr:@std/assert@1.0.14';
import { statsRoutes, type ProfileStat, type StatsService } from './stats.ts';
import type { AccountService } from './account.ts';

Deno.test('stats routes derive the profile from verified identity and rebuild a bounded owner window', async () => {
  const calls: Array<{ kind: string; profileId: string; periodStart: string; days: number }> = [];
  const service: StatsService = {
    async rebuild(profileId, periodStart, days) { calls.push({ kind: 'rebuild', profileId, periodStart, days }); },
    async get(profileId, periodStart, days) {
      calls.push({ kind: 'get', profileId, periodStart, days });
      return [{ metric_key: 'events_attended', rule_version: 1, label: 'Event dihadiri', source_kind: 'verified', metric_value: 2, period_start: periodStart, period_days: days, timezone: 'Asia/Jakarta', computed_at: '2026-11-05T00:00:00Z' } satisfies ProfileStat];
    },
  };
  const accounts = {
    async authenticate(token) { return token === 'valid' ? { id: 'profile-owner', email: 'fixture@example.test', googleVerified: true } : null; },
    async getProfile(_token, identity) { return { id: identity.id, user_id: 'business-user', display_name: 'Fixture', email: 'fixture@example.test', phone_normalized: null, bio: null, avatar_path: null, default_timezone: 'Asia/Jakarta', updated_at: '2026-11-05T00:00:00Z' }; },
    async bootstrapProfile() { return null; }, async updateProfile() { return null; },
  } satisfies AccountService;
  const app = statsRoutes(accounts, undefined, undefined, service);
  const spoofed = await app.handle(new Request('http://localhost/stats/mine/rebuild', { method: 'POST', headers: { authorization: 'Bearer valid', 'content-type': 'application/json' }, body: JSON.stringify({ period_start: '2026-11-01', days: 7, profile_id: 'attacker' }) }));
  assertEquals(spoofed.status, 200);
  const fetched = await app.handle(new Request('http://localhost/stats/mine?period_start=2026-11-01&days=7', { headers: { authorization: 'Bearer valid' } }));
  assertEquals(fetched.status, 200);
  assertEquals(calls.map((call) => call.profileId), ['profile-owner', 'profile-owner']);
  assertEquals(calls.map((call) => call.kind), ['rebuild', 'get']);
  assertEquals(calls.map((call) => call.periodStart), ['2026-11-01', '2026-11-01']);
});

Deno.test('stats routes reject anonymous and invalid windows', async () => {
  const accounts = {
    async authenticate(token) { return token === 'valid' ? { id: 'profile-owner', email: 'fixture@example.test', googleVerified: true } : null; },
    async getProfile() { return { id: 'profile-owner', user_id: 'business-user', display_name: 'Fixture', email: 'fixture@example.test', phone_normalized: null, bio: null, avatar_path: null, default_timezone: 'Asia/Jakarta', updated_at: '2026-11-05T00:00:00Z' }; },
    async bootstrapProfile() { return null; }, async updateProfile() { return null; },
  } satisfies AccountService;
  const service: StatsService = { async rebuild() {}, async get() { return []; } };
  const app = statsRoutes(accounts, undefined, undefined, service);
  assertEquals((await app.handle(new Request('http://localhost/stats/mine'))).status, 401);
  assertEquals((await app.handle(new Request('http://localhost/stats/mine?period_start=not-a-date', { headers: { authorization: 'Bearer valid' } }))).status, 400);
});
