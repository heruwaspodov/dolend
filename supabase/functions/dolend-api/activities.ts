import { createClient } from '@supabase/supabase-js';
import { Elysia, t } from 'elysia';
import type { AccountIdentity, AccountService } from './account.ts';

export type Activity = {
  id: string;
  author_profile_id: string;
  author_name?: string;
  author_avatar_path?: string | null;
  body: string;
  visibility: 'public' | 'followers' | 'community' | 'private';
  community_id: string | null;
  community_name?: string | null;
  source_event_id: string | null;
  source_event_title?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  is_own?: boolean;
};
export type ActivityInput = { body: string; visibility: Activity['visibility']; community_id?: string | null; source_event_id?: string | null };
export type ActivityCursor = { created_at: string; id: string };
export interface ActivityService {
  feed(actor: string, cursor: ActivityCursor | null, limit: number): Promise<Activity[]>;
  publish(actor: string, key: string, input: ActivityInput): Promise<Activity>;
  edit(actor: string, id: string, input: ActivityInput): Promise<Activity | null>;
  delete(actor: string, id: string): Promise<boolean>;
  report(actor: string, id: string, reason: string, details: string): Promise<boolean>;
}

export class ActivityServiceError extends Error {
  constructor(public code: 'STORAGE_UNAVAILABLE' | 'INVALID_ACTIVITY' | 'COMMUNITY_MEMBERSHIP_REQUIRED' | 'EVENT_SOURCE_UNAVAILABLE' | 'INVALID_REPORT') { super(code); }
}

function createSupabaseActivityService(url: string, serviceKey: string): ActivityService {
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const rpc = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
    const { data, error } = await db.rpc(name, args);
    if (error) {
      const code = error.message.match(/INVALID_ACTIVITY|COMMUNITY_MEMBERSHIP_REQUIRED|EVENT_SOURCE_UNAVAILABLE|INVALID_REPORT/)?.[0];
      if (code) throw new ActivityServiceError(code as ActivityServiceError['code']);
      throw new ActivityServiceError('STORAGE_UNAVAILABLE');
    }
    return data as T;
  };
  return {
    async feed(actor, cursor, limit) {
      const rows = await rpc<Activity[]>('get_activity_feed', {
        p_actor: actor, p_before_created_at: cursor?.created_at ?? null, p_before_id: cursor?.id ?? null, p_limit: limit,
      });
      return rows ?? [];
    },
    publish: (actor, key, input) => rpc<Activity>('publish_activity', {
      p_actor: actor, p_key: key, p_body: input.body, p_visibility: input.visibility,
      p_community: input.community_id ?? null, p_source_event: input.source_event_id ?? null,
    }),
    edit: (actor, id, input) => rpc<Activity | null>('edit_activity', {
      p_actor: actor, p_activity: id, p_body: input.body, p_visibility: input.visibility,
      p_community: input.community_id ?? null,
    }),
    delete: (actor, id) => rpc<boolean>('delete_activity', { p_actor: actor, p_activity: id }),
    report: (actor, id, reason, details) => rpc<boolean>('report_activity', {
      p_actor: actor, p_activity: id, p_reason: reason, p_details: details,
    }),
  };
}

