export type RecommendationPreferences = { opted_out: boolean; personalization_enabled: boolean; activity_type_ids: string[]; weekdays: number[]; coarse_region_code: string | null };
export type EventRecommendation = { event_id: string; title: string; activity_type_name: string; starts_at: string; reason_labels: string[]; rank_score: number; capacity_remaining: number; ranking_version: number };
export type RecommendationPage = { items: EventRecommendation[]; preferences: RecommendationPreferences; ranking_version: number };
export type ActivityTypeOption = { id: string; slug: string; name: string };

const config = () => {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) throw new Error('Konfigurasi API belum tersedia.');
  return { base, key };
};
async function request<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const { base, key } = config();
  const response = await fetch(`${base}/recommendations${path}`, { ...init, headers: { apikey: key, authorization: `Bearer ${token}`, 'content-type': 'application/json', ...init?.headers }, cache: 'no-store' });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message ?? 'Rekomendasi belum dapat diproses.');
  return payload.data as T;
}
export const getRecommendations = (token: string) => request<RecommendationPage>(token, '/');
export const saveRecommendationPreferences = (token: string, value: RecommendationPreferences) => request<RecommendationPreferences>(token, '/preferences', { method: 'PUT', body: JSON.stringify(value) });
export const recordRecommendationFeedback = (token: string, eventId: string, action: 'open' | 'dismiss', rankingVersion: number, idempotencyKey: string) => request<{ feedback_id: string; recorded: boolean }>(token, `/${encodeURIComponent(eventId)}/feedback`, {
  method: 'POST', headers: { 'idempotency-key': idempotencyKey }, body: JSON.stringify({ action, ranking_version: rankingVersion }),
});
export async function getRecommendationActivityTypes(token: string): Promise<ActivityTypeOption[]> {
  const { base, key } = config();
  const response = await fetch(`${base}/activity-types`, { headers: { apikey: key, authorization: `Bearer ${token}` }, cache: 'no-store' });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message ?? 'Kategori aktivitas belum dapat dimuat.');
  return (payload.data ?? []) as ActivityTypeOption[];
}
