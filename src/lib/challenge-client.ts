export type Challenge = {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'closed' | 'cancelled';
  metric: 'attended_events';
  target: number;
  starts_on: string;
  ends_on: string;
  timezone: string;
  joined: boolean;
  progress: number | null;
  completed_at: string | null;
};
export type Achievement = { code: string; title: string; description: string; rule_version: number; awarded_at: string };

async function request<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) throw new Error('Konfigurasi API belum tersedia.');
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { apikey: key, authorization: `Bearer ${token}`, 'content-type': 'application/json', ...init.headers },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message ?? 'Permintaan belum dapat diproses.');
  return payload.data as T;
}

export const getChallenges = (token: string, signal?: AbortSignal) => request<Challenge[]>(token, '/challenges?limit=30', { signal });
export const createChallenge = (token: string, input: { title: string; description: string; target: number; starts_on: string; ends_on: string; timezone: string }) => request<Challenge>(token, '/challenges', { method: 'POST', body: JSON.stringify(input) });
export const joinChallenge = (token: string, id: string) => request<unknown>(token, `/challenges/${encodeURIComponent(id)}/join`, { method: 'POST', body: '{}' });
export const leaveChallenge = (token: string, id: string) => request<unknown>(token, `/challenges/${encodeURIComponent(id)}/membership`, { method: 'DELETE' });
export const getProfileAchievements = (token: string, profileId: string, signal?: AbortSignal) => request<Achievement[]>(token, `/profiles/${encodeURIComponent(profileId)}/achievements`, { signal });
