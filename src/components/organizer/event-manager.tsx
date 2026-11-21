'use client';

import { SearchableSelect } from '@/components/ui/searchable-select';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Ban, ChevronDown, Copy, MapPin, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { organizerRequest, type ActivityType, type EventRoster } from '@/lib/organizer-client';
import { costModelOptions, paymentTimingOptions } from '@/lib/event-billing-options';
import { isUuid, type PublicEvent } from '@/lib/event-client';
import { useOrganizerSession } from '@/lib/use-organizer-session';
import { venueSnapshotFromForm } from '@/lib/venue-form';
import { VenuePicker } from './venue-picker';
import { canShareEvent, canonicalEventUrl, eventShareSectionId } from '@/lib/event-share';
import { SessionGate } from './session-gate';
import { EventBasicsFields } from './event-basics-fields';
import { EventRosterTable } from './event-roster-table';
import { WorkspaceFormHeader, WorkspaceFormSection, workspaceFormAction, workspaceFormChoice, workspaceFormControl, workspaceFormDividers, workspaceFormPanel, workspaceFormWidth } from './workspace-form';

const field = `mt-2 ${workspaceFormControl}`;
const textarea = `${field} h-auto resize-y py-2`;
const sectionFields = 'grid gap-4 sm:grid-cols-2';
const rupiah = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const panelInset = 'px-5 py-5 sm:px-8';
const zoneOffsets:Record<string,string>={'Asia/Jakarta':'+07:00','Asia/Makassar':'+08:00','Asia/Jayapura':'+09:00'};
type Notice = { kind: 'success' | 'error'; text: string } | null;
type ManagedEvent = Omit<PublicEvent, 'venue'> & { venue: PublicEvent['venue'] & { coarse_region_code?: string }; status: 'published'|'recruiting' | 'confirmed' | 'completed' | 'cancelled'; visibility:'public'|'unlisted'; venue_booking_status: string; version: number; registration_closes_at:string; payment_timing:PublicEvent['payment_timing'];payment_mode?:'free'|'before_event'|'after_event' };
type EventShare = { link: { token: string; expires_at: string } | null; legacy_active: boolean };
type OrganizerEventBasics = { workspace_id?: string | null; workspace_name?: string | null; activity_type_name?: string | null };

