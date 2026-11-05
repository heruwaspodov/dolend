import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Elysia, t } from 'elysia';
import type { AccountService } from './account.ts';

type CommunityRpc = (name: string, args: Record<string, unknown>) => Promise<unknown>;
export type CommunityService = { rpc: CommunityRpc };

export class CommunityError extends Error {
  constructor(public code: string, public status: number) { super(code); this.name = 'CommunityError'; }
}

export function createCommunityService(url: string, serviceKey: string): CommunityService {
  const client: SupabaseClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    async rpc(name, args) {
      const { data, error } = await client.rpc(name, args);
      if (error) {
        const code = error.message.match(/(?:^|: )(COMMUNITY_[A-Z_]+|PROFILE_REQUIRED|BLOCKED_RELATIONSHIP|OWNER_FOLLOW_REQUIRED|INVITE_NOT_FOUND|REQUEST_NOT_FOUND|MEMBER_NOT_FOUND|ACTIVE_MEMBER_REQUIRED|TRANSFER_OWNERSHIP_REQUIRED|ACTIVE_MEMBERSHIP_REQUIRED|INVALID_ROLE|EVENT_LINK_FORBIDDEN_OR_ALREADY_LINKED)/)?.[1] ?? 'COMMUNITY_STORAGE_UNAVAILABLE';
        throw new CommunityError(code, ['COMMUNITY_NOT_FOUND','INVITE_NOT_FOUND','REQUEST_NOT_FOUND','MEMBER_NOT_FOUND'].includes(code) ? 404 : code.endsWith('_REQUIRED') || code==='BLOCKED_RELATIONSHIP' ? 403 : 503);
      }
      return data;
    },
  };
}

