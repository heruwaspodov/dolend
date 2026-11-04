'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Ban, Check, Copy, LockKeyhole, MessageCircle, RotateCcw, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { displayParticipantName, organizerRequest, type EventRoster } from '@/lib/organizer-client';
import { isUuid, type PublicEvent } from '@/lib/event-client';
import { useOrganizerSession } from '@/lib/use-organizer-session';
import { venueSnapshotFromForm } from '@/lib/venue-form';
import { canonicalEventUrl, eventShareText, whatsAppShareUrl } from '@/lib/event-share';
import { SessionGate } from './session-gate';

const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const field = 'mt-2 min-h-11 border-slate-300 bg-white';
const select = `${field} w-full rounded-lg border px-3 text-sm outline-none focus-visible:border-emerald-700 focus-visible:ring-3 focus-visible:ring-emerald-700/20`;
const zoneOffsets:Record<string,string>={'Asia/Jakarta':'+07:00','Asia/Makassar':'+08:00','Asia/Jayapura':'+09:00'};
type Notice = { kind: 'success' | 'error'; text: string } | null;
type ManagedEvent = PublicEvent & { status: 'published'|'recruiting' | 'confirmed' | 'completed' | 'cancelled'; visibility:'public'|'unlisted'; venue_booking_status: string; version: number; registration_closes_at:string; payment_timing:'before_event'|'after_event';payment_mode?:'free'|'before_event'|'after_event' };
type EventInvite={id:string;expires_at:string|null;revoked_at:string|null;created_at:string};

