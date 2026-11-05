import { assertEquals } from 'jsr:@std/assert@1.0.14';
import type { AccountIdentity, AccountService, Profile } from './account.ts';
import { activityRoutes, type Activity, type ActivityCursor, type ActivityInput, type ActivityService } from './activities.ts';

const actor = '123e4567-e89b-42d3-a456-426614174000';
const identity: AccountIdentity = { id: actor, email: 'synthetic@example.test', googleVerified: true };
const profile: Profile = { id: actor, user_id: '223e4567-e89b-42d3-a456-426614174000', display_name: 'Penguji', email: identity.email!, phone_normalized: null, bio: null, avatar_path: null, default_timezone: 'Asia/Jakarta', updated_at: '2026-11-05T00:00:00.000Z' };
const accounts: AccountService = {
  authenticate: async (token) => token === 'valid' ? identity : null,
  bootstrapProfile: async () => profile,
  getProfile: async (_token, who) => who.id === actor ? profile : null,
  updateProfile: async () => profile,
};
function fakeService(): ActivityService {
  const posts = new Map<string, Activity>();
  return {
    async feed(_who, cursor, limit) {
      const ordered = [...posts.values()].filter((post) => !post.deleted_at && (!cursor || post.created_at < cursor.created_at || (post.created_at === cursor.created_at && post.id < cursor.id)))
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
      return ordered.slice(0, limit);
    },
    async publish(who, key, input) {
      const lookup = `${who}:${key}`;
      if (posts.has(lookup)) return posts.get(lookup)!;
      const now = '2026-11-05T00:00:00.000Z';
      const item: Activity = { id: crypto.randomUUID(), author_profile_id: who, body: input.body, visibility: input.visibility, community_id: input.community_id ?? null, source_event_id: input.source_event_id ?? null, created_at: now, updated_at: now };
      posts.set(lookup, item); return item;
    },
    async edit(who, id, input) { const item = [...posts.values()].find((post) => post.id === id && post.author_profile_id === who); if (!item) return null; Object.assign(item, input, { updated_at: new Date().toISOString() }); return item; },
    async delete(who, id) { const item = [...posts.values()].find((post) => post.id === id && post.author_profile_id === who); if (!item) return false; item.deleted_at = new Date().toISOString(); return true; },
    async report() { return true; },
  };
}
const request = (path: string, init: RequestInit = {}) => new Request(`http://localhost${path}`, { ...init, headers: { authorization: 'Bearer valid', 'content-type': 'application/json', ...init.headers } });

Deno.test('activity retry with same idempotency key does not create a second post', async () => {
  const service = fakeService(); const app = activityRoutes(accounts, undefined, undefined, service);
  const payload = JSON.stringify({ body: 'Jalan pagi', visibility: 'followers' });
  const init = { method: 'POST', headers: { 'idempotency-key': 'retry-key-0001' }, body: payload };
  const first = await (await app.handle(request('/activities', init))).json();
  const retry = await (await app.handle(request('/activities', init))).json();
  assertEquals(first.data.id, retry.data.id);
  const feed = await (await app.handle(request('/activities/feed'))).json();
  assertEquals(feed.data.items.length, 1);
});

Deno.test('feed emits a stable cursor and a deleted activity disappears', async () => {
  const service = fakeService(); const app = activityRoutes(accounts, undefined, undefined, service);
  for (let index = 0; index < 3; index++) await app.handle(request('/activities', { method: 'POST', headers: { 'idempotency-key': `cursor-key-${index}` }, body: JSON.stringify({ body: `Post ${index}`, visibility: 'private' }) }));
  const first = await (await app.handle(request('/activities/feed?limit=2'))).json();
  assertEquals(first.data.items.length, 2);
  const second = await (await app.handle(request(`/activities/feed?limit=2&cursor=${first.data.next_cursor}`))).json();
  assertEquals(second.data.items.length, 1);
  assertEquals(new Set([...first.data.items, ...second.data.items].map((item: Activity) => item.id)).size, 3);
  const ownId = first.data.items[0].id;
  await app.handle(request(`/activities/${ownId}`, { method: 'DELETE' }));
  const afterDelete = await (await app.handle(request('/activities/feed'))).json();
  assertEquals(afterDelete.data.items.some((item: Activity) => item.id === ownId), false);
});

Deno.test('activity routes bind authorship to verified identity and reject invalid cursor', async () => {
  let calls = 0;
  const service = fakeService();
  const proxy = new Proxy(service, { get(target, property, receiver) { const member = Reflect.get(target, property, receiver); if (property === 'publish') return (...args: Parameters<ActivityService['publish']>) => { calls++; return member(...args); }; return member; } });
  const app = activityRoutes(accounts, undefined, undefined, proxy);
  const unauthorized = await app.handle(new Request('http://localhost/activities', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'retry-key-0001' }, body: JSON.stringify({ body: 'No actor', visibility: 'public', author_profile_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' }) }));
  assertEquals(unauthorized.status, 401);
  const invalidCursor = await app.handle(request('/activities/feed?cursor=not+a+cursor'));
  assertEquals(invalidCursor.status, 400);
  assertEquals(calls, 0);
});
