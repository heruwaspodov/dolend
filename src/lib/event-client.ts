import type { CostModel, PaymentTiming } from './event-billing-options';
export type PublicEvent = {
  id: string;
  title: string;
  activity_type_slug?: string | null;
  description: string;
  starts_at: string;
  ends_at: string;
  registration_closes_at?: string;
  timezone: string;
  capacity: number;
  version?: number;
  participants_count: number;
  participant_roster?: { page: number; names: (string | null)[] };
  venue: { name: string; address: string; maps_url: string; latitude?: number; longitude?: number; meeting_instructions?: string };
  contribution_mode?: 'legacy' | 'dynamic';
  estimated_total_cost?: number | null;
  estimated_per_person?: number | null;
  contributions_locked_at?: string | null;
  cost_model?: CostModel;
  payment_timing?: PaymentTiming | null;
  payment_mode?:'free'|'before_event'|'after_event';
  payment_due_at?:string|null;
  hold_minutes?:number;
  visibility?: 'public' | 'unlisted';
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
  const roster = event.participant_roster as PublicEvent['participant_roster'];
  if (event.id !== expectedId || typeof event.title !== 'string' || !event.title.trim() || event.title.length > 200 ||
    typeof event.description !== 'string' || event.description.length > 10000 ||
    typeof event.starts_at !== 'string' || !Number.isFinite(Date.parse(event.starts_at)) ||
    typeof event.ends_at !== 'string' || Date.parse(event.ends_at) <= Date.parse(event.starts_at) || !Number.isFinite(Date.parse(event.ends_at)) ||
    typeof event.timezone !== 'string' || !Number.isSafeInteger(event.capacity) || Number(event.capacity) < 1 ||
    !Number.isSafeInteger(event.participants_count) || Number(event.participants_count) < 0 || Number(event.participants_count) > Number(event.capacity) ||
    (roster !== undefined && (!roster || !Number.isSafeInteger(roster.page) || roster.page < 1 ||
      !Array.isArray(roster.names) || roster.names.length > 10 || roster.names.some(name => name !== null && typeof name !== 'string'))) ||
    (event.estimated_total_cost != null && (!Number.isSafeInteger(event.estimated_total_cost) || Number(event.estimated_total_cost) < 0)) ||
    !Number.isSafeInteger(event.price_amount) || Number(event.price_amount) < 0 || event.currency !== 'IDR' ||
    !venue || typeof venue.name !== 'string' || typeof venue.address !== 'string' || typeof venue.maps_url !== 'string' ||
    (venue.meeting_instructions !== undefined && (typeof venue.meeting_instructions !== 'string' || venue.meeting_instructions.length > 1000)) ||
    ((venue.latitude === undefined) !== (venue.longitude === undefined)) ||
    (venue.latitude !== undefined && (typeof venue.latitude !== 'number' || venue.latitude < -90 || venue.latitude > 90 || typeof venue.longitude !== 'number' || venue.longitude < -180 || venue.longitude > 180))) throw new Error('INVALID_EVENT');
  new Intl.DateTimeFormat('id-ID', { timeZone: event.timezone });
  return value as PublicEvent;
}
export async function fetchPublicEvent(id: string, signal: AbortSignal, inviteToken?:string,bookingToken?:string, memberToken?:string, rosterPage = 1): Promise<PublicEvent | null> {
  const api = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (!isEventPreview && !api) throw new Error('API_UNAVAILABLE');
  const rosterQuery = rosterPage > 1 ? `?roster_page=${rosterPage}` : '';
  const endpoint = isEventPreview ? `/__poc/events/${id}.json` : `${api}/${memberToken ? 'participant/events' : 'events'}/${id}${rosterQuery}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if(inviteToken)headers['x-invite-token']=inviteToken;
  if(bookingToken)headers['x-booking-token']=bookingToken;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!isEventPreview && key) {
    headers.apikey = key;
    if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  }
  if (!isEventPreview && memberToken) headers.Authorization = `Bearer ${memberToken}`;
  const response = await fetch(endpoint, { signal, cache: 'no-store', headers });
  if (response.status === 403 || response.status === 404) return null;
  if (!response.ok) throw new Error('API_UNAVAILABLE');
  const json = await response.json();
  return parseEvent(json.data, id);
}
