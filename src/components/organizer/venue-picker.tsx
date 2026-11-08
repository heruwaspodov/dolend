'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { organizerRequest } from '@/lib/organizer-client';
import { venueSnapshotFromForm } from '@/lib/venue-form';
import { VenueMapPicker, type VenuePoint } from './venue-map-picker';
import { workspaceFormControl } from './workspace-form';

type Venue = {
  id?: string;
  name: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  maps_url: string;
  source: 'manual' | 'geoapify';
  place_id: string | null;
  source_attribution: string | null;
};
type Suggestions = { status: 'ok' | 'limited' | 'unavailable'; venues: Venue[] };
const fieldNames = ['venue_name', 'venue_address', 'latitude', 'longitude', 'maps_url'] as const;

export function VenuePicker({ workspace, token }: { workspace?: string | null; token: string }) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const externalRequest = useRef<AbortController | null>(null);
  const pinRequest = useRef<AbortController | null>(null);
  const [query, setQuery] = useState('');
  const [local, setLocal] = useState<{ query: string; venues: Venue[]; failed?: boolean } | null>(null);
  const [external, setExternal] = useState<Suggestions | 'loading' | null>(null);
  const [selected, setSelected] = useState<Venue | null>(null);
  const [pinVenue, setPinVenue] = useState<Venue | null>(null);
  const [mapName, setMapName] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [center, setCenter] = useState<VenuePoint | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const q = query.trim();
  const endpoint = `/organizer/workspaces/${encodeURIComponent(workspace ?? '')}`;

  useEffect(() => {
    if (!workspace || q.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void organizerRequest<Venue[]>(`${endpoint}/venues?q=${encodeURIComponent(q)}`, token, { signal: controller.signal })
        .then(venues => { if (!controller.signal.aborted) setLocal({ query: q, venues }); })
        .catch(() => { if (!controller.signal.aborted) setLocal({ query: q, venues: [], failed: true }); });
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [workspace, endpoint, q, token, revision]);

  useEffect(() => () => {
    externalRequest.current?.abort();
    pinRequest.current?.abort();
  }, []);

  function input(name: (typeof fieldNames)[number]) {
    const field = root.current?.closest('form')?.elements.namedItem(name);
    return field instanceof HTMLInputElement ? field : null;
  }

  function setField(name: (typeof fieldNames)[number], value: string | number | null) {
    const field = input(name);
    if (field) field.value = value === null ? '' : String(value);
  }

  function changeQuery(value: string) {
    externalRequest.current?.abort();
    setQuery(value);
    setExternal(null);
    setNotice('');
  }

  async function searchProvider() {
    const controller = new AbortController();
    externalRequest.current?.abort();
    externalRequest.current = controller;
    setExternal('loading');
    try {
      const result = await organizerRequest<Suggestions>(`${endpoint}/venue-suggestions?q=${encodeURIComponent(q)}`, token, { signal: controller.signal });
      if (!controller.signal.aborted) setExternal(result);
    } catch {
      if (!controller.signal.aborted) setExternal({ status: 'unavailable', venues: [] });
    }
  }

  function selectVenue(venue: Venue) {
    pinRequest.current?.abort();
    pinRequest.current = null;
    setPinVenue(null);
    setMapName('');
    setField('venue_name', venue.name);
    setField('venue_address', venue.address);
    setField('latitude', venue.latitude);
    setField('longitude', venue.longitude);
    setField('maps_url', venue.maps_url);
    setCenter(venue.latitude !== null && venue.longitude !== null ? { latitude: venue.latitude, longitude: venue.longitude } : null);
    setSelected(venue);
    setNotice(`${venue.name} dipilih. Cek alamat dan titik kumpul sebelum menyimpan.`);
  }

  function openMap() {
    if (showMap) return;
    const latitude = input('latitude')?.valueAsNumber;
    const longitude = input('longitude')?.valueAsNumber;
    setCenter(typeof latitude === 'number' && Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
      typeof longitude === 'number' && Number.isFinite(longitude) && Math.abs(longitude) <= 180 ? { latitude, longitude } : null);
    setShowMap(true);
  }

  function searchMap() {
    openMap();
    if (workspace && q.length >= 3 && external !== 'loading') void searchProvider();
  }

  async function fillFromPin(point: VenuePoint, controller: AbortController) {
    try {
      const result = await organizerRequest<Suggestions>(
        `${endpoint}/venue-address?latitude=${point.latitude}&longitude=${point.longitude}`, token, { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      if (input('latitude')?.valueAsNumber !== point.latitude || input('longitude')?.valueAsNumber !== point.longitude) {
        setNotice('');
        return;
      }
      const venue = result.venues[0];
      if (!venue) {
        setNotice(result.status === 'limited' ? 'Batas pencarian tercapai. Kamu masih bisa mengisi nama dan alamat secara manual.'
          : result.status === 'unavailable' ? 'Alamat otomatis belum tersedia. Kamu masih bisa mengisi form secara manual.'
            : 'Belum ada nama atau alamat yang cocok di dekat pin ini.');
        return;
      }
      const name = !input('venue_name')?.value.trim() ? venue.name : '';
      const address = !input('venue_address')?.value.trim() ? venue.address : '';
      if (name) setField('venue_name', name);
      if (address) setField('venue_address', address);
      if (name || address) setPinVenue({ ...venue, name, address });
      setNotice(name && address ? 'Nama venue dan alamat terisi dari pin. Cek kembali sebelum menyimpan.'
        : address ? 'Alamat terisi dari pin. Kamu bisa mengoreksi alamat atau melengkapi nama venue.'
          : name ? 'Nama venue terisi dari pin. Cek kembali sebelum menyimpan.' : 'Titik kumpul dipilih.');
    } catch {
      if (!controller.signal.aborted) setNotice('Alamat otomatis belum tersedia. Kamu masih bisa mengisi form secara manual.');
    } finally {
      if (pinRequest.current === controller) pinRequest.current = null;
    }
  }

  function updatePoint(point: VenuePoint, placeName?: string) {
    const moved = input('latitude')?.valueAsNumber !== point.latitude || input('longitude')?.valueAsNumber !== point.longitude;
    setField('latitude', point.latitude);
    setField('longitude', point.longitude);
    if (!moved && !placeName) {
      if (!pinRequest.current) setNotice(`Titik kumpul dipilih (${point.latitude}, ${point.longitude}).`);
      return;
    }
    pinRequest.current?.abort();
    pinRequest.current = null;
    if (moved) setField('maps_url', '');
    if (placeName && mapName && input('venue_name')?.value === mapName) setField('venue_name', '');
    if (pinVenue?.name && input('venue_name')?.value === pinVenue.name) setField('venue_name', '');
    if (pinVenue?.address && input('venue_address')?.value === pinVenue.address) setField('venue_address', '');
    setPinVenue(null);

    const pickedName = placeName && !input('venue_name')?.value.trim() ? placeName : '';
    if (pickedName) {
      setField('venue_name', pickedName);
      setMapName(pickedName);
    }
    if (!workspace || (input('venue_name')?.value.trim() && input('venue_address')?.value.trim())) {
      setNotice(pickedName ? `${pickedName} dipilih dari peta.` : `Titik kumpul dipilih (${point.latitude}, ${point.longitude}).`);
      return;
    }

    const controller = new AbortController();
    pinRequest.current = controller;
    setNotice(pickedName ? 'Nama terisi dari peta. Mencari alamat di sekitar pin…' : 'Mencari nama venue dan alamat di sekitar pin…');
    const timer = window.setTimeout(() => void fillFromPin(point, controller), 350);
    controller.signal.addEventListener('abort', () => window.clearTimeout(timer), { once: true });
  }

  async function saveVenue() {
    const form = new FormData();
    for (const name of fieldNames) form.set(name, input(name)?.value ?? '');
    try {
      const venue = venueSnapshotFromForm(form);
      if (!venue?.name || (!venue.maps_url && venue.latitude === undefined)) {
        setNotice('Isi nama venue dan pilih titik atau masukkan tautan Google Maps.');
        return;
      }
      const pinSource = pinVenue && ((pinVenue.name && pinVenue.name === venue.name) || (pinVenue.address && pinVenue.address === venue.address));
      const origin = pinSource ? pinVenue : selected?.name === venue.name && selected.address === venue.address ? selected : null;
      setSaving(true);
      await organizerRequest(`${endpoint}/venues`, token, {
        method: 'POST',
        body: JSON.stringify({ ...venue, city: origin?.city ?? '', source: origin?.source ?? 'manual',
          place_id: origin?.place_id ?? undefined, source_attribution: origin?.source_attribution ?? undefined }),
      });
      setRevision(value => value + 1);
      setNotice('Venue tersimpan di workspace dan bisa dipakai lagi.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Venue belum bisa disimpan.');
    } finally {
      setSaving(false);
    }
  }

  const localMatches = q.length >= 2 && local?.query === q ? local : null;
  const externalMatches = external && external !== 'loading' ? external.venues : [];
  const attributedVenues = [...(localMatches?.venues ?? []), ...externalMatches, selected, pinVenue]
    .filter(venue => venue?.source === 'geoapify');
  const hasOsmSource = attributedVenues.some(venue => venue?.source_attribution?.includes('OpenStreetMap'));
  return <div ref={root} className="grid min-w-0 gap-4 rounded-lg border bg-[#faf9f8] p-3 sm:col-span-2 sm:p-4">
    <div>
      <Label htmlFor={`${id}-venue-search`}>{workspace ? 'Cari venue' : 'Cari di area peta'}</Label>
      <div className="relative mt-2">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
        <Input id={`${id}-venue-search`} type="search" value={query} maxLength={160}
          onChange={event => changeQuery(event.target.value)} onKeyDown={event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            if (q.length >= 2) searchMap();
          }} placeholder="Nama venue atau alamat" className={`${workspaceFormControl} bg-card pl-9`} />
      </div>
    </div>
    {workspace ? <>
      {q.length >= 2 && <div className="grid gap-2">
        <p role="status" className="text-sm text-muted-foreground">
          {!localMatches ? 'Mencari di workspace…' : localMatches.failed ? 'Venue workspace belum bisa dimuat.' :
            localMatches.venues.length ? 'Venue di workspace' : 'Belum ada venue yang cocok di workspace.'}
        </p>
        {Boolean(localMatches?.venues.length) && <VenueResults venues={localMatches?.venues ?? []} selected={selected} onSelect={selectVenue} />}
      </div>}
      {external === 'loading' && <p role="status" className="text-sm text-muted-foreground">Mencari nama tempat dan alamat…</p>}
      {external && external !== 'loading' && externalMatches.length === 0 && <p role="status" className="text-sm text-muted-foreground">
        {external.status === 'limited' ? 'Batas pencarian di luar area peta tercapai. Kamu masih bisa mencari di area peta atau menggeser pin.'
          : external.status === 'unavailable' ? 'Pencarian di luar area peta belum tersedia. Geser peta ke sekitar tempat yang dicari.'
            : 'Tidak ada hasil tambahan. Coba nama lain atau pilih titik di peta.'}
      </p>}
      {externalMatches.length > 0 && <div className="grid gap-2">
        <p className="text-sm font-medium">Hasil pencarian tempat</p>
        <VenueResults venues={externalMatches} selected={selected} onSelect={selectVenue} />
      </div>}
      {attributedVenues.length > 0 && <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#005bab] [&_a]:underline [&_a]:underline-offset-2">
        <a href="https://www.geoapify.com/">Powered by Geoapify</a>
        {hasOsmSource && <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>}
        {pinVenue?.source_attribution && !pinVenue.source_attribution.includes('OpenStreetMap') &&
          <span className="text-muted-foreground">{pinVenue.source_attribution}</span>}
      </p>}
    </> : !showMap && <p className="text-sm text-muted-foreground">Pencarian workspace belum tersedia. Buka peta untuk mencari tempat di sekitarnya.</p>}
    <div className="flex flex-wrap gap-2">
      {q.length >= 2 ? (
        <Button type="button" variant="outline" className="min-h-11" disabled={external === 'loading'} onClick={searchMap}>
          <Search aria-hidden="true" />Cari di peta
        </Button>
      ) : !showMap && (
        <Button type="button" variant="outline" className="min-h-11" onClick={openMap}>
          <MapPin aria-hidden="true" />Pilih titik di peta
        </Button>
      )}
      {workspace && <Button type="button" variant="ghost" className="min-h-11 text-[#005bab]" disabled={saving} onClick={() => void saveVenue()}>
        {saving ? 'Menyimpan…' : 'Simpan ke venue workspace'}
      </Button>}
    </div>
    {showMap && <div className="grid gap-2 border-t pt-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Titik kumpul</p>
        <Button type="button" variant="ghost" className="min-h-11 text-muted-foreground" onClick={() => setShowMap(false)}>Tutup peta</Button>
      </div>
      <VenueMapPicker key={center ? `${center.latitude},${center.longitude}` : 'default'} center={center} query={q} onPointChange={updatePoint} />
      {workspace && <p className="text-xs text-muted-foreground">Saat kamu memilih titik, Geoapify membantu melengkapi nama dan alamat yang kosong.</p>}
    </div>}
    {mapName && !showMap && <a href="https://www.openstreetmap.org/copyright" className="justify-self-start text-xs text-[#005bab] underline underline-offset-2">© OpenStreetMap contributors</a>}
    {notice && <p role="status" className="border-t pt-3 text-sm text-muted-foreground">{notice}</p>}
  </div>;
}

function VenueResults({ venues, selected, onSelect }: { venues: Venue[]; selected: Venue | null; onSelect: (venue: Venue) => void }) {
  return <ul className="divide-y rounded-lg border bg-card">
    {venues.map((venue, index) => <li key={venue.id ?? venue.place_id ?? index}>
      <button type="button" aria-pressed={selected === venue}
        className="grid min-h-11 w-full gap-1 rounded-md px-3 py-2.5 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring aria-pressed:bg-[#e8f3fd]"
        onClick={() => onSelect(venue)}>
        <span className="break-words font-medium">{venue.name}</span>
        {venue.address && <span className="break-words text-muted-foreground">{venue.address}</span>}
        {venue.source_attribution && !venue.source_attribution.includes('OpenStreetMap') && <span className="text-xs text-muted-foreground">{venue.source_attribution}</span>}
      </button>
    </li>)}
  </ul>;
}