function localDateTime(value:string,timeZone:string) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('sv-SE',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(part=>[part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function EventManager() {
  const eventId = useSearchParams().get('id') ?? '';
  const { session, ready } = useOrganizerSession();
  const [event, setEvent] = useState<(ManagedEvent & OrganizerEventBasics) | null>(null);
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [roster, setRoster] = useState<EventRoster | null>(null);
  const [rosterPage, setRosterPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [stageNotice, setStageNotice] = useState<Notice>(null);
  const [bookingLink, setBookingLink] = useState('');
  const [venueEditorOpen, setVenueEditorOpen] = useState(false);
  const [share, setShare] = useState<EventShare | null>(null);
  const [shareNotice, setShareNotice] = useState<Notice>(null);
  const [priceOptionsDraft, setPriceOptionsDraft] = useState<{id:string;name:string;amount:string;quota:string}[]>([]);
  const [pricingEditorOpen, setPricingEditorOpen] = useState(false);

  const load = useCallback(async (token: string) => {
    setLoading(true);
    try {
      const [nextEvent, nextRoster] = await Promise.all([
        organizerRequest<ManagedEvent & OrganizerEventBasics>(`/organizer/events/${eventId}`, token),
        organizerRequest<EventRoster>(`/events/${eventId}/roster`, token),
      ]);
      const nextShare = nextEvent.public_code ? null : await organizerRequest<EventShare>(`/events/${eventId}/share-link`, token).catch(() => null);
      setEvent(nextEvent); setRoster(nextRoster); setShare(nextShare); setShareNotice(null);
      setPriceOptionsDraft(nextEvent.price_options?.length
        ? nextEvent.price_options.map(option=>({id:option.id,name:option.name,amount:String(option.amount),quota:String(option.quota)}))
        : [{id:'initial-1',name:'',amount:'',quota:''},{id:'initial-2',name:'',amount:'',quota:''}]);
    } catch (reason) { setNotice({ kind: 'error', text: reason instanceof Error ? reason.message : 'Event belum dapat dimuat.' }); }
    finally { setLoading(false); }
  }, [eventId]);

  useEffect(() => {
    if (!loading && window.location.hash === `#${eventShareSectionId}`) {
      document.getElementById(eventShareSectionId)?.scrollIntoView({ block: 'center' });
    }
  }, [eventId, loading]);

  useEffect(() => {
    if (!session || !isUuid(eventId)) return;
    const controller = new AbortController();
    void organizerRequest<ActivityType[]>('/activity-types', session.access_token, { signal: controller.signal })
      .then(setActivities, () => {});
    return () => controller.abort();
  }, [eventId, session]);

  useEffect(() => {
    if (!session || !isUuid(eventId)) return;
    let active = true;
    void Promise.resolve().then(() => { if (active) return load(session.access_token); });
    return () => { active = false; };
  }, [eventId, load, session]);

  async function updatePlanning(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault(); if (!session || !event) return;
    setBusy('planning'); setNotice(null);
    const form = new FormData(formEvent.currentTarget);
    try {
      const venueSnapshot = venueSnapshotFromForm(form) ?? { name:'',address:'',maps_url:'' };
      const offset=zoneOffsets[event.timezone]??'+07:00';
      const iso=(name:string)=>`${String(form.get(name))}:00${offset}`;
      const dynamic=event.contribution_mode==='dynamic';
      await organizerRequest(`/events/${eventId}/planning`, session.access_token, { method: 'PATCH', body: JSON.stringify({
        expected_version: event.version,
        title:form.get('title'),description:form.get('description'),starts_at:iso('starts_at'),ends_at:iso('ends_at'),registration_closes_at:iso('registration_closes_at'),
        capacity:Number(form.get('capacity')),...(dynamic?{payment_timing:form.get('payment_timing'),estimated_total_cost:Number(form.get('estimated_total_cost'))}:{}),venue_booking_status: form.get('venue_booking_status'),
        venue_snapshot: venueSnapshot,
      }) });
      setVenueEditorOpen(false);
      setNotice({ kind: 'success', text: 'Rencana event berhasil diperbarui.' }); await load(session.access_token);
    } catch (reason) {
      if (reason instanceof Error && 'code' in reason && reason.code === 'VERSION_CONFLICT') {
        await load(session.access_token); setNotice({ kind: 'error', text: 'Event berubah di tab lain. Data terbaru sudah dimuat; periksa kembali sebelum menyimpan.' });
      } else setNotice({ kind: 'error', text: reason instanceof Error ? reason.message : 'Rencana belum dapat disimpan.' });
    }
    finally { setBusy(''); }
  }

  async function updatePriceOptions(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault(); if (!session || !event) return;
    const options=priceOptionsDraft.map(option=>({name:option.name.trim(),amount:Number(option.amount),quota:Number(option.quota)}));
    if (options.length<2 || options.some(option=>!option.name || !Number.isSafeInteger(option.amount) || option.amount<1 || !Number.isSafeInteger(option.quota) || option.quota<1)
      || options.reduce((sum,option)=>sum+option.quota,0)!==event.capacity
      || new Set(options.map(option=>option.name.toLocaleLowerCase('id-ID'))).size!==options.length) {
      setNotice({kind:'error',text:`Isi nama unik, harga dan kuota positif; jumlah kuota harus tepat ${event.capacity}.`}); return;
    }
    setBusy('pricing'); setNotice(null);
    try {
      await organizerRequest(`/events/${eventId}/price-options`,session.access_token,{method:'PUT',body:JSON.stringify({expected_version:event.version,price_options:options})});
      setPricingEditorOpen(false);
      setNotice({kind:'success',text:'Kategori harga berhasil diperbarui.'});
      await load(session.access_token);
    } catch (reason) {
      if(reason instanceof Error && 'code' in reason && reason.code==='PRICE_OPTIONS_LOCKED')
        setNotice({kind:'error',text:'Kategori harga tidak dapat diubah setelah ada peserta atau tagihan.'});
      else if(reason instanceof Error && 'code' in reason && reason.code==='VERSION_CONFLICT') {
        await load(session.access_token);setNotice({kind:'error',text:'Event berubah di tab lain. Periksa kembali kategori harga terbaru.'});
      } else setNotice({kind:'error',text:reason instanceof Error?reason.message:'Kategori harga belum dapat disimpan.'});
    } finally {setBusy('');}
  }

  async function changeStatus(status: 'confirmed' | 'completed') {
    if (!session || !event) return; setBusy(status); setNotice(null); setStageNotice(null);
    try { await organizerRequest(`/events/${eventId}/planning`, session.access_token, { method: 'PATCH', body: JSON.stringify({ expected_version:event.version,status }) }); setStageNotice({ kind: 'success', text: status === 'confirmed' ? 'Event sudah dikonfirmasi.' : 'Event ditandai selesai.' }); await load(session.access_token); }
    catch (reason) {
      if (reason instanceof Error && 'code' in reason && reason.code === 'VERSION_CONFLICT') {
        await load(session.access_token); setStageNotice({ kind: 'error', text: 'Status event sudah berubah di tab lain. Data terbaru sudah dimuat.' });
      } else setStageNotice({ kind: 'error', text: reason instanceof Error ? reason.message : 'Status belum dapat diperbarui.' });
    }
    finally { setBusy(''); }
  }

  async function addGuest(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault(); if (!session) return; setBusy('guest'); setNotice(null); setBookingLink('');
    const form = new FormData(formEvent.currentTarget);
    try {
      const result = await organizerRequest<{ participant_id: string; booking_token: string }>(`/events/${eventId}/participants`, session.access_token, { method: 'POST', body: JSON.stringify({ display_name: form.get('display_name'), whatsapp: form.get('whatsapp') }) });
      setBookingLink(`${window.location.origin}/event/?id=${eventId}#booking=${result.booking_token}`); formEvent.currentTarget.reset(); setNotice({ kind: 'success', text: 'Peserta ditambahkan. Bagikan tautan rahasia di bawah ini.' }); await load(session.access_token);
    } catch (reason) { setNotice({ kind: 'error', text: reason instanceof Error ? reason.message : 'Peserta belum dapat ditambahkan.' }); }
    finally { setBusy(''); }
  }

  async function lockContributions() {
    if (!session) return; setBusy('lock'); setNotice(null);
    try { await organizerRequest(`/events/${eventId}/contributions/lock`, session.access_token, { method: 'POST' }); setNotice({ kind: 'success', text: 'Iuran sudah dikunci untuk peserta aktif.' }); await load(session.access_token); }
    catch (reason) { setNotice({ kind: 'error', text: reason instanceof Error ? reason.message : 'Iuran belum dapat dikunci.' }); }
    finally { setBusy(''); }
  }

  async function recover(participantId: string) {
    if (!session) throw new Error('Masuk kembali untuk membuat tautan pengganti.');
    setBusy(participantId);
    setNotice(null);
    setBookingLink('');
    try {
      const result = await organizerRequest<{ booking_token: string }>(`/participants/${participantId}/guest-token`, session.access_token, { method: 'POST' });
      return `${window.location.origin}/event/?id=${eventId}#booking=${result.booking_token}`;
    } finally {
      setBusy('');
    }
  }

  async function cancelParticipant(formEvent: FormEvent<HTMLFormElement>, participantId: string) {
    formEvent.preventDefault(); if (!session) return; setBusy(`cancel-${participantId}`); setNotice(null);
    const form = new FormData(formEvent.currentTarget);
    try { await organizerRequest(`/participants/${participantId}/cancel`, session.access_token, { method: 'POST', body: JSON.stringify({ policy: form.get('policy'), reason: form.get('reason'), idempotency_key: crypto.randomUUID() }) }); setNotice({ kind: 'success', text: 'Peserta dibatalkan sesuai kebijakan yang dipilih.' }); await load(session.access_token); }
    catch (reason) { setNotice({ kind: 'error', text: reason instanceof Error ? reason.message : 'Peserta belum dapat dibatalkan.' }); }
    finally { setBusy(''); }
  }

  async function assignCharge(formEvent: FormEvent<HTMLFormElement>, participantId: string) {
    formEvent.preventDefault(); if (!session) return; setBusy(`charge-${participantId}`); setNotice(null);
    const form = new FormData(formEvent.currentTarget);
    try { await organizerRequest(`/participants/${participantId}/charge`, session.access_token, { method: 'POST', body: JSON.stringify({ amount: Number(form.get('amount')) }) }); setNotice({ kind: 'success', text: 'Tagihan peserta berhasil ditetapkan.' }); await load(session.access_token); }
    catch (reason) { setNotice({ kind: 'error', text: reason instanceof Error ? reason.message : 'Tagihan belum dapat ditetapkan.' }); }
    finally { setBusy(''); }
  }

  async function cancelEvent(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault(); if (!session) return; setBusy('cancel-event'); setNotice(null); setStageNotice(null);
    const form = new FormData(formEvent.currentTarget);
    try { await organizerRequest(`/events/${eventId}/cancel`, session.access_token, { method: 'POST', body: JSON.stringify({ policy: form.get('policy'), reason: form.get('reason'), idempotency_key: crypto.randomUUID() }) }); setStageNotice({ kind: 'success', text: 'Event dibatalkan. Riwayat peserta dan transaksi tetap tersimpan.' }); await load(session.access_token); }
    catch (reason) { setStageNotice({ kind: 'error', text: reason instanceof Error ? reason.message : 'Event belum dapat dibatalkan.' }); }
    finally { setBusy(''); }
  }

  async function createShareLink() {
    if (!session || !event || !canShareEvent(event.status, event.starts_at, event.timezone) || event.status === 'completed') return;
    setBusy('invite');
    setShareNotice(null);
    try {
      const link = await organizerRequest<NonNullable<EventShare['link']>>(`/events/${eventId}/invites`, session.access_token, { method: 'POST', body: '{}' });
      setShare({ link, legacy_active: false });
    } catch (reason) {
      setShareNotice({ kind: 'error', text: reason instanceof Error ? reason.message : 'Tautan undangan belum dapat dibuat.' });
    } finally {
      setBusy('');
    }
  }

  async function copyShareLink(url: string) {
    if (!event?.public_code && share?.link && Date.parse(share.link.expires_at) <= Date.now()) {
      setShare({ link: null, legacy_active: false });
      setShareNotice({ kind: 'error', text: 'Tautan undangan sudah kedaluwarsa.' });
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareNotice({ kind: 'success', text: 'Tautan disalin.' });
    } catch {
      setShareNotice({ kind: 'error', text: 'Tautan belum tersalin. Pilih dan salin langsung dari kolom tautan.' });
    }
  }

  if (!session) return <SessionGate ready={ready} />;
  if (!eventId || !isUuid(eventId)) return <div className={workspaceFormWidth}><NoticeBox notice={{ kind: 'error', text: 'Tautan kelola event tidak valid.' }} /></div>;
  if (loading) return <p className={`${workspaceFormWidth} ${workspaceFormPanel} ${panelInset} text-sm text-[#615d59]`} role="status">Memuat ruang kelola…</p>;
  if (!event || !roster) return <div className={workspaceFormWidth}>{notice && <NoticeBox notice={notice} />}</div>;

  const status = event.status === 'cancelled' ? 'dibatalkan' : event.status === 'completed' ? 'selesai' : event.status === 'confirmed' || event.status === 'published' ? 'terkonfirmasi' : 'mencari peserta';
  const nextStatus = event.status === 'recruiting' ? 'confirmed' : event.status === 'confirmed' || event.status === 'published' ? 'completed' : null;
  const statusAllowsSharing = canShareEvent(event.status);
  const isPast = statusAllowsSharing && !canShareEvent(event.status, event.starts_at, event.timezone);
  const shareAllowed = canShareEvent(event.status, event.starts_at, event.timezone);
  const shareLink = shareAllowed && (event.public_code || event.visibility === 'public' || share?.link)
    ? canonicalEventUrl(window.location.origin,event.public_code,eventId,event.visibility === 'unlisted' ? share?.link?.token : undefined)
    : '';

  const canEditPlanning = event.status !== 'completed' && event.status !== 'cancelled';
  const costModel = event.cost_model ?? (event.contribution_mode === 'dynamic' ? 'dynamic' : event.price_amount > 0 ? 'fixed' : 'free');
  const modelOption = costModelOptions.find(option => option.value === costModel);
  // Older fixed-price responses carry the actual timing in payment_mode.
  const timing = event.cost_model || costModel === 'dynamic' ? event.payment_timing : event.payment_mode;
  const timingOption = paymentTimingOptions.find(option => option.value === timing);
  const billingSection = (
    <WorkspaceFormSection id="manage-billing-title" title="Kapasitas dan pembayaran">
      <div className={sectionFields}>
        {canEditPlanning && <div>
          <Label htmlFor="manage-capacity">Kapasitas (orang)</Label>
          <Input id="manage-capacity" name="capacity" type="number" inputMode="numeric" min={1} max={100000} defaultValue={event.capacity} required className={field} />
        </div>}
        <dl className="sm:col-span-2">
          <dt className="mb-2 text-sm font-medium">Model biaya</dt>
          <dd className={`${workspaceFormChoice} px-3 py-2.5 text-sm`}>
            <p className="font-semibold">{modelOption?.label}</p>
            <p className="mt-0.5 leading-relaxed text-[#615d59]">{modelOption?.hint}</p>
          </dd>
        </dl>
        {costModel === 'dynamic' && canEditPlanning && <div>
          <Label htmlFor="manage-cost">Perkiraan biaya total (Rp)</Label>
          <Input id="manage-cost" name="estimated_total_cost" type="number" min={0} max={1e12} step={1} defaultValue={roster.estimated_total_cost} required className={field} />
        </div>}
        {costModel === 'fixed' && (event.price_options?.length ? <div className="sm:col-span-2">
          <p className="text-sm font-medium">Harga dan kuota per kategori</p>
          <ul className="mt-2 divide-y divide-[#e6e3df] rounded-lg border border-[#e6e3df]">
            {event.price_options.map(option => <li key={option.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <span className="font-medium">{option.name}</span>
              <span className="text-right tabular-nums">Rp {rupiah.format(option.amount)}<span className="block text-xs text-[#615d59]">{option.taken} dari {option.quota} terisi</span></span>
            </li>)}
          </ul>
        </div> : <dl>
          <dt className="text-sm font-medium">Harga per peserta</dt>
          <dd className="mt-2 text-sm tabular-nums">Rp {rupiah.format(event.price_amount)}</dd>
        </dl>)}
        {costModel === 'dynamic' && canEditPlanning ? <div>
          <Label htmlFor="manage-timing">Waktu pembayaran</Label>
          <SearchableSelect id="manage-timing" name="payment_timing" defaultValue={timingOption?.value ?? 'before_event'} className="mt-2">
            {paymentTimingOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </SearchableSelect>
        </div> : costModel !== 'free' && timingOption && <dl>
          <dt className="text-sm font-medium">Waktu pembayaran</dt>
          <dd className="mt-2 text-sm">{timingOption.label}</dd>
        </dl>}
      </div>
    </WorkspaceFormSection>
  );

  return <div className={`${workspaceFormWidth} ${workspaceFormPanel} wrap-anywhere`}>
    <WorkspaceFormHeader
      icon={SlidersHorizontal}
      title={event.title}
      description={`${event.participants_count} dari ${event.capacity} tempat terisi · ${status}`}
      action={event.status !== 'cancelled' && shareLink && <Button asChild variant="outline" className="min-h-11"><a href={shareLink}>Lihat halaman peserta</a></Button>}
    />
    {notice && <div className={panelInset}><NoticeBox notice={notice} /></div>}
    {bookingLink && <WorkspaceFormSection id="booking-link-title" title="Tautan booking rahasia">
      <div className="rounded-lg bg-amber-50 p-4 text-amber-950">
        <p className="break-all text-sm">{bookingLink}</p>
        <Button type="button" variant="outline" className="mt-3 min-h-11 bg-white" onClick={() => void navigator.clipboard.writeText(bookingLink)}><Copy aria-hidden="true" />Salin tautan</Button>
      </div>
    </WorkspaceFormSection>}
    {canEditPlanning ? <form key={event.version} onSubmit={updatePlanning} className={workspaceFormDividers} aria-labelledby="planning-title">
      <WorkspaceFormSection id="planning-title" title="Dasar event" description="Workspace, jenis kegiatan, dan akses ditetapkan saat event dibuat.">
        <EventBasicsFields event={event} activities={activities} />
      </WorkspaceFormSection>
      <WorkspaceFormSection id="manage-schedule-title" title="Jadwal" description="Atur waktu kegiatan dan batas pendaftaran.">
        <div className={sectionFields}>
          <div><Label htmlFor="manage-starts">Mulai</Label><Input id="manage-starts" name="starts_at" type="datetime-local" defaultValue={localDateTime(event.starts_at,event.timezone)} required className={field} /></div><div><Label htmlFor="manage-ends">Selesai</Label><Input id="manage-ends" name="ends_at" type="datetime-local" defaultValue={localDateTime(event.ends_at,event.timezone)} required className={field} /></div>
          <div><Label htmlFor="manage-closes">Pendaftaran ditutup</Label><Input id="manage-closes" name="registration_closes_at" type="datetime-local" defaultValue={localDateTime(event.registration_closes_at,event.timezone)} required className={field} /></div><div><Label htmlFor="manage-timezone">Zona waktu</Label><Input id="manage-timezone" value={event.timezone} readOnly aria-readonly="true" className={`${field} bg-slate-50`} /></div>
        </div>
      </WorkspaceFormSection>
      <WorkspaceFormSection id="manage-location-title" title="Lokasi" description="Perbarui status venue. Ganti venue atau buka detail lokasi bila perlu.">
        <div className={sectionFields}>
          <div className="sm:col-span-2"><Label htmlFor="venue-status">Status venue</Label><SearchableSelect id="venue-status" name="venue_booking_status" defaultValue={event.venue_booking_status ?? 'not_booked'} className="mt-2"><option value="not_booked">Belum dipesan</option><option value="pending">Sedang diproses</option><option value="booked">Sudah dipesan</option><option value="cancelled">Dibatalkan</option></SearchableSelect></div>
          <div className="sm:col-span-2 flex flex-col gap-3 rounded-lg border border-[#e6e3df] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">Venue saat ini</p>
              <p className="mt-0.5 text-sm">{event.venue.name === 'Venue belum ditentukan' ? 'Belum dipilih' : event.venue.name}</p>
              {event.venue.address && <p className="mt-0.5 text-sm text-[#615d59]">{event.venue.address}</p>}
            </div>
            <Button type="button" variant="outline" className="min-h-11 w-full shrink-0 sm:w-fit" aria-expanded={venueEditorOpen} aria-controls="manage-venue-picker" onClick={() => setVenueEditorOpen(open => !open)}>
              <MapPin aria-hidden="true" />{venueEditorOpen ? 'Tutup pencarian venue' : event.venue.name === 'Venue belum ditentukan' ? 'Pilih venue' : 'Ganti venue'}
            </Button>
          </div>
          <div id="manage-venue-picker" className="sm:col-span-2" hidden={!venueEditorOpen}>
            <VenuePicker workspace={event.workspace_id} token={session.access_token} />
          </div>
          <details className="rounded-lg border border-[#e6e3df] bg-white px-3 sm:col-span-2">
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Detail lokasi manual</summary>
            <div className={sectionFields}>
              <div><Label htmlFor="manage-venue">Nama venue</Label><Input id="manage-venue" name="venue_name" defaultValue={event.venue.name === 'Venue belum ditentukan' ? '' : event.venue.name} maxLength={200} className={field} /></div>
              <div><Label htmlFor="manage-address">Alamat</Label><Input id="manage-address" name="venue_address" defaultValue={event.venue.address} maxLength={1000} className={field} /></div>
              <div><Label htmlFor="manage-latitude">Latitude</Label><Input id="manage-latitude" name="latitude" type="number" inputMode="decimal" min={-90} max={90} step="any" defaultValue={event.venue.latitude} className={field} /></div>
              <div><Label htmlFor="manage-longitude">Longitude</Label><Input id="manage-longitude" name="longitude" type="number" inputMode="decimal" min={-180} max={180} step="any" defaultValue={event.venue.longitude} className={field} /></div>
              <div className="sm:col-span-2"><Label htmlFor="manage-maps">Tautan Google Maps <span className="font-normal text-slate-500">(opsional jika koordinat diisi)</span></Label><Input id="manage-maps" name="maps_url" type="url" defaultValue={event.venue.maps_url} maxLength={2000} className={field} /></div>
              <div className="sm:col-span-2"><Label htmlFor="manage-coarse-region">Kode area umum untuk rekomendasi</Label><Input id="manage-coarse-region" name="coarse_region_code" defaultValue={event.venue.coarse_region_code} maxLength={32} className={field} placeholder="Contoh: ID-JK" /><p className="mt-1 text-xs text-slate-500">Opsional; gunakan kode kota/provinsi umum, bukan koordinat atau alamat.</p></div>
              <div className="sm:col-span-2"><Label htmlFor="manage-meeting">Petunjuk bertemu</Label><textarea id="manage-meeting" name="meeting_instructions" maxLength={1000} rows={3} defaultValue={event.venue.meeting_instructions} className={textarea} /></div>
            </div>
          </details>
        </div>
      </WorkspaceFormSection>
      {billingSection}
      <div className={`${panelInset} flex sm:justify-end`}>
        <Button type="submit" disabled={busy === 'planning'} className={`${workspaceFormAction} w-full sm:w-fit`}>{busy === 'planning' ? 'Menyimpan…' : 'Simpan planning'}</Button>
      </div>
    </form> : billingSection}
    {costModel === 'fixed' && canEditPlanning && <WorkspaceFormSection id="manage-pricing-title" title="Kategori harga" description="Atur biaya berbeda untuk setiap kategori sebelum peserta pertama mendaftar.">
      {roster.participants.length ? <p className="text-sm text-[#615d59]">Kategori harga terkunci karena event sudah memiliki peserta. Tagihan yang ada tetap memakai nominal saat peserta mendaftar.</p> : <>
        <Button type="button" variant="outline" className="min-h-11" aria-expanded={pricingEditorOpen} aria-controls="manage-pricing-editor" onClick={()=>setPricingEditorOpen(open=>!open)}>{pricingEditorOpen?'Tutup pengaturan':'Atur kategori harga'}</Button>
        {pricingEditorOpen && <form id="manage-pricing-editor" onSubmit={updatePriceOptions} className="mt-4 grid gap-4" aria-labelledby="manage-pricing-title">
          <p className="text-sm text-[#615d59]">Jumlah kuota seluruh kategori harus sama dengan kapasitas event ({event.capacity}). Simpan perubahan kapasitas di atas terlebih dahulu.</p>
          {priceOptionsDraft.map((option,index)=><div key={option.id} className="grid gap-3 rounded-lg border border-[#e6e3df] p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <div><Label htmlFor={`manage-price-name-${index}`}>Nama kategori</Label><Input id={`manage-price-name-${index}`} placeholder="Kategori" value={option.name} maxLength={80} onChange={change=>setPriceOptionsDraft(items=>items.map((item,i)=>i===index?{...item,name:change.target.value}:item))} required className={field}/></div>
            <div><Label htmlFor={`manage-price-amount-${index}`}>Harga (Rp)</Label><Input id={`manage-price-amount-${index}`} type="number" min={1} max={1e12} step={1} value={option.amount} onChange={change=>setPriceOptionsDraft(items=>items.map((item,i)=>i===index?{...item,amount:change.target.value}:item))} required className={field}/></div>
            <div><Label htmlFor={`manage-price-quota-${index}`}>Kuota</Label><Input id={`manage-price-quota-${index}`} type="number" min={1} max={100000} step={1} value={option.quota} onChange={change=>setPriceOptionsDraft(items=>items.map((item,i)=>i===index?{...item,quota:change.target.value}:item))} required className={field}/></div>
            {priceOptionsDraft.length>2&&<Button type="button" variant="ghost" size="icon" aria-label={`Hapus kategori ${option.name.trim()||index+1}`} title="Hapus kategori" onClick={()=>setPriceOptionsDraft(items=>items.length>2?items.filter((_,i)=>i!==index):items)} className="size-11 self-end text-[#615d59] hover:text-rose-700"><Trash2 className="size-4" aria-hidden="true" /></Button>}
          </div>)}
          <div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" disabled={priceOptionsDraft.length>=20} onClick={()=>setPriceOptionsDraft(items=>[...items,{id:crypto.randomUUID(),name:'',amount:'',quota:''}])} className="min-h-11">Tambah kategori</Button><span className="text-xs text-[#615d59]">Minimal 2, maksimal 20 kategori.</span><Button type="submit" disabled={busy==='pricing'} className="min-h-11">{busy==='pricing'?'Menyimpan…':'Simpan kategori harga'}</Button></div>
        </form>}
      </>}
    </WorkspaceFormSection>}
    <EventRosterTable
      roster={roster}
      dynamic={event.contribution_mode === 'dynamic'}
      eventStatus={event.status}
      busy={busy}
      page={rosterPage}
      onPageChange={setRosterPage}
      onLock={lockContributions}
      onRecover={recover}
      onAssignCharge={assignCharge}
      onCancel={cancelParticipant}
    />
    {event.status !== 'completed' && event.status !== 'cancelled' && <WorkspaceFormSection
      id="add-guest-title"
      title="Tambahkan guest"
      description="Dolend membuat tautan rahasia yang hanya ditampilkan sekali."
    >
      <form onSubmit={addGuest} className={sectionFields} aria-labelledby="add-guest-title">
        <div className="min-w-0"><Label htmlFor="guest-name">Nama peserta</Label><Input id="guest-name" name="display_name" required maxLength={120} className={field} /></div><div className="min-w-0"><Label htmlFor="guest-whatsapp">Nomor WhatsApp</Label><Input id="guest-whatsapp" name="whatsapp" type="tel" inputMode="tel" required minLength={8} maxLength={32} className={field} placeholder="08…" /></div><Button type="submit" disabled={busy === 'guest'} className={`${workspaceFormAction} sm:col-span-2 w-full sm:w-fit`}>{busy === 'guest' ? 'Menambahkan…' : 'Tambahkan peserta'}</Button>
      </form>
    </WorkspaceFormSection>}
    <WorkspaceFormSection id={eventShareSectionId} title="Bagikan event">
      {event.public_code && <div className="mb-4 rounded-lg border border-[#e6e3df] bg-[#f6f5f4] p-3">
        <Label htmlFor="event-public-code">Kode unik event</Label>
        <Input id="event-public-code" readOnly value={event.public_code} className="mt-2 min-h-11 font-mono tracking-wider" />
        {shareLink && <Button type="button" variant="outline" className="mt-3 min-h-11" onClick={() => void copyShareLink(shareLink)}><Copy aria-hidden="true" />Salin tautan pendek</Button>}
      </div>}
      {isPast ? (
        <p className="text-sm text-[#615d59]">Event sudah lewat. Tautan undangan tidak tersedia.</p>
      ) : shareLink ? <div>
        <Label htmlFor="share-link">Tautan yang dibagikan</Label>
        <Input id="share-link" readOnly value={shareLink} className={field} />
        {!event.public_code && share?.link && <p className="mt-2 text-sm text-[#615d59]">Berlaku sampai {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: event.timezone }).format(new Date(share.link.expires_at))}.</p>}
        <Button type="button" variant="outline" className="mt-3 min-h-11" onClick={() => void copyShareLink(shareLink)}><Copy aria-hidden="true" />Salin tautan</Button>
      </div> : event.status === 'cancelled' || event.status === 'completed' ? (
        <p className="text-sm text-[#615d59]">Tautan aktif tidak tersedia.</p>
      ) : !shareAllowed ? (
        <p className="text-sm text-[#615d59]">Konfirmasi event terlebih dahulu agar bisa dibagikan.</p>
      ) : !share ? (
        <p role="alert" className="text-sm text-rose-800">Tautan belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.</p>
      ) : (
        <div>
          <p className="mb-3 text-sm text-[#615d59]">Bagikan tautan ini ke teman-temanmu dan ajak mereka ikut event.</p>
          {share.legacy_active && <p className="mb-3 text-sm text-[#615d59]">Tautan lama tidak bisa ditampilkan kembali. Membuat tautan pengganti akan menonaktifkan undangan lama.</p>}
          <Button type="button" disabled={busy === 'invite'} className={workspaceFormAction} onClick={() => void createShareLink()}>
            {busy === 'invite' ? 'Membuat…' : share.legacy_active ? 'Buat tautan pengganti' : 'Buat tautan undangan'}
          </Button>
        </div>
      )}
      {shareNotice && <p className={`mt-3 text-sm ${shareNotice.kind === 'error' ? 'text-rose-800' : 'text-[#615d59]'}`} role={shareNotice.kind === 'error' ? 'alert' : 'status'}>{shareNotice.text}</p>}
    </WorkspaceFormSection>
    <WorkspaceFormSection id="manage-status-title" title="Tahap event">
      {stageNotice && <div className="mb-4"><NoticeBox notice={stageNotice} /></div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold first-letter:uppercase">{status}</p>
          <p id="event-stage-hint" className="mt-1 text-sm leading-6 text-[#615d59]">
            {nextStatus === 'confirmed' ? 'Konfirmasi saat jadwal dan lokasi sudah siap. Setelah itu, event bisa dibagikan.'
              : nextStatus === 'completed' ? 'Tandai selesai setelah kegiatan berakhir.'
                : event.status === 'cancelled' ? 'Riwayat peserta dan transaksi tetap tersedia.'
                  : 'Periksa sisa tagihan dan pengembalian dana.'}
          </p>
        </div>
        {nextStatus && <Button type="button" className={`${workspaceFormAction} w-full sm:w-auto`} disabled={Boolean(busy)} aria-describedby="event-stage-hint" onClick={() => void changeStatus(nextStatus)}>
          {busy === nextStatus ? 'Memperbarui…' : nextStatus === 'confirmed' ? 'Konfirmasi event' : 'Tandai selesai'}
        </Button>}
      </div>
      {nextStatus && <details className="group/cancel mt-5 border-t border-[#e6e3df] pt-2">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 text-sm font-medium text-rose-800 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-800 [&::-webkit-details-marker]:hidden">
          Batalkan event
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 group-open/cancel:rotate-180" />
        </summary>
        <form onSubmit={cancelEvent} className="space-y-4 px-3 pb-2 pt-3">
          <p className="text-sm leading-6 text-[#615d59]">Semua peserta aktif akan dibatalkan. Pilih apakah tagihan yang sudah dikunci tetap ditagih atau dihapus.</p>
          <div>
            <Label htmlFor="event-cancel-policy">Kebijakan tagihan</Label>
            <SearchableSelect id="event-cancel-policy" name="policy" className="mt-2">
              <option value="waive">Hapus sisa tagihan</option>
              <option value="retain">Pertahankan tagihan</option>
            </SearchableSelect>
          </div>
          <div>
            <Label htmlFor="event-cancel-reason">Alasan pembatalan</Label>
            <Input id="event-cancel-reason" name="reason" required maxLength={1000} className={field} />
          </div>
          <Button type="submit" variant="destructive" disabled={Boolean(busy)} className="min-h-11 w-full sm:w-auto">
            <Ban aria-hidden="true" />
            {busy === 'cancel-event' ? 'Membatalkan…' : 'Batalkan event'}
          </Button>
        </form>
      </details>}
    </WorkspaceFormSection>
  </div>;
}

function NoticeBox({ notice }: { notice: Exclude<Notice, null> }) { return <p className={`rounded-xl border p-4 text-sm font-medium ${notice.kind === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>; }
