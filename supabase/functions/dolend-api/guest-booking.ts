import { createClient } from '@supabase/supabase-js';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

export type GuestBookingInput = {
  eventId: string;
  displayName: string;
  whatsapp: string;
};

export type GuestBooking = {
  participant_id: string;
  status: string;
  booking_token: string;
};

export type GuestBookingStatus = {
  participant_id: string;
  charge_id: string | null;
  status: string;
  hold_expires_at: string | null;
  confirmed_at: string | null;
  updated_at: string;
};

export interface GuestBookingService {
  create(input: GuestBookingInput): Promise<GuestBooking>;
  get(eventId: string, bookingToken: string): Promise<GuestBookingStatus | null>;
}

export class GuestBookingError extends Error {
  constructor(public code: 'INVALID_WHATSAPP' | 'BOOKING_ALREADY_EXISTS' | 'EVENT_NOT_OPEN' | 'BOOKING_UNAVAILABLE') {
    super(code);
    this.name = 'GuestBookingError';
  }
}

function normalizeWhatsApp(value: string) {
  const trimmed = value.trim();
  const candidate = trimmed.startsWith('+') ? trimmed : trimmed.startsWith('62') ? `+${trimmed}` : trimmed;
  const phone = parsePhoneNumberFromString(candidate, 'ID');
  if (!phone?.isValid() || phone.country !== 'ID' || phone.getType() !== 'MOBILE') {
    throw new GuestBookingError('INVALID_WHATSAPP');
  }
  return phone.number.slice(1);
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2,'0')).join('');
}

function validToken(value: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) throw new GuestBookingError('BOOKING_UNAVAILABLE');
  return value;
}

export function createSupabaseGuestBookingService(url: string, serviceRoleKey: string): GuestBookingService {
  const client = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    async create(input) {
      const bookingToken = randomToken();
      const tokenHash = await sha256(bookingToken);
      const phoneNormalized = normalizeWhatsApp(input.whatsapp);
      const { data, error } = await client.rpc('create_guest_booking', {
        p_event: input.eventId,
        p_display_name: input.displayName.trim(),
        p_phone_normalized: phoneNormalized,
        p_token_hash: tokenHash,
      });
      if (error) {
        if (error.message.includes('BOOKING_ALREADY_EXISTS')) throw new GuestBookingError('BOOKING_ALREADY_EXISTS');
        if (error.message.includes('EVENT_NOT_OPEN') || error.message.includes('EVENT_FULL')) throw new GuestBookingError('EVENT_NOT_OPEN');
        throw new GuestBookingError('BOOKING_UNAVAILABLE');
      }
      const participant = Array.isArray(data) ? data[0] : data;
      if (!participant?.id || !participant?.status) throw new GuestBookingError('BOOKING_UNAVAILABLE');
      return { participant_id: participant.id, status: participant.status, booking_token: bookingToken };
    },
    async get(eventId, bookingToken) {
      const tokenHash = await sha256(validToken(bookingToken));
      const { data, error } = await client.rpc('get_guest_booking', { p_event: eventId, p_token_hash: tokenHash });
      if (error) throw new GuestBookingError('BOOKING_UNAVAILABLE');
      const booking = Array.isArray(data) ? data[0] : data;
      if (!booking) return null;
      const {data: charge} = await client.from('participant_charges').select('id').eq('participant_id',booking.participant_id).maybeSingle();
      return {...booking,charge_id:charge?.id ?? null};
    },
  };
}
