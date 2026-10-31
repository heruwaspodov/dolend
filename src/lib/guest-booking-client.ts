export type GuestBookingStatus = {
  participant_id: string;
  charge_id?: string | null;
  status: string;
  hold_expires_at: string | null;
  confirmed_at: string | null;
  updated_at: string;
};

function apiHeaders() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error('Konfigurasi booking belum tersedia.');
  return {
    apikey: key,
    ...(key.startsWith('eyJ') ? { authorization: `Bearer ${key}` } : {}),
  };
}

function apiUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (!base) throw new Error('Konfigurasi booking belum tersedia.');
  return `${base}${path}`;
}

async function responseData(response: Response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message ?? 'Booking belum dapat diproses.');
    Object.assign(error, { code: payload?.error?.code, status: response.status });
    throw error;
  }
  return payload.data;
}

export async function createGuestBooking(eventId: string, input: { display_name: string; whatsapp: string }) {
  const response = await fetch(apiUrl(`/events/${eventId}/guest-bookings`), {
    method: 'POST',
    cache: 'no-store',
    headers: { ...apiHeaders(), 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return responseData(response) as Promise<{ participant_id: string; status: string; booking_token: string }>;
}

export async function getGuestBooking(eventId: string, bookingToken: string, signal?: AbortSignal) {
  const response = await fetch(apiUrl(`/events/${eventId}/guest-bookings/me`), {
    cache: 'no-store',
    signal,
    headers: { ...apiHeaders(), 'x-booking-token': bookingToken },
  });
  return responseData(response) as Promise<GuestBookingStatus>;
}
