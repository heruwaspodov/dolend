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
export type ProfileStats = { period_start: string; period_days: number; timezone: string; metrics: ProfileStat[] };

async function request<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) throw new Error('Konfigurasi API belum tersedia.');
  const response = await fetch(`${base}/stats${path}`, { ...init, headers: { apikey: key, authorization: `Bearer ${token}`, 'content-type': 'application/json', ...init?.headers }, cache: 'no-store' });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message ?? 'Statistik belum dapat diproses.');
  return payload.data as T;
}

export const rebuildMyStats = (token: string) => request<{ rebuilt: boolean; period_start: string; period_days: number }>(token, '/mine/rebuild', { method: 'POST', body: JSON.stringify({ days: 7 }) });
export const getMyStats = (token: string) => request<ProfileStats>(token, '/mine?days=7');
