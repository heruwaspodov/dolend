export type OrganizerEvent = {
  id: string;
  title: string;
  status: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  venue_booking_status: string;
  estimated_total_cost: number;
  contributions_locked_at: string | null;
};

export type OrganizerWorkspace = { id: string; name: string; role: 'owner' | 'organizer' };
export type ActivityType = { id: string; slug: string; name: string };
export type RosterParticipant = {
  id: string;
  status: string;
  chargeable: boolean;
  users: { display_name: string } | { display_name: string }[] | null;
  participant_charges: { id: string; amount: number }[];
  is_guest: boolean;
};
export type EventRoster = {
  estimated_total_cost: number;
  contributions_locked_at: string | null;
  payment_timing: 'before_event' | 'after_event';
  estimated_per_person: number | null;
  participants: RosterParticipant[];
};

export async function organizerRequest<T>(path: string, token: string, init: RequestInit = {}) {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) throw new Error('Konfigurasi API belum tersedia.');
  const response = await fetch(`${base}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      apikey: key,
      authorization: `Bearer ${token}`,
      ...(typeof init.body === 'string' ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message ?? 'Data organizer belum dapat diakses.');
    Object.assign(error, { code: payload?.error?.code, status: response.status });
    throw error;
  }
  return payload.data as T;
}

export function displayParticipantName(participant: RosterParticipant) {
  if (Array.isArray(participant.users)) return participant.users[0]?.display_name ?? 'Peserta';
  return participant.users?.display_name ?? 'Peserta';
}
