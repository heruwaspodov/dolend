import { assertEquals } from 'jsr:@std/assert@1.0.14';
import { recommendationRoutes, type RecommendationPreferences, type RecommendationService } from './recommendations.ts';
import type { AccountService } from './account.ts';

Deno.test('recommendation routes bind preferences to the verified profile and preserve explicit opt-out', async () => {
  const writes: string[] = [];
  const feedbacks = new Map<string, string>();
  let optedOut = false;
  const preferences: RecommendationPreferences = { opted_out: true, personalization_enabled: false, activity_type_ids: [], weekdays: [], coarse_region_code: null };
  const service: RecommendationService = {
    async getPreferences(profileId) { writes.push(`read:${profileId}`); return preferences; },
    async setPreferences(profileId, input) { optedOut = input.opted_out; writes.push(`write:${profileId}:${input.opted_out}`); return { ...input }; },
    async list(profileId) { writes.push(`list:${profileId}`); return []; },
    async feedback(profileId, eventId, action, version, key) {
      if (optedOut) throw new Error('RECOMMENDATION_OPTOUT');
      const value = `${eventId}:${action}:${version}`;
      const previous = feedbacks.get(key);
      if (previous && previous !== value) throw new Error('IDEMPOTENCY_MISMATCH');
      feedbacks.set(key, value);
      writes.push(`feedback:${profileId}:${eventId}:${action}:${version}:${key}`);
      return { feedback_id: 'fixture-feedback', recorded: !previous };
    },
  };
  const accounts = {
    async authenticate(token) { return token === 'valid' ? { id: 'profile-owner', email: 'fixture@example.test', googleVerified: true } : null; },
    async getProfile(_token, identity) { return { id: identity.id, user_id: 'business-user', display_name: 'Fixture', email: 'fixture@example.test', phone_normalized: null, bio: null, avatar_path: null, default_timezone: 'Asia/Jakarta', updated_at: '2026-11-05T00:00:00Z' }; },
    async bootstrapProfile() { return null; }, async updateProfile() { return null; },
  } satisfies AccountService;
  const app = recommendationRoutes(accounts, undefined, undefined, service);
  const feedback = await app.handle(new Request('http://localhost/recommendations/cccccccc-cccc-4ccc-8ccc-cccccccccccc/feedback', { method: 'POST', headers: { authorization: 'Bearer valid', 'content-type': 'application/json', 'idempotency-key': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, body: JSON.stringify({ action: 'open', ranking_version: 1, profile_id: 'attacker' }) }));
  assertEquals(feedback.status, 202);
  const retry = await app.handle(new Request('http://localhost/recommendations/cccccccc-cccc-4ccc-8ccc-cccccccccccc/feedback', { method: 'POST', headers: { authorization: 'Bearer valid', 'content-type': 'application/json', 'idempotency-key': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, body: JSON.stringify({ action: 'open', ranking_version: 1 }) }));
  assertEquals(retry.status, 202);
  const mismatch = await app.handle(new Request('http://localhost/recommendations/cccccccc-cccc-4ccc-8ccc-cccccccccccc/feedback', { method: 'POST', headers: { authorization: 'Bearer valid', 'content-type': 'application/json', 'idempotency-key': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, body: JSON.stringify({ action: 'dismiss', ranking_version: 1 }) }));
  assertEquals(mismatch.status, 409);
  const missingKey = await app.handle(new Request('http://localhost/recommendations/cccccccc-cccc-4ccc-8ccc-cccccccccccc/feedback', { method: 'POST', headers: { authorization: 'Bearer valid', 'content-type': 'application/json' }, body: JSON.stringify({ action: 'open', ranking_version: 1 }) }));
  assertEquals(missingKey.status, 400);
  const saved = await app.handle(new Request('http://localhost/recommendations/preferences', { method: 'PUT', headers: { authorization: 'Bearer valid', 'content-type': 'application/json' }, body: JSON.stringify({ opted_out: true, personalization_enabled: false, activity_type_ids: [], weekdays: [], coarse_region_code: null, profile_id: 'attacker' }) }));
  assertEquals(saved.status, 200);
  const optedOutFeedback = await app.handle(new Request('http://localhost/recommendations/cccccccc-cccc-4ccc-8ccc-cccccccccccc/feedback', { method: 'POST', headers: { authorization: 'Bearer valid', 'content-type': 'application/json', 'idempotency-key': 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }, body: JSON.stringify({ action: 'dismiss', ranking_version: 1 }) }));
  assertEquals(optedOutFeedback.status, 409);
  const list = await app.handle(new Request('http://localhost/recommendations/', { headers: { authorization: 'Bearer valid' } }));
  assertEquals(list.status, 200);
  assertEquals(writes, ['feedback:profile-owner:cccccccc-cccc-4ccc-8ccc-cccccccccccc:open:1:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'feedback:profile-owner:cccccccc-cccc-4ccc-8ccc-cccccccccccc:open:1:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'write:profile-owner:true', 'list:profile-owner', 'read:profile-owner']);
});

Deno.test('recommendation endpoints require a verified session and bound list size', async () => {
  const accounts = {
    async authenticate(token) { return token === 'valid' ? { id: 'profile-owner', email: 'fixture@example.test', googleVerified: true } : null; },
    async getProfile() { return { id: 'profile-owner', user_id: 'business-user', display_name: 'Fixture', email: 'fixture@example.test', phone_normalized: null, bio: null, avatar_path: null, default_timezone: 'Asia/Jakarta', updated_at: '2026-11-05T00:00:00Z' }; },
    async bootstrapProfile() { return null; }, async updateProfile() { return null; },
  } satisfies AccountService;
  const service: RecommendationService = { async getPreferences() { return { opted_out: false, personalization_enabled: false, activity_type_ids: [], weekdays: [], coarse_region_code: null }; }, async setPreferences(_id, value) { return value; }, async list() { return []; }, async feedback() { return { feedback_id: 'fixture-feedback', recorded: true }; } };
  const app = recommendationRoutes(accounts, undefined, undefined, service);
  assertEquals((await app.handle(new Request('http://localhost/recommendations/'))).status, 401);
  const invalid = await app.handle(new Request('http://localhost/recommendations/?limit=100', { headers: { authorization: 'Bearer valid' } }));
  assertEquals(invalid.status, 400);
});
