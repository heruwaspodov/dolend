export type OwnProfile = {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  phone_normalized: string | null;
  bio: string | null;
  avatar_path: string | null;
  default_timezone: string;
  updated_at: string;
};

type ProfilePatch = Pick<OwnProfile, 'bio' | 'default_timezone'>;

async function profileRequest(token: string, path = '/profile', init?: RequestInit): Promise<OwnProfile> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!baseUrl || !publishableKey) throw new Error('Konfigurasi API belum tersedia.');
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      apikey: publishableKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message ?? 'Profil belum dapat diakses.');
    Object.assign(error, { code: payload?.error?.code, status: response.status });
    throw error;
  }
  return payload.data as OwnProfile;
}

export function getOwnProfile(token: string, signal?: AbortSignal) {
  return profileRequest(token, '/profile', { signal });
}

export function ensureOwnProfile(token: string) {
  return profileRequest(token, '/profile/bootstrap', { method: 'POST', body: '{}' });
}

export function updateOwnProfile(token: string, patch: ProfilePatch) {
  return profileRequest(token, '/profile', { method: 'PATCH', body: JSON.stringify(patch) });
}
