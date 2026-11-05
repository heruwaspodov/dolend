import { Elysia } from 'elysia';
import type { AccountService } from './account.ts';
import { socialRoutes, type SocialService } from './social.ts';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const actorId = '11111111-1111-4111-8111-111111111111';
const targetId = '22222222-2222-4222-8222-222222222222';
const profile = { id: actorId, user_id: '33333333-3333-4333-8333-333333333333', display_name: 'Synthetic', email: 'synthetic@example.test', phone_normalized: null, bio: null, avatar_path: null, default_timezone: 'Asia/Jakarta', updated_at: '2026-11-05T00:00:00.000Z' };

function fixture() {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const accounts: AccountService = {
    async authenticate(token) { return token === 'valid' ? { id: actorId, email: 'synthetic@example.test', googleVerified: true } : null; },
    async bootstrapProfile() { return profile; }, async getProfile(_token, identity) { return identity.id === actorId ? profile : null; }, async updateProfile() { return profile; },
  };
  const service: SocialService = { async invoke(name, args) { calls.push({ name, args }); return name === 'social_profile' ? [{ profile_id: targetId, display_name: 'Target', bio: null, avatar_path: null, is_private: true, follow_status: null }] : name === 'social_list' ? [] : 'accepted'; } };
  return { app: new Elysia().use(socialRoutes(accounts, service)), calls };
}

Deno.test('social API derives actor from verified bearer identity and ignores client actor IDs', async () => {
  const { app, calls } = fixture();
  const denied = await app.handle(new Request(`http://localhost/social/follow/${targetId}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ actor_id: targetId }) }));
  assert(denied.status === 401, 'anonymous follow was not denied');
  const response = await app.handle(new Request(`http://localhost/social/follow/${targetId}`, { method: 'POST', headers: { authorization: 'Bearer valid', 'content-type': 'application/json' }, body: JSON.stringify({ actor_id: targetId }) }));
  assert(response.status === 200, 'authenticated follow failed');
  assert(calls.length === 1 && calls[0].args.p_actor === actorId && calls[0].args.p_target === targetId, 'client supplied actor id influenced authorization');
});

Deno.test('social profile projection and lists require authentication and do not request phone fields', async () => {
  const { app, calls } = fixture();
  const response = await app.handle(new Request(`http://localhost/social/profile/${targetId}`, { headers: { authorization: 'Bearer valid' } }));
  const body = await response.json();
  assert(response.status === 200 && body.data.is_private === true, 'private-profile projection failed');
  await app.handle(new Request('http://localhost/social/list/followers?limit=20', { headers: { authorization: 'Bearer valid' } }));
  await app.handle(new Request(`http://localhost/social/list/following?limit=1&before=${targetId}`, { headers: { authorization: 'Bearer valid' } }));
  assert(calls[0].args.p_actor === actorId && calls[1].args.p_actor === actorId && calls[2].args.p_actor === actorId, 'list actor was not server-derived');
  assert(calls[2].args.p_limit === 1 && calls[2].args.p_before === targetId, 'pagination cursor was not forwarded');
  assert(!JSON.stringify(body).includes('phone'), 'phone field was exposed');
});

Deno.test('social list rejects invalid pagination and unknown list kinds', async () => {
  const { app } = fixture();
  const headers = { authorization: 'Bearer valid' };
  assert((await app.handle(new Request('http://localhost/social/list/followers?limit=500', { headers }))).status === 400, 'out-of-range page accepted');
  assert((await app.handle(new Request('http://localhost/social/list/search', { headers }))).status === 400, 'unknown list kind accepted');
});
