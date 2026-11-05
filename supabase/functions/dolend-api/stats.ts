import { createClient } from '@supabase/supabase-js';
import { Elysia, t } from 'elysia';
import type { AccountService } from './account.ts';

export type ProfileStat = {
  metric_key: string;
  rule_version: number;
  label: string;
  source_kind: 'verified' | 'self_reported';
  metric_value: number;
  period_start: string;
  period_days: number;
  timezone: string;
  computed_at: string;
};

export interface StatsService {
  rebuild(profileId: string, periodStart: string, periodDays: number): Promise<void>;
  get(profileId: string, periodStart: string, periodDays: number): Promise<ProfileStat[]>;
}

function createSupabaseStatsService(url: string, serviceKey: string): StatsService {
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    async rebuild(profileId, periodStart, periodDays) {
      const { error } = await db.rpc('rebuild_profile_stats', { p_profile: profileId, p_period_start: periodStart, p_period_days: periodDays });
      if (error) throw error;
    },
    async get(profileId, periodStart, periodDays) {
      const { data, error } = await db.rpc('get_profile_stats', { p_profile: profileId, p_period_start: periodStart, p_period_days: periodDays });
      if (error) throw error;
      return (data ?? []) as ProfileStat[];
    },
  };
}

function parsePeriodStart(value: string | undefined, timezone: string): string {
  if (value !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new Error('INVALID_PERIOD');
    return value;
  }
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (key: string) => parts.find((item) => item.type === key)?.value ?? '';
  const [year, month, day] = [Number(part('year')), Number(part('month')), Number(part('day'))];
  return new Date(Date.UTC(year, month - 1, day - 6)).toISOString().slice(0, 10);
}

export function statsRoutes(accounts: AccountService | null, url: string | undefined, serviceKey: string | undefined, injected?: StatsService | null) {
  const stats = injected === undefined && url && serviceKey ? createSupabaseStatsService(url, serviceKey) : injected;
  const actorFrom = async (request: Request) => {
    const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token || !accounts) return null;
    const identity = await accounts.authenticate(token);
    if (!identity?.googleVerified) return null;
    const profile = await accounts.getProfile(token, identity);
    return profile ? { id: profile.id, timezone: profile.default_timezone } : null;
  };
  return new Elysia({ prefix: '/stats' })
    .get('/mine', async ({ request, query, set }) => {
      if (!stats) { set.status = 503; return { error: { code: 'STATS_UNAVAILABLE', message: 'Statistik belum dapat dimuat.' } }; }
      const actor = await actorFrom(request);
      if (!actor) { set.status = accounts ? 401 : 503; return { error: { code: accounts ? 'UNAUTHORIZED' : 'AUTH_UNAVAILABLE', message: 'Statistik belum dapat dimuat.' } }; }
      const days = Number(query.days ?? 7);
      if (!Number.isInteger(days) || days < 1 || days > 366) { set.status = 400; return { error: { code: 'INVALID_PERIOD', message: 'Periode statistik tidak valid.' } }; }
      try {
        const periodStart = parsePeriodStart(query.period_start, actor.timezone);
        return { data: { period_start: periodStart, period_days: days, timezone: actor.timezone, metrics: await stats.get(actor.id, periodStart, days) } };
      } catch { set.status = 400; return { error: { code: 'INVALID_PERIOD', message: 'Periode statistik tidak valid.' } }; }
    }, { query: t.Object({ period_start: t.Optional(t.String({ maxLength: 10 })), days: t.Optional(t.String({ maxLength: 3 })) }) })
    .post('/mine/rebuild', async ({ request, body, set }) => {
      if (!stats) { set.status = 503; return { error: { code: 'STATS_UNAVAILABLE', message: 'Statistik belum dapat dihitung.' } }; }
      const actor = await actorFrom(request);
      if (!actor) { set.status = accounts ? 401 : 503; return { error: { code: accounts ? 'UNAUTHORIZED' : 'AUTH_UNAVAILABLE', message: 'Statistik belum dapat dihitung.' } }; }
      try {
        const start = parsePeriodStart(body.period_start, actor.timezone);
        await stats.rebuild(actor.id, start, body.days);
        return { data: { rebuilt: true, period_start: start, period_days: body.days } };
      } catch { set.status = 422; return { error: { code: 'INVALID_PERIOD', message: 'Statistik belum dapat dihitung.' } }; }
    }, { body: t.Object({ period_start: t.Optional(t.String({ maxLength: 10 })), days: t.Integer({ minimum: 1, maximum: 366, default: 7 }) }, { additionalProperties: false }) });
}
