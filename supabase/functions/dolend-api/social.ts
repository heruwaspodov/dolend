import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Elysia, t } from 'elysia';
import type { AccountIdentity, AccountService } from './account.ts';

export interface SocialService {
  invoke(name: string, args: Record<string, unknown>): Promise<unknown>;
}

export function createSupabaseSocialService(url: string, serviceKey: string): SocialService {
  const client: SupabaseClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    async invoke(name, args) {
      const { data, error } = await client.rpc(name, args);
      if (error) throw new Error(error.message);
      return data;
    },
  };
}

export function socialRoutes(accounts: AccountService | null, service: SocialService | null) {
  return new Elysia({ prefix: '/social' })
    .get('/profile/:id', async ({ request, params, set }) => {
      const actor = await actorFrom(request, accounts);
      if (!actor) { set.status = accounts ? 401 : 503; return failure(accounts ? 'UNAUTHORIZED' : 'AUTH_UNAVAILABLE'); }
      if (!service) { set.status = 503; return failure('SOCIAL_UNAVAILABLE'); }
      try {
        const data = await service.invoke('social_profile', { p_actor: actor.id, p_target: params.id });
        const profile = Array.isArray(data) ? data[0] : null;
        if (!profile) { set.status = 404; return failure('PROFILE_NOT_FOUND'); }
        return { data: profile };
      } catch { set.status = 503; return failure('SOCIAL_UNAVAILABLE'); }
    }, { params: t.Object({ id: t.String({ format: 'uuid' }) }) })
    .get('/list/:kind', async ({ request, params, query, set }) => {
      const actor = await actorFrom(request, accounts);
      if (!actor) { set.status = accounts ? 401 : 503; return failure(accounts ? 'UNAUTHORIZED' : 'AUTH_UNAVAILABLE'); }
      if (!service) { set.status = 503; return failure('SOCIAL_UNAVAILABLE'); }
      if (!['followers', 'following', 'requests', 'blocks'].includes(params.kind)) { set.status = 400; return failure('INVALID_SOCIAL_LIST'); }
      const limit = query.limit === undefined ? 20 : Number(query.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) { set.status = 400; return failure('INVALID_SOCIAL_LIMIT'); }
      try {
        const data = await service.invoke('social_list', { p_actor: actor.id, p_kind: params.kind, p_limit: limit, p_before: query.before ?? null });
        return { data };
      } catch { set.status = 503; return failure('SOCIAL_UNAVAILABLE'); }
    }, { params: t.Object({ kind: t.String() }), query: t.Object({ limit: t.Optional(t.String()), before: t.Optional(t.String({ format: 'uuid' })) }) })
    .patch('/privacy', async ({ request, body, set }) => call(request, accounts, service, set, 'social_set_privacy', (actor) => ({ p_actor: actor.id, p_private: body.is_private }), 200), { body: t.Object({ is_private: t.Boolean() }) })
    .post('/follow/:id', async ({ request, params, set }) => call(request, accounts, service, set, 'social_follow', (actor) => ({ p_actor: actor.id, p_target: params.id }), 200), { params: t.Object({ id: t.String({ format: 'uuid' }) }), parse: 'none' })
    .delete('/follow/:id', async ({ request, params, set }) => call(request, accounts, service, set, 'social_unfollow', (actor) => ({ p_actor: actor.id, p_target: params.id }), 200), { params: t.Object({ id: t.String({ format: 'uuid' }) }), parse: 'none' })
    .post('/requests/:id', async ({ request, params, body, set }) => call(request, accounts, service, set, 'social_respond_request', (actor) => ({ p_actor: actor.id, p_follower: params.id, p_accept: body.accept }), 200), { params: t.Object({ id: t.String({ format: 'uuid' }) }), body: t.Object({ accept: t.Boolean() }) })
    .post('/blocks/:id', async ({ request, params, set }) => call(request, accounts, service, set, 'social_block', (actor) => ({ p_actor: actor.id, p_target: params.id }), 201), { params: t.Object({ id: t.String({ format: 'uuid' }) }), parse: 'none' })
    .delete('/blocks/:id', async ({ request, params, set }) => call(request, accounts, service, set, 'social_unblock', (actor) => ({ p_actor: actor.id, p_target: params.id }), 200), { params: t.Object({ id: t.String({ format: 'uuid' }) }), parse: 'none' })
    .post('/reports/:id', async ({ request, params, body, set }) => call(request, accounts, service, set, 'social_report', (actor) => ({ p_actor: actor.id, p_target: params.id, p_reason: body.reason, p_details: body.details ?? '' }), 201), { params: t.Object({ id: t.String({ format: 'uuid' }) }), body: t.Object({ reason: t.Union([t.Literal('spam'), t.Literal('harassment'), t.Literal('impersonation'), t.Literal('unsafe'), t.Literal('other')]), details: t.Optional(t.String({ maxLength: 1000 })) }) });
}

async function actorFrom(request: Request, accounts: AccountService | null): Promise<AccountIdentity | null> {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token || !accounts) return null;
  const identity = await accounts.authenticate(token);
  if (!identity?.googleVerified) return null;
  const profile = await accounts.getProfile(token, identity);
  return profile ? identity : null;
}

async function call(request: Request, accounts: AccountService | null, service: SocialService | null, set: { status?: number | string }, name: string, args: (actor: AccountIdentity) => Record<string, unknown>, status: number) {
  const actor = await actorFrom(request, accounts);
  if (!actor) { set.status = accounts ? 401 : 503; return failure(accounts ? 'UNAUTHORIZED' : 'AUTH_UNAVAILABLE'); }
  if (!service) { set.status = 503; return failure('SOCIAL_UNAVAILABLE'); }
  try {
    const data = await service.invoke(name, args(actor));
    set.status = status;
    return { data };
  } catch (error) {
    const code = String(error).includes('SELF_') ? 'INVALID_RELATIONSHIP' : String(error).includes('SOCIAL_BLOCKED') ? 'SOCIAL_BLOCKED' : String(error).includes('RATE_LIMITED') ? 'RATE_LIMITED' : String(error).includes('PROFILE_NOT_FOUND') ? 'PROFILE_NOT_FOUND' : 'SOCIAL_UNAVAILABLE';
    set.status = code === 'INVALID_RELATIONSHIP' ? 422 : code === 'SOCIAL_BLOCKED' ? 409 : code === 'RATE_LIMITED' ? 429 : code === 'PROFILE_NOT_FOUND' ? 404 : 503;
    return failure(code);
  }
}

function failure(code: string) { return { error: { code, message: 'Permintaan sosial belum dapat diproses.' } }; }
