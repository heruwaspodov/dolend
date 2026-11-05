import { createClient } from '@supabase/supabase-js';
import { Elysia, t } from 'elysia';
import type { AccountService } from './account.ts';

export type RecommendationPreferences = { opted_out: boolean; personalization_enabled: boolean; activity_type_ids: string[]; weekdays: number[]; coarse_region_code: string | null };
export type EventRecommendation = { event_id: string; title: string; activity_type_name: string; starts_at: string; reason_labels: string[]; rank_score: number; capacity_remaining: number; ranking_version: number };
export type RecommendationService = {
  getPreferences(profileId: string): Promise<RecommendationPreferences>;
  setPreferences(profileId: string, input: RecommendationPreferences): Promise<RecommendationPreferences>;
  list(profileId: string, limit: number): Promise<EventRecommendation[]>;
  feedback(profileId: string, eventId: string, action: 'open' | 'dismiss', rankingVersion: number, idempotencyKey: string): Promise<{ feedback_id: string; recorded: boolean }>;
};

function createSupabaseRecommendationService(url: string, serviceKey: string): RecommendationService {
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    async getPreferences(profileId) {
      const { data, error } = await db.rpc('get_recommendation_preferences', { p_profile: profileId });
      if (error) throw error;
      return data as RecommendationPreferences;
    },
    async setPreferences(profileId, input) {
      const { data, error } = await db.rpc('set_recommendation_preferences', {
        p_profile: profileId, p_opted_out: input.opted_out, p_personalization_enabled: input.personalization_enabled,
        p_activity_type_ids: input.activity_type_ids, p_weekdays: input.weekdays, p_coarse_region_code: input.coarse_region_code,
      });
      if (error) throw error;
      return data as RecommendationPreferences;
    },
    async list(profileId, limit) {
      const { data, error } = await db.rpc('get_event_recommendations', { p_profile: profileId, p_limit: limit });
      if (error) throw error;
      return (data ?? []) as EventRecommendation[];
    },
    async feedback(profileId, eventId, action, rankingVersion, idempotencyKey) {
      const { data, error } = await db.rpc('record_recommendation_feedback', {
        p_profile: profileId, p_event: eventId, p_action: action, p_ranking_version: rankingVersion, p_idempotency_key: idempotencyKey,
      });
      if (error) throw error;
      return data as { feedback_id: string; recorded: boolean };
    },
  };
}

export function recommendationRoutes(accounts: AccountService | null, url: string | undefined, serviceKey: string | undefined, injected?: RecommendationService | null) {
  const recommendations = injected === undefined && url && serviceKey ? createSupabaseRecommendationService(url, serviceKey) : injected;
  const actorFrom = async (request: Request) => {
    const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token || !accounts) return null;
    const identity = await accounts.authenticate(token);
    if (!identity?.googleVerified) return null;
    const profile = await accounts.getProfile(token, identity);
    return profile?.id ?? null;
  };
  const unavailable = (set: { status?: number | string }) => { set.status = 503; return { error: { code: 'RECOMMENDATIONS_UNAVAILABLE', message: 'Rekomendasi belum dapat dimuat.' } }; };
  return new Elysia({ prefix: '/recommendations' })
    .get('/', async ({ request, query, set }) => {
      if (!recommendations) return unavailable(set);
      const actor = await actorFrom(request);
      if (!actor) { set.status = accounts ? 401 : 503; return { error: { code: accounts ? 'UNAUTHORIZED' : 'AUTH_UNAVAILABLE', message: 'Rekomendasi belum dapat dimuat.' } }; }
      const limit = Number(query.limit ?? 20);
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) { set.status = 400; return { error: { code: 'INVALID_LIMIT', message: 'Jumlah rekomendasi tidak valid.' } }; }
      try { return { data: { items: await recommendations.list(actor, limit), preferences: await recommendations.getPreferences(actor), ranking_version: 1 } }; }
      catch { return unavailable(set); }
    }, { query: t.Object({ limit: t.Optional(t.String()) }) })
    .get('/preferences', async ({ request, set }) => {
      if (!recommendations) return unavailable(set);
      const actor = await actorFrom(request);
      if (!actor) { set.status = accounts ? 401 : 503; return { error: { code: accounts ? 'UNAUTHORIZED' : 'AUTH_UNAVAILABLE', message: 'Preferensi belum dapat dimuat.' } }; }
      try { return { data: await recommendations.getPreferences(actor) }; } catch { return unavailable(set); }
    })
    .post('/:eventId/feedback', async ({ request, params, body, set }) => {
      if (!recommendations) return unavailable(set);
      const actor = await actorFrom(request);
      if (!actor) { set.status = accounts ? 401 : 503; return { error: { code: accounts ? 'UNAUTHORIZED' : 'AUTH_UNAVAILABLE', message: 'Masukan rekomendasi belum dapat disimpan.' } }; }
      const idempotencyKey = request.headers.get('idempotency-key') ?? '';
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) { set.status = 400; return { error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Kunci masukan tidak valid.' } }; }
      try { set.status = 202; return { data: await recommendations.feedback(actor, params.eventId, body.action, body.ranking_version, idempotencyKey) }; }
      catch { set.status = 409; return { error: { code: 'FEEDBACK_UNAVAILABLE', message: 'Masukan rekomendasi belum dapat disimpan.' } }; }
    }, { params: t.Object({ eventId: t.String({ format: 'uuid' }) }), body: t.Object({ action: t.Union([t.Literal('open'), t.Literal('dismiss')]), ranking_version: t.Integer({ minimum: 1, maximum: 100 }) }, { additionalProperties: false }) })
    .put('/preferences', async ({ request, body, set }) => {
      if (!recommendations) return unavailable(set);
      const actor = await actorFrom(request);
      if (!actor) { set.status = accounts ? 401 : 503; return { error: { code: accounts ? 'UNAUTHORIZED' : 'AUTH_UNAVAILABLE', message: 'Preferensi belum dapat disimpan.' } }; }
      try { return { data: await recommendations.setPreferences(actor, body) }; } catch { set.status = 422; return { error: { code: 'INVALID_PREFERENCES', message: 'Preferensi rekomendasi tidak valid.' } }; }
    }, { body: t.Object({
      opted_out: t.Boolean(), personalization_enabled: t.Boolean(),
      activity_type_ids: t.Array(t.String({ format: 'uuid' }), { maxItems: 20 }),
      weekdays: t.Array(t.Integer({ minimum: 0, maximum: 6 }), { maxItems: 7 }),
      coarse_region_code: t.Union([t.String({ minLength: 2, maxLength: 32, pattern: '^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$' }), t.Null()]),
    }, { additionalProperties: false }) });
}
