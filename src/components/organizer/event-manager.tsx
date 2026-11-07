'use client';

import { SearchableSelect } from '@/components/ui/searchable-select';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Ban, ChevronDown, Copy, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { organizerRequest, type ActivityType, type EventRoster } from '@/lib/organizer-client';
import { isUuid, type PublicEvent } from '@/lib/event-client';
import { useOrganizerSession } from '@/lib/use-organizer-session';
import { venueSnapshotFromForm } from '@/lib/venue-form';
import { canShareEvent, canonicalEventUrl, eventShareSectionId } from '@/lib/event-share';
import { SessionGate } from './session-gate';
import { EventBasicsFields } from './event-basics-fields';
import { EventRosterTable } from './event-roster-table';
import { WorkspaceFormHeader, WorkspaceFormSection, workspaceFormAction, workspaceFormControl, workspaceFormDividers, workspaceFormPanel, workspaceFormWidth } from './workspace-form';

const field = `mt-2 ${workspaceFormControl}`;
const textarea = `${field} h-auto resize-y py-2`;
const sectionFields = 'grid gap-4 sm:grid-cols-2';
const panelInset = 'px-5 py-5 sm:px-8';
const zoneOffsets:Record<string,string>={'Asia/Jakarta':'+07:00','Asia/Makassar':'+08:00','Asia/Jayapura':'+09:00'};
type Notice = { kind: 'success' | 'error'; text: string } | null;
type ManagedEvent = Omit<PublicEvent, 'venue'> & { venue: PublicEvent['venue'] & { coarse_region_code?: string }; status: 'published'|'recruiting' | 'confirmed' | 'completed' | 'cancelled'; visibility:'public'|'unlisted'; venue_booking_status: string; version: number; registration_closes_at:string; payment_timing:'before_event'|'after_event';payment_mode?:'free'|'before_event'|'after_event' };
type EventShare = { link: { token: string; expires_at: string } | null; legacy_active: boolean };
type OrganizerEventBasics = { workspace_name?: string | null; activity_type_name?: string | null };

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
  const [share, setShare] = useState<EventShare | null>(null);
  const [shareNotice, setShareNotice] = useState<Notice>(null);

  const load = useCallback(async (token: string) => {
    setLoading(true);
    try {
      const [nextEvent, nextRoster, nextShare] = await Promise.all([
        organizerRequest<ManagedEvent & OrganizerEventBasics>(`/organizer/events/${eventId}`, token),
        organizerRequest<EventRoster>(`/events/${eventId}/roster`, token),
        organizerRequest<EventShare>(`/events/${eventId}/share-link`, token).catch(() => null),
      ]);
      setEvent(nextEvent); setRoster(nextRoster); setShare(nextShare); setShareNotice(null);
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
      setNotice({ kind: 'success', text: 'Rencana event berhasil diperbarui.' }); await load(session.access_token);
    } catch (reason) {
      if (reason instanceof Error && 'code' in reason && reason.code === 'VERSION_CONFLICT') {
        await load(session.access_token); setNotice({ kind: 'error', text: 'Event berubah di tab lain. Data terbaru sudah dimuat; periksa kembali sebelum menyimpan.' });
      } else setNotice({ kind: 'error', text: reason instanceof Error ? reason.message : 'Rencana belum dapat disimpan.' });
    }
    finally { setBusy(''); }
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
    if (!session || !event || !canShareEvent(event.status) || event.status === 'completed') return;
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
    if (share?.link && Date.parse(share.link.expires_at) <= Date.now()) {
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
  const shareAllowed = canShareEvent(event.status);
  const shareLink = shareAllowed && (event.visibility === 'public' || share?.link)
    ? canonicalEventUrl(window.location.origin, eventId, event.visibility === 'unlisted' ? share?.link?.token : undefined)
    : '';

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
    {event.status !== 'completed' && event.status !== 'cancelled' && <form key={event.version} onSubmit={updatePlanning} className={workspaceFormDividers} aria-labelledby="planning-title">
      <WorkspaceFormSection id="planning-title" title="Dasar event" description="Workspace, jenis kegiatan, dan akses ditetapkan saat event dibuat.">
        <EventBasicsFields event={event} activities={activities} />
      </WorkspaceFormSection>
      <WorkspaceFormSection id="manage-schedule-title" title="Jadwal" description="Atur waktu kegiatan dan batas pendaftaran.">
        <div className={sectionFields}>
          <div><Label htmlFor="manage-starts">Mulai</Label><Input id="manage-starts" name="starts_at" type="datetime-local" defaultValue={localDateTime(event.starts_at,event.timezone)} required className={field} /></div><div><Label htmlFor="manage-ends">Selesai</Label><Input id="manage-ends" name="ends_at" type="datetime-local" defaultValue={localDateTime(event.ends_at,event.timezone)} required className={field} /></div>
          <div><Label htmlFor="manage-closes">Pendaftaran ditutup</Label><Input id="manage-closes" name="registration_closes_at" type="datetime-local" defaultValue={localDateTime(event.registration_closes_at,event.timezone)} required className={field} /></div><div><Label htmlFor="manage-timezone">Zona waktu</Label><Input id="manage-timezone" value={event.timezone} readOnly aria-readonly="true" className={`${field} bg-slate-50`} /></div>
        </div>
      </WorkspaceFormSection>
      <WorkspaceFormSection id="manage-location-title" title="Lokasi" description="Perbarui tempat, status pemesanan, dan petunjuk bertemu.">
        <div className={sectionFields}>
          <div className="sm:col-span-2"><Label htmlFor="venue-status">Status venue</Label><SearchableSelect id="venue-status" name="venue_booking_status" defaultValue={event.venue_booking_status ?? 'not_booked'} className="mt-2"><option value="not_booked">Belum dipesan</option><option value="pending">Sedang diproses</option><option value="booked">Sudah dipesan</option><option value="cancelled">Dibatalkan</option></SearchableSelect></div>
          <div><Label htmlFor="manage-venue">Nama venue</Label><Input id="manage-venue" name="venue_name" defaultValue={event.venue.name === 'Venue belum ditentukan' ? '' : event.venue.name} maxLength={200} className={field} /></div><div><Label htmlFor="manage-address">Alamat</Label><Input id="manage-address" name="venue_address" defaultValue={event.venue.address} maxLength={1000} className={field} /></div>
          <div><Label htmlFor="manage-latitude">Latitude</Label><Input id="manage-latitude" name="latitude" type="number" inputMode="decimal" min={-90} max={90} step="any" defaultValue={event.venue.latitude} className={field} /></div><div><Label htmlFor="manage-longitude">Longitude</Label><Input id="manage-longitude" name="longitude" type="number" inputMode="decimal" min={-180} max={180} step="any" defaultValue={event.venue.longitude} className={field} /></div>
          <div className="sm:col-span-2"><Label htmlFor="manage-maps">Tautan Google Maps <span className="font-normal text-slate-500">(opsional jika koordinat diisi)</span></Label><Input id="manage-maps" name="maps_url" type="url" defaultValue={event.venue.maps_url} maxLength={2000} className={field} /></div>
          <div className="sm:col-span-2"><Label htmlFor="manage-coarse-region">Kode area umum untuk rekomendasi</Label><Input id="manage-coarse-region" name="coarse_region_code" defaultValue={event.venue.coarse_region_code} maxLength={32} className={field} placeholder="Contoh: ID-JK" /><p className="mt-1 text-xs text-slate-500">Opsional; gunakan kode kota/provinsi umum, bukan koordinat atau alamat.</p></div>
          <div className="sm:col-span-2"><Label htmlFor="manage-meeting">Petunjuk bertemu</Label><textarea id="manage-meeting" name="meeting_instructions" maxLength={1000} rows={3} defaultValue={event.venue.meeting_instructions} className={textarea} /></div>
        </div>
      </WorkspaceFormSection>
      <WorkspaceFormSection id="manage-billing-title" title="Kapasitas dan pembayaran" description="Atur kapasitas dan, untuk iuran dinamis, perkiraan biaya serta waktu pembayaran.">
        <div className={sectionFields}>
          <div><Label htmlFor="manage-capacity">Kapasitas (orang)</Label><Input id="manage-capacity" name="capacity" type="number" inputMode="numeric" min={1} max={100000} defaultValue={event.capacity} required className={field} /></div>
          {event.contribution_mode === 'dynamic' && <>
            <div><Label htmlFor="manage-cost">Perkiraan biaya total (Rp)</Label><Input id="manage-cost" name="estimated_total_cost" type="number" min={0} step={1000} defaultValue={roster.estimated_total_cost} required className={field} /></div>
            <div><Label htmlFor="manage-timing">Waktu pembayaran</Label><SearchableSelect id="manage-timing" name="payment_timing" defaultValue={event.payment_timing} className="mt-2"><option value="before_event">Sebelum event</option><option value="after_event">Setelah event</option></SearchableSelect></div>
          </>}
        </div>
      </WorkspaceFormSection>
      <div className={`${panelInset} flex sm:justify-end`}>
        <Button type="submit" disabled={busy === 'planning'} className={`${workspaceFormAction} w-full sm:w-fit`}>{busy === 'planning' ? 'Menyimpan…' : 'Simpan planning'}</Button>
      </div>
    </form>}
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
      {shareLink ? <div>
        <Label htmlFor="share-link">Tautan yang dibagikan</Label>
        <Input id="share-link" readOnly value={shareLink} className={field} />
        {share?.link && <p className="mt-2 text-sm text-[#615d59]">Berlaku sampai {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: event.timezone }).format(new Date(share.link.expires_at))}.</p>}
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
