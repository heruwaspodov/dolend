import { createClient } from '@supabase/supabase-js';
import { Elysia, t } from 'elysia';
import type { AccountService } from './account.ts';
import { FinanceError, normalizeVenueSnapshot } from './manual-payments.ts';

const workspace = t.Object({ workspace: t.String({ format: 'uuid' }) });
const search = t.Object({ q: t.String({ minLength: 2, maxLength: 160 }) });
const savedVenue = t.Object({
  name: t.String({ minLength: 1, maxLength: 200 }),
  address: t.String({ maxLength: 1000 }),
  city: t.String({ maxLength: 200 }),
  maps_url: t.String({ maxLength: 2000 }),
  latitude: t.Optional(t.Number({ minimum: -90, maximum: 90 })),
  longitude: t.Optional(t.Number({ minimum: -180, maximum: 180 })),
  source: t.Union([t.Literal('manual'), t.Literal('geoapify')]),
  place_id: t.Optional(t.String({ minLength: 1, maxLength: 512 })),
  source_attribution: t.Optional(t.String({ maxLength: 300 })),
}, { additionalProperties: false });

type GeoapifyResult = {
  name?: string;
  address_line1?: string;
  formatted?: string;
  city?: string;
  county?: string;
  lat?: number;
  lon?: number;
  place_id?: string;
  result_type?: string;
  distance?: number;
  datasource?: { attribution?: string };
};

async function geoapifyResults(path: 'autocomplete' | 'reverse', params: Record<string, string>, key: string, request: typeof fetch) {
  const query = new URLSearchParams({ ...params, lang: 'id', format: 'json', apiKey: key });
  const response = await request(`https://api.geoapify.com/v1/geocode/${path}?${query}`, {
    signal: AbortSignal.timeout(5000), redirect: 'error',
  });
  if (response.status === 429) return null;
  if (!response.ok) throw new Error('GEOAPIFY_UNAVAILABLE');
  const payload: { results?: GeoapifyResult[] } = await response.json();
  if (!Array.isArray(payload.results)) throw new Error('GEOAPIFY_UNAVAILABLE');
  return payload.results;
}

export async function searchGeoapify(q: string, key: string, request = fetch) {
  const results = await geoapifyResults('autocomplete', { text: q, filter: 'countrycode:id', limit: '6' }, key, request);
  if (!results) return null;
  return results.slice(0, 6).flatMap(place => {
    const { lat, lon } = place;
    const name = (place.name || place.address_line1 || place.formatted || '').trim();
    if (!name || typeof lat !== 'number' || !Number.isFinite(lat) || Math.abs(lat) > 90 ||
      typeof lon !== 'number' || !Number.isFinite(lon) || Math.abs(lon) > 180) return [];
    return [{
      name: name.slice(0, 200), address: (place.formatted ?? '').slice(0, 1000),
      city: (place.city ?? place.county ?? '').slice(0, 200),
      latitude: lat, longitude: lon, maps_url: '',
      source: 'geoapify' as const, place_id: place.place_id?.slice(0, 512) ?? null,
      source_attribution: place.datasource?.attribution?.slice(0, 300) ?? null,
    }];
  });
}

export async function reverseGeoapify(latitude: number, longitude: number, key: string, request = fetch) {
  const results = await geoapifyResults('reverse', { lat: String(latitude), lon: String(longitude), limit: '1' }, key, request);
  if (!results) return null;
  const place = results[0];
  if (!place || !['street', 'building', 'amenity'].includes(place.result_type ?? '') ||
    typeof place.distance !== 'number' || place.distance > 250) return [];

  const name = (place.result_type === 'amenity' || place.result_type === 'building') && place.distance <= 50
    ? (place.name ?? '').trim().slice(0, 200)
    : '';
  const address = (place.formatted ?? '').trim().slice(0, 1000);
  if (!name && !address) return [];
  return [{
    name, address, city: (place.city ?? place.county ?? '').slice(0, 200),
    latitude, longitude, maps_url: '', source: 'geoapify' as const,
    place_id: null, source_attribution: place.datasource?.attribution?.slice(0, 300) ?? null,
  }];
}

export function venueRoutes(accounts: AccountService | null, url?: string, serviceKey?: string, geoapifyKey?: string) {
  const db = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  async function actor(request: Request) {
    const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    const identity = token && accounts ? await accounts.authenticate(token) : null;
    if (!identity?.googleVerified) throw new FinanceError('UNAUTHORIZED');
    return identity.id;
  }
  async function rpc(name: string, params: Record<string, unknown>) {
    if (!db) throw new FinanceError('STORAGE_UNAVAILABLE');
    const { data, error } = await db.rpc(name, params);
    if (error) throw new FinanceError(error.code === '42501' ? 'FORBIDDEN' : 'STORAGE_UNAVAILABLE');
    return data;
  }

  async function lookup(actorId: string, workspaceId: string, search: (key: string) => ReturnType<typeof searchGeoapify>) {
    if (!geoapifyKey) return { status: 'unavailable', venues: [] };
    const rows = await rpc('reserve_venue_search', { p_actor: actorId, p_workspace: workspaceId });
    if (!rows?.[0]?.allowed) return { status: 'limited', venues: [] };
    try {
      const venues = await search(geoapifyKey);
      return venues ? { status: 'ok', venues } : { status: 'limited', venues: [] };
    } catch {
      return { status: 'unavailable', venues: [] };
    }
  }

  return new Elysia({ aot: false })
    .get('/organizer/workspaces/:workspace/venues', async ({ request, params, query }) => ({
      data: await rpc('search_workspace_venues', { p_actor: await actor(request), p_workspace: params.workspace, p_query: query.q.trim() }),
    }), { params: workspace, query: search })
    .get('/organizer/workspaces/:workspace/venue-suggestions', async ({ request, params, query }) => {
      const id = await actor(request);
      const q = query.q.trim();
      if (q.length < 3) throw new FinanceError('INVALID_REQUEST');
      return { data: await lookup(id, params.workspace, key => searchGeoapify(q, key)) };
    }, { params: workspace, query: search })
    .get('/organizer/workspaces/:workspace/venue-address', async ({ request, params, query }) => ({
      data: await lookup(await actor(request), params.workspace, key => reverseGeoapify(query.latitude, query.longitude, key)),
    }), { params: workspace, query: t.Object({
      latitude: t.Numeric({ minimum: -90, maximum: 90 }),
      longitude: t.Numeric({ minimum: -180, maximum: 180 }),
    }) })
    .post('/organizer/workspaces/:workspace/venues', async ({ request, params, body }) => {
      const id = await actor(request);
      const venue = normalizeVenueSnapshot(body);
      if (!venue.name || !venue.maps_url) throw new FinanceError('INVALID_REQUEST');
      const placeId = body.source === 'geoapify' ? body.place_id ?? null : null;
      const identity = placeId ? ['geoapify', placeId] : [
        venue.name.toLowerCase().replace(/\s+/g, ' '), venue.address.toLowerCase().replace(/\s+/g, ' '),
        venue.latitude ?? venue.maps_url, venue.longitude,
      ];
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(identity)));
      const reuseKey = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      await rpc('save_workspace_venue', {
        p_actor: id, p_workspace: params.workspace,
        p_venue: { ...venue, city: body.city.trim(), source: body.source, place_id: placeId,
          source_attribution: body.source === 'geoapify' ? body.source_attribution ?? null : null, reuse_key: reuseKey },
      });
      return { data: { saved: true } };
    }, { params: workspace, body: savedVenue });
}
