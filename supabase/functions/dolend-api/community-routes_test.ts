import assert from 'node:assert/strict';
import { communityRoutes, type CommunityService } from './community-routes.ts';
import type { AccountService } from './account.ts';

Deno.test('community mutations derive actor from verified bearer identity', async () => {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const service: CommunityService = { async rpc(name, args) { calls.push({ name, args }); return 'active'; } };
  const accounts = { async authenticate(token: string) {
    return token === 'valid' ? { id: '00000000-0000-4000-8000-000000000001', email: 'member@example.test', googleVerified: true } : null;
  } } as AccountService;
  const app = communityRoutes(accounts, undefined, undefined, service);
  const denied = await app.handle(new Request('http://local/dolend-api/v1/communities/00000000-0000-4000-8000-000000000002/join', { method: 'POST' }));
  assert.equal(denied.status, 401);
  const joined = await app.handle(new Request('http://local/dolend-api/v1/communities/00000000-0000-4000-8000-000000000002/join', {
    method: 'POST', headers: { authorization: 'Bearer valid', 'content-type': 'application/json' }, body: JSON.stringify({ actor_profile_id: '00000000-0000-4000-8000-000000000099' }),
  }));
  assert.equal(joined.status, 200);
  assert.equal(calls[0].name, 'join_community');
  assert.equal(calls[0].args.p_actor, '00000000-0000-4000-8000-000000000001');
  assert.equal(calls[0].args.p_community, '00000000-0000-4000-8000-000000000002');
});
