import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Elysia, t } from 'elysia';
import type { AccountService } from './account.ts';
import { serviceBearerMatches } from './manual-payments.ts';

export interface ChallengeService { rpc(name: string, args: Record<string, unknown>): Promise<unknown> }
export class ChallengeError extends Error { constructor(public code: string) { super(code); this.name = 'ChallengeError'; } }

export function createChallengeService(url: string, serviceKey: string): ChallengeService {
  const client: SupabaseClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return { async rpc(name, args) {
    const { data, error } = await client.rpc(name, args);
    if (error) {
      const code = error.message.match(/INVALID_CHALLENGE_RULES|CHALLENGE_CLOSED|CHALLENGE_INELIGIBLE|CHALLENGE_OWNER_REQUIRED|CHALLENGE_VERSION_CONFLICT|PROFILE_NOT_FOUND|INVALID_BATCH_SIZE|CHALLENGE_NOT_FOUND/)?.[0] ?? 'CHALLENGE_STORAGE_UNAVAILABLE';
      throw new ChallengeError(code);
    }
    return data;
  } };
}

export function challengeRoutes(accounts: AccountService | null, url: string | undefined, serviceKey: string | undefined, injected?: ChallengeService, maintenanceKey?: string) {
  const service = injected ?? (url && serviceKey ? createChallengeService(url, serviceKey) : null);
  const actor = async (request: Request) => {
    const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token || !accounts) return null;
    const identity = await accounts.authenticate(token);
    if (!identity?.googleVerified) return null;
    const profile = await accounts.getProfile(token, identity);
    return profile?.id ?? null;
  };
  const fail = (error: unknown, set: { status?: number | string }) => {
    if (error instanceof ChallengeError) {
      set.status = error.code === 'PROFILE_NOT_FOUND' || error.code === 'CHALLENGE_NOT_FOUND' ? 404 : error.code === 'CHALLENGE_CLOSED' || error.code === 'CHALLENGE_VERSION_CONFLICT' ? 409 : error.code === 'CHALLENGE_INELIGIBLE' || error.code === 'CHALLENGE_OWNER_REQUIRED' ? 403 : error.code === 'INVALID_CHALLENGE_RULES' ? 422 : 503;
      return { error: { code: error.code, message: 'Challenge belum dapat diproses.' } };
    }
    set.status = 503;
    return { error: { code: 'CHALLENGE_STORAGE_UNAVAILABLE', message: 'Challenge belum dapat diproses.' } };
  };
  const run = async (name: string, args: Record<string, unknown>, set: { status?: number | string }) => {
    if (!service) { set.status = 503; return { error: { code: 'CHALLENGE_UNAVAILABLE', message: 'Challenge belum tersedia.' } }; }
    try { return { data: await service.rpc(name, args) }; } catch (error) { return fail(error, set); }
  };
  const who = async (request: Request, set: { status?: number | string }) => {
    const id = await actor(request);
    if (!id) { set.status = request.headers.has('authorization') ? 403 : 401; return null; }
    return id;
  };

  return new Elysia({ aot: false })
    .get('/challenges', async ({ request, query, set }) => {
      const id = await who(request, set); if (!id) return { error: { code: 'UNAUTHORIZED', message: 'Silakan masuk.' } };
      const limit = query.limit === undefined ? 20 : Number(query.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) { set.status = 400; return { error: { code: 'INVALID_PAGINATION', message: 'Halaman challenge tidak valid.' } }; }
      return run('get_challenges', { p_actor: id, p_limit: limit, p_before: query.before ?? null }, set);
    }, { query: t.Object({ limit: t.Optional(t.String()), before: t.Optional(t.String({ format: 'uuid' })) }) })
    .post('/challenges', async ({ request, body, set }) => {
      const id = await who(request, set); if (!id) return { error: { code: 'UNAUTHORIZED', message: 'Silakan masuk.' } };
      set.status = 201;
      return run('create_challenge', { p_actor: id, p_title: body.title, p_description: body.description ?? '', p_target: body.target, p_starts_on: body.starts_on, p_ends_on: body.ends_on, p_timezone: body.timezone, p_eligibility: body.eligibility ?? {} }, set);
    }, { body: t.Object({ title: t.String({ minLength: 1, maxLength: 120 }), description: t.Optional(t.String({ maxLength: 2000 })), target: t.Integer({ minimum: 1, maximum: 10000 }), starts_on: t.String({ format: 'date' }), ends_on: t.String({ format: 'date' }), timezone: t.String({ minLength: 1, maxLength: 100 }), eligibility: t.Optional(t.Record(t.String(), t.Unknown())) }, { additionalProperties: false }) })
    .patch('/challenges/:id', async ({ request, params, body, set }) => {
      const id = await who(request, set); if (!id) return { error: { code: 'UNAUTHORIZED', message: 'Silakan masuk.' } };
      return run('update_challenge', { p_actor: id, p_challenge: params.id, p_expected_version: body.expected_version, p_title: body.title, p_description: body.description ?? '', p_target: body.target, p_starts_on: body.starts_on, p_ends_on: body.ends_on, p_timezone: body.timezone, p_eligibility: body.eligibility ?? {} }, set);
    }, { params: t.Object({ id: t.String({ format: 'uuid' }) }), body: t.Object({ expected_version: t.Integer({ minimum: 1 }), title: t.String({ minLength: 1, maxLength: 120 }), description: t.Optional(t.String({ maxLength: 2000 })), target: t.Integer({ minimum: 1, maximum: 10000 }), starts_on: t.String({ format: 'date' }), ends_on: t.String({ format: 'date' }), timezone: t.String({ minLength: 1, maxLength: 100 }), eligibility: t.Optional(t.Record(t.String(), t.Unknown())) }, { additionalProperties: false }) })
    .post('/challenges/:id/join', async ({ request, params, set }) => {
      const id = await who(request, set); if (!id) return { error: { code: 'UNAUTHORIZED', message: 'Silakan masuk.' } };
      return run('join_challenge', { p_actor: id, p_challenge: params.id }, set);
    }, { params: t.Object({ id: t.String({ format: 'uuid' }) }) })
    .delete('/challenges/:id/membership', async ({ request, params, set }) => {
      const id = await who(request, set); if (!id) return { error: { code: 'UNAUTHORIZED', message: 'Silakan masuk.' } };
      return run('leave_challenge', { p_actor: id, p_challenge: params.id }, set);
    }, { params: t.Object({ id: t.String({ format: 'uuid' }) }) })
    .get('/challenges/:id/progress', async ({ request, params, set }) => {
      const id = await who(request, set); if (!id) return { error: { code: 'UNAUTHORIZED', message: 'Silakan masuk.' } };
      return run('get_challenge_progress', { p_actor: id, p_challenge: params.id }, set);
    }, { params: t.Object({ id: t.String({ format: 'uuid' }) }) })
    .get('/profiles/:id/achievements', async ({ request, params, set }) => {
      const id = await who(request, set); if (!id) return { error: { code: 'UNAUTHORIZED', message: 'Silakan masuk.' } };
      return run('get_profile_achievements', { p_viewer: id, p_target: params.id }, set);
    }, { params: t.Object({ id: t.String({ format: 'uuid' }) }) })
    .post('/internal/jobs/challenge-maintenance', async ({ request, body, set }) => {
      if (!serviceBearerMatches(request, maintenanceKey)) { set.status = 403; return { error: { code: 'FORBIDDEN', message: 'Akses job ditolak.' } }; }
      if (!service) { set.status = 503; return { error: { code: 'CHALLENGE_UNAVAILABLE', message: 'Job belum tersedia.' } }; }
      const limit = body.limit ?? 100;
      try {
        const challenges = await service.rpc('run_challenge_maintenance', { p_limit: limit });
        const achievements = await service.rpc('run_achievement_maintenance', { p_limit: limit });
        return { data: { challenges, achievements } };
      } catch (error) { return fail(error, set); }
    }, { body: t.Object({ limit: t.Optional(t.Integer({ minimum: 1, maximum: 200 })) }, { additionalProperties: false }) });
}
