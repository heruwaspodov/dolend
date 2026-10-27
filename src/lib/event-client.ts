export type PublicEvent = {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  capacity: number;
  participants_count: number;
  venue: { name: string; address: string; maps_url: string };
  price_amount: number;
  currency: 'IDR';
};
export const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const isEventPreview = process.env.NEXT_PUBLIC_POC_EVENT_FIXTURES === 'true';

export function safeMapsUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return;
    if (url.hostname === 'maps.google.com' || (url.hostname === 'www.google.com' && url.pathname.startsWith('/maps'))) return url.href;
  } catch { /* Invalid links are not rendered as navigation. */ }
}
function parseEvent(value: unknown, expectedId: string): PublicEvent {
  if (!value || typeof value !== 'object') throw new Error('INVALID_EVENT');
  const event = value as Record<string, unknown>;
  const venue = event.venue as Record<string, unknown> | undefined;
  if (event.id !== expectedId || typeof event.title !== 'string' || !event.title.trim() || event.title.length > 200 ||
    typeof event.description !== 'string' || event.description.length > 10000 ||
    typeof event.starts_at !== 'string' || !Number.isFinite(Date.parse(event.starts_at)) ||
    typeof event.ends_at !== 'string' || Date.parse(event.ends_at) <= Date.parse(event.starts_at) || !Number.isFinite(Date.parse(event.ends_at)) ||
    typeof event.timezone !== 'string' || !Number.isSafeInteger(event.capacity) || Number(event.capacity) < 1 ||
    !Number.isSafeInteger(event.participants_count) || Number(event.participants_count) < 0 || Number(event.participants_count) > Number(event.capacity) ||
    !Number.isSafeInteger(event.price_amount) || Number(event.price_amount) < 0 || event.currency !== 'IDR' ||
    !venue || typeof venue.name !== 'string' || typeof venue.address !== 'string' || typeof venue.maps_url !== 'string') throw new Error('INVALID_EVENT');
  new Intl.DateTimeFormat('id-ID', { timeZone: event.timezone });
  return value as PublicEvent;
}
export async function fetchPublicEvent(id: string, signal: AbortSignal): Promise<PublicEvent | null> {
  const api = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (!isEventPreview && !api) throw new Error('API_UNAVAILABLE');
  const endpoint = isEventPreview ? `/__poc/events/${id}.json` : `${api}/events/${id}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!isEventPreview && key) {
    headers.apikey = key;
    if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  }
  const response = await fetch(endpoint, { signal, cache: 'no-store', headers });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('API_UNAVAILABLE');
  const json = await response.json();
  return parseEvent(json.data, id);
}