export function communityRoutes(accounts: AccountService | null, url: string | undefined, serviceKey: string | undefined, injected?: CommunityService) {
  const service = injected ?? (url && serviceKey ? createCommunityService(url, serviceKey) : null);
  const identify = async (request: Request) => {
    const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token || !accounts) return null;
    const identity = await accounts.authenticate(token);
    return identity?.googleVerified ? identity : null;
  };
  const failure = (error: unknown, set: { status?: number | string }) => {
    if (error instanceof CommunityError) {
      set.status = error.status;
      return { error: { code: error.code, message: 'Permintaan komunitas belum dapat diproses.' } };
    }
    set.status = 503;
    return { error: { code: 'COMMUNITY_STORAGE_UNAVAILABLE', message: 'Komunitas belum dapat diakses.' } };
  };
  const invoke = async (name: string, args: Record<string, unknown>, set: { status?: number | string }) => {
    if (!service) { set.status = 503; return { error: { code: 'COMMUNITY_UNAVAILABLE', message: 'Layanan komunitas belum tersedia.' } }; }
    try { return { data: await service.rpc(name, args) }; } catch (error) { return failure(error, set); }
  };
  const authActor = async (request: Request, set: { status?: number | string }) => {
    const identity = await identify(request);
    if (!identity) { set.status = request.headers.has('authorization') ? 403 : 401; return null; }
    return identity.id;
  };

  return new Elysia({ prefix: '/dolend-api/v1/communities', aot: false })
    .get('/', async ({ request, set }) => {
      const identity = await identify(request);
      return invoke('discover_communities', { p_actor: identity?.id ?? null }, set);
    })
    .get('/:slug', async ({ params, request, set }) => {
      const identity = await identify(request);
      return invoke('get_community', { p_actor: identity?.id ?? null, p_slug: params.slug }, set);
    }, { params: t.Object({ slug: t.String({ minLength: 3, maxLength: 60 }) }) })
    .post('/', async ({ request, body, set }) => {
      const actor = await authActor(request, set); if (!actor) return { error: { code: 'UNAUTHORIZED', message: 'Silakan masuk.' } };
      return invoke('create_community', { p_actor: actor, p_slug: body.slug, p_name: body.name, p_description: body.description ?? '', p_visibility: body.visibility }, set);
    }, { body: t.Object({ slug: t.String({ minLength: 3, maxLength: 60, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' }), name: t.String({ minLength: 2, maxLength: 120 }), description: t.Optional(t.String({ maxLength: 2000 })), visibility: t.Union([t.Literal('public'), t.Literal('private')]) }) })
    .post('/:id/join', async ({ params, request, set }) => {
      const actor = await authActor(request, set); if (!actor) return { error: { code: 'UNAUTHORIZED', message: 'Silakan masuk.' } };
      return invoke('join_community', { p_actor: actor, p_community: params.id }, set);
    }, { params: t.Object({ id: t.String({ format: 'uuid' }) }) })
    .post('/:id/invites', async ({ params, request, body, set }) => {
      const actor = await authActor(request, set); if (!actor) return { error: { code: 'UNAUTHORIZED', message: 'Silakan masuk.' } };
      return invoke('invite_community_member', { p_actor: actor, p_community: params.id, p_target: body.profile_id }, set);
    }, { params: t.Object({ id: t.String({ format: 'uuid' }) }), body: t.Object({ profile_id: t.String({ format: 'uuid' }) }) })
    .post('/:id/invites/respond', async ({ params, request, body, set }) => {
      const actor = await authActor(request, set); if (!actor) return { error: { code: 'UNAUTHORIZED', message: 'Silakan masuk.' } };
      return invoke('respond_community_invite', { p_actor: actor, p_community: params.id, p_accept: body.accept }, set);
    }, { params: t.Object({ id: t.String({ format: 'uuid' }) }), body: t.Object({ accept: t.Boolean() }) })
    .post('/:id/requests/:profileId', async ({ params, request, body, set }) => {
      const actor = await authActor(request, set); if (!actor) return { error: { code: 'UNAUTHORIZED', message: 'Silakan masuk.' } };
      return invoke('review_community_request', { p_actor: actor, p_community: params.id, p_target: params.profileId, p_approve: body.approve }, set);
    }, { params: t.Object({ id: t.String({ format: 'uuid' }), profileId: t.String({ format: 'uuid' }) }), body: t.Object({ approve: t.Boolean() }) })
    .patch('/:id/members/:profileId/role', async ({ params, request, body, set }) => {
      const actor = await authActor(request, set); if (!actor) return { error: { code: 'UNAUTHORIZED', message: 'Silakan masuk.' } };
      return invoke('set_community_role', { p_actor: actor, p_community: params.id, p_target: params.profileId, p_role: body.role }, set);
    }, { params: t.Object({ id: t.String({ format: 'uuid' }), profileId: t.String({ format: 'uuid' }) }), body: t.Object({ role: t.Union([t.Literal('admin'), t.Literal('member')]) }) })
    .post('/:id/transfer', async ({ params, request, body, set }) => {
      const actor = await authActor(request, set); if (!actor) return { error: { code: 'UNAUTHORIZED', message: 'Silakan masuk.' } };
      return invoke('transfer_community_ownership', { p_actor: actor, p_community: params.id, p_target: body.profile_id }, set);
    }, { params: t.Object({ id: t.String({ format: 'uuid' }) }), body: t.Object({ profile_id: t.String({ format: 'uuid' }) }) })
    .delete('/:id/membership', async ({ params, request, set }) => {
      const actor = await authActor(request, set); if (!actor) return { error: { code: 'UNAUTHORIZED', message: 'Silakan masuk.' } };
      return invoke('leave_community', { p_actor: actor, p_community: params.id }, set);
    }, { params: t.Object({ id: t.String({ format: 'uuid' }) }) })
    .post('/:id/events/:eventId', async ({ params, request, set }) => {
      const actor = await authActor(request, set); if (!actor) return { error: { code: 'UNAUTHORIZED', message: 'Silakan masuk.' } };
      return invoke('link_community_event', { p_actor: actor, p_community: params.id, p_event: params.eventId }, set);
    }, { params: t.Object({ id: t.String({ format: 'uuid' }), eventId: t.String({ format: 'uuid' }) }) });
}