function localDateTime(value:string,timeZone:string) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('sv-SE',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(part=>[part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function EventManager() {
  const eventId = useSearchParams().get('id') ?? '';
  const { session, ready } = useOrganizerSession();
  const [event, setEvent] = useState<ManagedEvent | null>(null);
  const [roster, setRoster] = useState<EventRoster | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [bookingLink, setBookingLink] = useState('');
  const [invites,setInvites]=useState<EventInvite[]>([]);
  const [shareLink,setShareLink]=useState('');
  const [loadedAt,setLoadedAt]=useState(0);

  const load = useCallback(async (token: string) => {
    setLoading(true);
    try {
      const [nextEvent, nextRoster,nextInvites] = await Promise.all([
        organizerRequest<ManagedEvent>(`/organizer/events/${eventId}`, token),
        organizerRequest<EventRoster>(`/events/${eventId}/roster`, token),
        organizerRequest<EventInvite[]>(`/events/${eventId}/invites`,token),
      ]);
      setEvent(nextEvent); setRoster(nextRoster);setInvites(nextInvites);
      setLoadedAt(Date.now());
      setShareLink(nextEvent.visibility==='public'?canonicalEventUrl(window.location.origin,eventId):'');
    } catch (reason) { setNotice({ kind: 'error', text: reason instanceof Error ? reason.message : 'Event belum dapat dimuat.' }); }
    finally { setLoading(false); }
  }, [eventId]);

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
    if (!session || !event) return; setBusy(status); setNotice(null);
    try { await organizerRequest(`/events/${eventId}/planning`, session.access_token, { method: 'PATCH', body: JSON.stringify({ expected_version:event.version,status }) }); setNotice({ kind: 'success', text: status === 'confirmed' ? 'Event sudah dikonfirmasi.' : 'Event ditandai selesai.' }); await load(session.access_token); }
    catch (reason) {
      if (reason instanceof Error && 'code' in reason && reason.code === 'VERSION_CONFLICT') {
        await load(session.access_token); setNotice({ kind: 'error', text: 'Status event sudah berubah di tab lain. Data terbaru sudah dimuat.' });
      } else setNotice({ kind: 'error', text: reason instanceof Error ? reason.message : 'Status belum dapat diperbarui.' });
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
    if (!session) return; setBusy(participantId); setNotice(null); setBookingLink('');
    try { const result = await organizerRequest<{ booking_token: string }>(`/participants/${participantId}/guest-token`, session.access_token, { method: 'POST' }); setBookingLink(`${window.location.origin}/event/?id=${eventId}#booking=${result.booking_token}`); setNotice({ kind: 'success', text: 'Tautan lama dicabut. Bagikan tautan pengganti hanya kepada peserta yang benar.' }); }
    catch (reason) { setNotice({ kind: 'error', text: reason instanceof Error ? reason.message : 'Tautan belum dapat diganti.' }); }
    finally { setBusy(''); }
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
    formEvent.preventDefault(); if (!session) return; setBusy('cancel-event'); setNotice(null);
    const form = new FormData(formEvent.currentTarget);
    try { await organizerRequest(`/events/${eventId}/cancel`, session.access_token, { method: 'POST', body: JSON.stringify({ policy: form.get('policy'), reason: form.get('reason'), idempotency_key: crypto.randomUUID() }) }); setNotice({ kind: 'success', text: 'Event dibatalkan. Riwayat peserta dan transaksi tetap tersimpan.' }); await load(session.access_token); }
    catch (reason) { setNotice({ kind: 'error', text: reason instanceof Error ? reason.message : 'Event belum dapat dibatalkan.' }); }
    finally { setBusy(''); }
  }

  async function createInvite(formEvent:FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();if(!session||!event)return;setBusy('invite');setNotice(null);
    const form=new FormData(formEvent.currentTarget);const local=String(form.get('expires_at')??'');
    const offset=zoneOffsets[event.timezone]??'+07:00';
    try {
      const invite=await organizerRequest<EventInvite&{token:string}>(`/events/${eventId}/invites`,session.access_token,{method:'POST',body:JSON.stringify(local?{expires_at:`${local}:00${offset}`}:{})});
      setShareLink(canonicalEventUrl(window.location.origin,eventId,invite.token));
      setInvites(current=>[{id:invite.id,expires_at:invite.expires_at,revoked_at:invite.revoked_at,created_at:invite.created_at},...current]);
      setNotice({kind:'success',text:'Undangan dibuat. Tautan rahasia hanya ditampilkan pada halaman ini sekarang.'});
    } catch(reason) {setNotice({kind:'error',text:reason instanceof Error?reason.message:'Undangan belum dapat dibuat.'});}
    finally {setBusy('');}
  }

  async function revokeInvite(inviteId:string) {
    if(!session)return;setBusy(`invite-${inviteId}`);setNotice(null);
    try {const revoked=await organizerRequest<EventInvite>(`/invites/${inviteId}/revoke`,session.access_token,{method:'POST'});setInvites(current=>current.map(invite=>invite.id===inviteId?revoked:invite));setShareLink('');setNotice({kind:'success',text:'Undangan dicabut dan tidak dapat dipakai lagi.'});}
    catch(reason){setNotice({kind:'error',text:reason instanceof Error?reason.message:'Undangan belum dapat dicabut.'});}
    finally{setBusy('');}
  }

  if (!session) return <SessionGate ready={ready} />;
  if (!eventId || !isUuid(eventId)) return <p className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800" role="alert">Tautan kelola event tidak valid.</p>;
  if (loading) return <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600" role="status">Memuat ruang kelola…</p>;
  if (!event || !roster) return <>{notice && <NoticeBox notice={notice} />}</>;

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold tracking-widest text-emerald-700 uppercase">Kelola event</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">{event.title}</h1><p className="mt-2 text-sm text-slate-600">{event.participants_count} dari {event.capacity} tempat terisi · {event.status === 'cancelled' ? 'dibatalkan' : event.status === 'completed' ? 'selesai' : event.status === 'confirmed'||event.status==='published' ? 'terkonfirmasi' : 'mencari peserta'}</p></div>{event.status !== 'cancelled'&&shareLink&&<Button asChild variant="outline" className="min-h-11"><a href={shareLink}>Lihat halaman peserta</a></Button>}</header>
    {notice && <NoticeBox notice={notice} />}
    {bookingLink && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4" aria-labelledby="booking-link-title"><h2 id="booking-link-title" className="font-bold text-amber-950">Tautan booking rahasia</h2><p className="mt-2 break-all text-xs leading-relaxed text-amber-950">{bookingLink}</p><Button type="button" variant="outline" className="mt-3 min-h-11 bg-white" onClick={() => void navigator.clipboard.writeText(bookingLink)}><Copy aria-hidden="true" />Salin tautan</Button></section>}
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        {event.status !== 'completed' && event.status !== 'cancelled' && <form key={event.version} onSubmit={updatePlanning} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="planning-title"><h2 id="planning-title" className="text-lg font-bold">Planning</h2><p className="mt-2 text-sm text-slate-600">Perubahan memakai versi terbaru agar edit dari tab lain tidak tertimpa.</p><div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label htmlFor="manage-title">Nama event</Label><Input id="manage-title" name="title" defaultValue={event.title} required maxLength={200} className={field} /></div>
          <div className="sm:col-span-2"><Label htmlFor="manage-description">Deskripsi</Label><textarea id="manage-description" name="description" defaultValue={event.description} maxLength={10000} rows={4} className={`${select} py-3`} /></div>
          <div><Label htmlFor="manage-starts">Mulai</Label><Input id="manage-starts" name="starts_at" type="datetime-local" defaultValue={localDateTime(event.starts_at,event.timezone)} required className={field} /></div><div><Label htmlFor="manage-ends">Selesai</Label><Input id="manage-ends" name="ends_at" type="datetime-local" defaultValue={localDateTime(event.ends_at,event.timezone)} required className={field} /></div>
          <div><Label htmlFor="manage-closes">Pendaftaran ditutup</Label><Input id="manage-closes" name="registration_closes_at" type="datetime-local" defaultValue={localDateTime(event.registration_closes_at,event.timezone)} required className={field} /></div><div><Label htmlFor="manage-timezone">Zona waktu</Label><Input id="manage-timezone" value={event.timezone} readOnly aria-readonly="true" className={`${field} bg-slate-50`} /></div>
          <div><Label htmlFor="manage-capacity">Kapasitas</Label><Input id="manage-capacity" name="capacity" type="number" min={1} max={100000} defaultValue={event.capacity} required className={field} /></div>{event.contribution_mode==='dynamic'&&<div><Label htmlFor="manage-timing">Waktu pembayaran</Label><select id="manage-timing" name="payment_timing" defaultValue={event.payment_timing} className={select}><option value="before_event">Sebelum event</option><option value="after_event">Setelah event</option></select></div>}
          {event.contribution_mode==='dynamic'&&<div><Label htmlFor="manage-cost">Perkiraan biaya total (Rp)</Label><Input id="manage-cost" name="estimated_total_cost" type="number" min={0} step={1000} defaultValue={roster.estimated_total_cost} required className={field} /></div>}<div><Label htmlFor="venue-status">Status venue</Label><select id="venue-status" name="venue_booking_status" defaultValue={(event as PublicEvent & { venue_booking_status?: string }).venue_booking_status ?? 'not_booked'} className={select}><option value="not_booked">Belum dipesan</option><option value="pending">Sedang diproses</option><option value="booked">Sudah dipesan</option><option value="cancelled">Dibatalkan</option></select></div>
          <div><Label htmlFor="manage-venue">Nama venue</Label><Input id="manage-venue" name="venue_name" defaultValue={event.venue.name === 'Venue belum ditentukan' ? '' : event.venue.name} maxLength={200} className={field} /></div><div><Label htmlFor="manage-address">Alamat</Label><Input id="manage-address" name="venue_address" defaultValue={event.venue.address} maxLength={1000} className={field} /></div>
          <div><Label htmlFor="manage-latitude">Latitude</Label><Input id="manage-latitude" name="latitude" type="number" inputMode="decimal" min={-90} max={90} step="any" defaultValue={event.venue.latitude} className={field} /></div><div><Label htmlFor="manage-longitude">Longitude</Label><Input id="manage-longitude" name="longitude" type="number" inputMode="decimal" min={-180} max={180} step="any" defaultValue={event.venue.longitude} className={field} /></div>
          <div className="sm:col-span-2"><Label htmlFor="manage-maps">Tautan Google Maps <span className="font-normal text-slate-500">(opsional jika koordinat diisi)</span></Label><Input id="manage-maps" name="maps_url" type="url" defaultValue={event.venue.maps_url} maxLength={2000} className={field} /></div>
          <div className="sm:col-span-2"><Label htmlFor="manage-meeting">Petunjuk bertemu</Label><textarea id="manage-meeting" name="meeting_instructions" maxLength={1000} rows={3} defaultValue={event.venue.meeting_instructions} className={`${select} py-3`} /></div>
        </div><Button type="submit" disabled={busy === 'planning'} className="mt-5 min-h-11 bg-emerald-700 text-white hover:bg-emerald-800">{busy === 'planning' ? 'Menyimpan…' : 'Simpan planning'}</Button></form>}
        {(roster.contributions_locked_at||event.contribution_mode==='legacy') && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="finance-summary-title"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="finance-summary-title" className="text-lg font-bold">Ringkasan iuran</h2><p className="mt-1 text-sm text-slate-600">Saldo dihitung dari tagihan, pembayaran terverifikasi, refund, dan penyesuaian.</p></div>{roster.summary.outstanding === 0 && <Badge variant="secondary"><Check aria-hidden="true" />Tidak ada tunggakan</Badge>}</div><dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3"><div><dt className="text-xs text-slate-500">Total tagihan</dt><dd className="mt-1 font-bold">{rupiah.format(roster.summary.charged)}</dd></div><div><dt className="text-xs text-slate-500">Diterima</dt><dd className="mt-1 font-bold text-emerald-800">{rupiah.format(roster.summary.received)}</dd></div><div><dt className="text-xs text-slate-500">Outstanding</dt><dd className="mt-1 font-bold text-rose-800">{rupiah.format(roster.summary.outstanding)}</dd></div><div><dt className="text-xs text-slate-500">Refund tercatat</dt><dd className="mt-1 font-bold">{rupiah.format(roster.summary.refunded)}</dd></div><div><dt className="text-xs text-slate-500">Penyesuaian</dt><dd className="mt-1 font-bold">{rupiah.format(roster.summary.adjustments)}</dd></div><div><dt className="text-xs text-slate-500">Kelebihan bayar</dt><dd className="mt-1 font-bold text-amber-800">{rupiah.format(roster.summary.credit)}</dd></div></dl></section>}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="roster-title"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="roster-title" className="text-lg font-bold">Daftar peserta</h2><p className="mt-1 text-sm text-slate-600">{event.contribution_mode==='legacy'?'Harga tetap ': 'Estimasi saat ini '}{roster.estimated_per_person == null ? 'belum tersedia' : rupiah.format(roster.estimated_per_person) + ' per orang'}.</p></div>{event.contribution_mode==='dynamic'&&(roster.contributions_locked_at ? <Badge><Check aria-hidden="true" />Iuran terkunci</Badge> : <Button type="button" variant="outline" disabled={busy === 'lock'} className="min-h-11" onClick={lockContributions}><LockKeyhole aria-hidden="true" />{busy === 'lock' ? 'Mengunci…' : 'Kunci iuran'}</Button>)}</div>
          {roster.participants.length === 0 ? <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Belum ada peserta.</p> : <ul className="mt-5 divide-y divide-slate-200">{roster.participants.map((participant) => <li key={participant.id} className="py-4 first:pt-0 last:pb-0"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{displayParticipantName(participant)}</p><p className="mt-1 text-xs text-slate-600">{participant.status} · {participant.chargeable ? 'masuk patungan' : 'tidak ditagih'}{participant.participant_charges[0] ? ` · tagihan ${rupiah.format(participant.participant_charges[0].amount)} · saldo ${rupiah.format(participant.participant_charges[0].balance)}` : ''}{participant.invoices?.[0]?` · invoice ${rupiah.format(participant.invoices[0].amount_due)} · ${participant.invoices[0].status}`:''}</p></div>{participant.is_guest && event.status !== 'cancelled' && <Button type="button" variant="ghost" disabled={busy === participant.id} className="min-h-11 justify-start sm:justify-center" onClick={() => recover(participant.id)}><RotateCcw aria-hidden="true" />{busy === participant.id ? 'Mengganti…' : 'Ganti tautan guest'}</Button>}</div>
            {['held','confirmed'].includes(participant.status) && event.status !== 'completed' && event.status !== 'cancelled' && <details className="mt-3 rounded-lg bg-slate-50 p-3"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Tindakan peserta</summary><div className="grid gap-4 pt-3 sm:grid-cols-2">
              {event.contribution_mode==='dynamic'&&roster.contributions_locked_at && participant.participant_charges.length === 0 && <form onSubmit={(event) => assignCharge(event, participant.id)} className="rounded-lg border border-slate-200 bg-white p-4"><Label htmlFor={`amount-${participant.id}`}>Tagihan late join (Rp)</Label><Input id={`amount-${participant.id}`} name="amount" type="number" min={0} step={1000} required className={field} /><Button type="submit" variant="outline" disabled={busy === `charge-${participant.id}`} className="mt-3 min-h-11">Tetapkan tagihan</Button></form>}
              <form onSubmit={(event) => cancelParticipant(event, participant.id)} className="rounded-lg border border-slate-200 bg-white p-4"><Label htmlFor={`policy-${participant.id}`}>Kebijakan pembatalan</Label><select id={`policy-${participant.id}`} name="policy" className={select}><option value="waive">Hapus tagihan</option><option value="retain">Pertahankan tagihan</option></select><Label htmlFor={`reason-${participant.id}`} className="mt-4">Alasan</Label><Input id={`reason-${participant.id}`} name="reason" required maxLength={1000} className={field} /><Button type="submit" variant="destructive" disabled={busy === `cancel-${participant.id}`} className="mt-3 min-h-11">Batalkan peserta</Button></form>
            </div></details>}
          </li>)}</ul>}
        </section>
      </div>
      <aside className="space-y-6">{event.status !== 'completed' && event.status !== 'cancelled' && <form onSubmit={addGuest} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="add-guest-title"><UserPlus className="size-6 text-emerald-700" aria-hidden="true" /><h2 id="add-guest-title" className="mt-3 text-lg font-bold">Tambahkan guest</h2><p className="mt-2 text-sm leading-relaxed text-slate-600">Dolend membuat tautan rahasia yang hanya ditampilkan sekali.</p><div className="mt-5"><Label htmlFor="guest-name">Nama peserta</Label><Input id="guest-name" name="display_name" required maxLength={120} className={field} /></div><div className="mt-4"><Label htmlFor="guest-whatsapp">Nomor WhatsApp</Label><Input id="guest-whatsapp" name="whatsapp" type="tel" inputMode="tel" required minLength={8} maxLength={32} className={field} placeholder="08…" /></div><Button type="submit" disabled={busy === 'guest'} className="mt-5 min-h-11 w-full bg-emerald-700 text-white hover:bg-emerald-800">{busy === 'guest' ? 'Menambahkan…' : 'Tambahkan peserta'}</Button></form>}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="share-event-title"><h2 id="share-event-title" className="text-lg font-bold">Bagikan event</h2><p className="mt-2 text-sm leading-relaxed text-slate-600">{event.visibility==='public'?'Tautan publik dapat dibuka siapa pun.':'Event hanya dapat dibuka memakai undangan aktif.'} WhatsApp hanya dibuka setelah kamu menekan tombol.</p>
          {event.visibility==='unlisted'&&event.status!=='completed'&&event.status!=='cancelled'&&<form className="mt-5" onSubmit={createInvite}><Label htmlFor="invite-expiry">Undangan berlaku sampai</Label><Input id="invite-expiry" name="expires_at" type="datetime-local" defaultValue={localDateTime(event.registration_closes_at,event.timezone)} max={localDateTime(event.ends_at,event.timezone)} required className={field}/><Button type="submit" disabled={busy==='invite'} className="mt-3 min-h-11 w-full">{busy==='invite'?'Membuat…':'Buat tautan undangan'}</Button></form>}
          {shareLink&&<div className="mt-5 rounded-lg bg-slate-50 p-4"><Label htmlFor="share-link">Tautan yang dibagikan</Label><Input id="share-link" readOnly value={shareLink} className={field}/><div className="mt-3 grid gap-2 sm:grid-cols-2"><Button type="button" variant="outline" className="min-h-11" onClick={()=>void navigator.clipboard.writeText(shareLink)}><Copy aria-hidden="true"/>Salin tautan</Button><Button asChild className="min-h-11 bg-emerald-700 text-white hover:bg-emerald-800"><a href={whatsAppShareUrl(eventShareText({title:event.title,startsAt:event.starts_at,timezone:event.timezone,venueName:event.venue.name,url:shareLink}))} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true"/>Bagikan via WhatsApp</a></Button></div></div>}
          {event.visibility==='unlisted'&&<div className="mt-5"><h3 className="text-sm font-bold">Riwayat undangan</h3>{invites.length===0?<p className="mt-2 text-sm text-slate-600">Belum ada undangan.</p>:<ul className="mt-2 space-y-2">{invites.map(invite=><li key={invite.id} className="rounded-lg border border-slate-200 p-3 text-xs"><p>{invite.revoked_at?'Dicabut':invite.expires_at&&Date.parse(invite.expires_at)<=loadedAt?'Kedaluwarsa':'Aktif'} · {invite.expires_at?`sampai ${new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:event.timezone}).format(new Date(invite.expires_at))}`:'tanpa batas'}</p>{!invite.revoked_at&&(!invite.expires_at||Date.parse(invite.expires_at)>loadedAt)&&<Button type="button" variant="ghost" className="mt-2 min-h-11 px-2 text-rose-800" disabled={busy===`invite-${invite.id}`} onClick={()=>void revokeInvite(invite.id)}>Cabut undangan</Button>}</li>)}</ul>}</div>}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold">Tahap event</h2><p className="mt-2 text-sm text-slate-600">{event.status === 'cancelled' ? 'Event sudah dibatalkan. Riwayat tetap tersedia untuk rekonsiliasi.' : event.status === 'completed' ? 'Event selesai. Periksa outstanding dan refund sebelum menutup administrasi.' : 'Konfirmasi saat waktu dan venue sudah siap. Tandai selesai setelah aktivitas berakhir.'}</p>{event.status !== 'completed' && event.status !== 'cancelled' && <div className="mt-5 grid gap-3">{event.status === 'recruiting' && <Button type="button" variant="outline" className="min-h-11" disabled={busy === 'confirmed'} onClick={() => changeStatus('confirmed')}>Konfirmasi event</Button>}<Button type="button" variant="outline" className="min-h-11" disabled={busy === 'completed'} onClick={() => changeStatus('completed')}>Tandai selesai</Button></div>}{event.status !== 'completed' && event.status !== 'cancelled' && <details className="mt-5 border-t border-slate-200 pt-4"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-rose-800">Batalkan event</summary><form onSubmit={cancelEvent} className="space-y-4 pt-3"><p className="text-xs leading-relaxed text-slate-600">Semua peserta aktif akan dibatalkan. Pilih apakah tagihan yang sudah dikunci tetap ditagih atau dihapus.</p><div><Label htmlFor="event-cancel-policy">Kebijakan tagihan</Label><select id="event-cancel-policy" name="policy" className={select}><option value="waive">Hapus sisa tagihan</option><option value="retain">Pertahankan tagihan</option></select></div><div><Label htmlFor="event-cancel-reason">Alasan pembatalan</Label><Input id="event-cancel-reason" name="reason" required maxLength={1000} className={field} /></div><Button type="submit" variant="destructive" disabled={busy === 'cancel-event'} className="min-h-11 w-full"><Ban aria-hidden="true" />{busy === 'cancel-event' ? 'Membatalkan…' : 'Batalkan event'}</Button></form></details>}</section>
      </aside>
    </div>
  </div>;
}

function NoticeBox({ notice }: { notice: Exclude<Notice, null> }) { return <p className={`rounded-xl border p-4 text-sm font-medium ${notice.kind === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>; }