function parseCursor(value: string | undefined): ActivityCursor | null {
  if (!value) return null;
  if (value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('INVALID_CURSOR');
  try {
    const parsed = JSON.parse(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)));
    if (!parsed || typeof parsed.created_at !== 'string' || !Number.isFinite(Date.parse(parsed.created_at)) || typeof parsed.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(parsed.id)) throw new Error();
    return { created_at: new Date(parsed.created_at).toISOString(), id: parsed.id };
  } catch { throw new Error('INVALID_CURSOR'); }
}
function encodeCursor(cursor: ActivityCursor) {
  return btoa(JSON.stringify(cursor)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
const toCursor = (activity: Activity): ActivityCursor => ({ created_at: activity.created_at, id: activity.id });

export function activityRoutes(accounts: AccountService | null, url: string | undefined, serviceKey: string | undefined, serviceOverride?: ActivityService | null) {
  const activities = serviceOverride === undefined && url && serviceKey ? createSupabaseActivityService(url, serviceKey) : serviceOverride;
  const actorFrom = async (request: Request): Promise<{ token: string; identity: AccountIdentity; actor: string } | null> => {
    const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token || !accounts) return null;
    const identity = await accounts.authenticate(token);
    if (!identity?.googleVerified || !identity.email) return null;
    const profile = await accounts.getProfile(token, identity);
    return profile ? { token, identity, actor: profile.id } : null;
  };
  const unavailable = (set: { status?: number | string }) => { set.status = 503; return { error: { code: 'ACTIVITY_UNAVAILABLE', message: 'Aktivitas belum dapat diproses.' } }; };
  const handleError = (error: unknown, set: { status?: number | string }) => {
    if (error instanceof ActivityServiceError) {
      if (error.code === 'INVALID_ACTIVITY' || error.code === 'INVALID_REPORT') set.status = 422;
      else if (error.code === 'COMMUNITY_MEMBERSHIP_REQUIRED' || error.code === 'EVENT_SOURCE_UNAVAILABLE') set.status = 403;
      else return unavailable(set);
      return { error: { code: error.code, message: 'Aktivitas belum dapat diproses.' } };
    }
    return unavailable(set);
  };
  return new Elysia()
    .get('/activities/feed', async ({ request, query, set }) => {
      if (!activities) return unavailable(set);
      const auth = await actorFrom(request);
      if (!auth) { set.status = 401; return { error: { code: 'UNAUTHORIZED', message: 'Silakan masuk dengan Google.' } }; }
      try {
        const cursor = parseCursor(query.cursor);
        const limit = Math.min(50, Math.max(1, Number.parseInt(query.limit ?? '20', 10) || 20));
        const rows = await activities.feed(auth.actor, cursor, limit);
        const next = rows.length === limit ? encodeCursor(toCursor(rows.at(-1)!)) : null;
        return { data: { items: rows, next_cursor: next } };
      } catch (error) {
        if (error instanceof Error && error.message === 'INVALID_CURSOR') { set.status = 400; return { error: { code: 'INVALID_CURSOR', message: 'Penanda halaman tidak valid.' } }; }
        return handleError(error, set);
      }
    }, { query: t.Object({ cursor: t.Optional(t.String({ maxLength: 512 })), limit: t.Optional(t.String({ maxLength: 3 })) }) })
    .post('/activities', async ({ request, body, set }) => {
      if (!activities) return unavailable(set);
      const auth = await actorFrom(request);
      if (!auth) { set.status = 401; return { error: { code: 'UNAUTHORIZED', message: 'Silakan masuk dengan Google.' } }; }
      const key = request.headers.get('idempotency-key');
      if (!key || key.length < 8 || key.length > 128) { set.status = 400; return { error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Kunci pengiriman tidak valid.' } }; }
      try { set.status = 201; return { data: await activities.publish(auth.actor, key, body) }; }
      catch (error) { return handleError(error, set); }
    }, { body: t.Object({ body: t.String({ minLength: 1, maxLength: 2000 }), visibility: t.Union([t.Literal('public'), t.Literal('followers'), t.Literal('community'), t.Literal('private')]), community_id: t.Optional(t.Union([t.String({ format: 'uuid' }), t.Null()])), source_event_id: t.Optional(t.Union([t.String({ format: 'uuid' }), t.Null()])) }, { additionalProperties: false }) })
    .patch('/activities/:id', async ({ request, params, body, set }) => {
      if (!activities) return unavailable(set);
      const auth = await actorFrom(request);
      if (!auth) { set.status = 401; return { error: { code: 'UNAUTHORIZED', message: 'Silakan masuk dengan Google.' } }; }
      try {
        const activity = await activities.edit(auth.actor, params.id, body);
        if (!activity) { set.status = 404; return { error: { code: 'ACTIVITY_NOT_FOUND', message: 'Aktivitas tidak ditemukan.' } }; }
        return { data: activity };
      } catch (error) { return handleError(error, set); }
    }, { params: t.Object({ id: t.String({ format: 'uuid' }) }), body: t.Object({ body: t.String({ minLength: 1, maxLength: 2000 }), visibility: t.Union([t.Literal('public'), t.Literal('followers'), t.Literal('community'), t.Literal('private')]), community_id: t.Optional(t.Union([t.String({ format: 'uuid' }), t.Null()])) }, { additionalProperties: false }) })
    .delete('/activities/:id', async ({ request, params, set }) => {
      if (!activities) return unavailable(set);
      const auth = await actorFrom(request);
      if (!auth) { set.status = 401; return { error: { code: 'UNAUTHORIZED', message: 'Silakan masuk dengan Google.' } }; }
      try {
        if (!await activities.delete(auth.actor, params.id)) { set.status = 404; return { error: { code: 'ACTIVITY_NOT_FOUND', message: 'Aktivitas tidak ditemukan.' } }; }
        return { data: { deleted: true } };
      } catch (error) { return handleError(error, set); }
    }, { params: t.Object({ id: t.String({ format: 'uuid' }) }) })
    .post('/activities/:id/report', async ({ request, params, body, set }) => {
      if (!activities) return unavailable(set);
      const auth = await actorFrom(request);
      if (!auth) { set.status = 401; return { error: { code: 'UNAUTHORIZED', message: 'Silakan masuk dengan Google.' } }; }
      try {
        if (!await activities.report(auth.actor, params.id, body.reason, body.details ?? '')) { set.status = 404; return { error: { code: 'ACTIVITY_NOT_FOUND', message: 'Aktivitas tidak ditemukan.' } }; }
        set.status = 202; return { data: { reported: true } };
      } catch (error) { return handleError(error, set); }
    }, { params: t.Object({ id: t.String({ format: 'uuid' }) }), body: t.Object({ reason: t.Union([t.Literal('spam'), t.Literal('harassment'), t.Literal('unsafe'), t.Literal('other')]), details: t.Optional(t.String({ maxLength: 500 })) }, { additionalProperties: false }) });
}
