'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, Copy, LockKeyhole, RotateCcw, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { displayParticipantName, organizerRequest, type EventRoster } from '@/lib/organizer-client';
import { isUuid, type PublicEvent } from '@/lib/event-client';
import { useOrganizerSession } from '@/lib/use-organizer-session';
import { SessionGate } from './session-gate';

const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const field = 'mt-2 min-h-11 border-slate-300 bg-white';
const select = `${field} w-full rounded-lg border px-3 text-sm outline-none focus-visible:border-emerald-700 focus-visible:ring-3 focus-visible:ring-emerald-700/20`;
type Notice = { kind: 'success' | 'error'; text: string } | null;

export function EventManager() {
  const eventId = useSearchParams().get('id') ?? '';
  const { session, ready } = useOrganizerSession();
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [roster, setRoster] = useState<EventRoster | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [bookingLink, setBookingLink] = useState('');

  const load = useCallback(async (token: string) => {
    setLoading(true);
    try {
      const [nextEvent, nextRoster] = await Promise.all([
        organizerRequest<PublicEvent>(`/events/${eventId}`, token),
        organizerRequest<EventRoster>(`/events/${eventId}/roster`, token),
      ]);
      setEvent(nextEvent); setRoster(nextRoster);
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
    formEvent.preventDefault(); if (!session) return;
    setBusy('planning'); setNotice(null);
    const form = new FormData(formEvent.currentTarget);
    try {
      await organizerRequest(`/events/${eventId}/planning`, session.access_token, { method: 'PATCH', body: JSON.stringify({
        estimated_total_cost: Number(form.get('estimated_total_cost')), venue_booking_status: form.get('venue_booking_status'),
        venue_snapshot: { name: form.get('venue_name'), address: form.get('venue_address'), maps_url: form.get('maps_url') },
      }) });
      setNotice({ kind: 'success', text: 'Rencana event berhasil diperbarui.' }); await load(session.access_token);
    } catch (reason) { setNotice({ kind: 'error', text: reason instanceof Error ? reason.message : 'Rencana belum dapat disimpan.' }); }
    finally { setBusy(''); }
  }

  async function changeStatus(status: 'confirmed' | 'completed') {
    if (!session) return; setBusy(status); setNotice(null);
    try { await organizerRequest(`/events/${eventId}/planning`, session.access_token, { method: 'PATCH', body: JSON.stringify({ status }) }); setNotice({ kind: 'success', text: status === 'confirmed' ? 'Event sudah dikonfirmasi.' : 'Event ditandai selesai.' }); await load(session.access_token); }
    catch (reason) { setNotice({ kind: 'error', text: reason instanceof Error ? reason.message : 'Status belum dapat diperbarui.' }); }
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

  if (!session) return <SessionGate ready={ready} />;
  if (!eventId || !isUuid(eventId)) return <p className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800" role="alert">Tautan kelola event tidak valid.</p>;
  if (loading) return <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600" role="status">Memuat ruang kelola…</p>;
  if (!event || !roster) return <>{notice && <NoticeBox notice={notice} />}</>;

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold tracking-widest text-emerald-700 uppercase">Kelola event</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">{event.title}</h1><p className="mt-2 text-sm text-slate-600">{event.participants_count} dari {event.capacity} tempat terisi</p></div><Button asChild variant="outline" className="min-h-11"><Link href={`/event/?id=${eventId}`}>Lihat halaman peserta</Link></Button></header>
    {notice && <NoticeBox notice={notice} />}
    {bookingLink && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4" aria-labelledby="booking-link-title"><h2 id="booking-link-title" className="font-bold text-amber-950">Tautan booking rahasia</h2><p className="mt-2 break-all text-xs leading-relaxed text-amber-950">{bookingLink}</p><Button type="button" variant="outline" className="mt-3 min-h-11 bg-white" onClick={() => void navigator.clipboard.writeText(bookingLink)}><Copy aria-hidden="true" />Salin tautan</Button></section>}
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <form onSubmit={updatePlanning} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="planning-title"><h2 id="planning-title" className="text-lg font-bold">Planning</h2><div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div><Label htmlFor="manage-cost">Perkiraan biaya total (Rp)</Label><Input id="manage-cost" name="estimated_total_cost" type="number" min={0} step={1000} defaultValue={roster.estimated_total_cost} required className={field} /></div><div><Label htmlFor="venue-status">Status venue</Label><select id="venue-status" name="venue_booking_status" defaultValue={(event as PublicEvent & { venue_booking_status?: string }).venue_booking_status ?? 'not_booked'} className={select}><option value="not_booked">Belum dipesan</option><option value="pending">Sedang diproses</option><option value="booked">Sudah dipesan</option><option value="cancelled">Dibatalkan</option></select></div>
          <div><Label htmlFor="manage-venue">Nama venue</Label><Input id="manage-venue" name="venue_name" defaultValue={event.venue.name === 'Venue belum ditentukan' ? '' : event.venue.name} maxLength={200} className={field} /></div><div><Label htmlFor="manage-address">Alamat</Label><Input id="manage-address" name="venue_address" defaultValue={event.venue.address} maxLength={1000} className={field} /></div><div className="sm:col-span-2"><Label htmlFor="manage-maps">Tautan Google Maps</Label><Input id="manage-maps" name="maps_url" type="url" defaultValue={event.venue.maps_url} maxLength={2000} className={field} /></div>
        </div><Button type="submit" disabled={busy === 'planning'} className="mt-5 min-h-11 bg-emerald-700 text-white hover:bg-emerald-800">{busy === 'planning' ? 'Menyimpan…' : 'Simpan planning'}</Button></form>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="roster-title"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="roster-title" className="text-lg font-bold">Daftar peserta</h2><p className="mt-1 text-sm text-slate-600">Estimasi saat ini {roster.estimated_per_person == null ? 'belum tersedia' : rupiah.format(roster.estimated_per_person) + ' per orang'}.</p></div>{roster.contributions_locked_at ? <Badge><Check aria-hidden="true" />Iuran terkunci</Badge> : <Button type="button" variant="outline" disabled={busy === 'lock'} className="min-h-11" onClick={lockContributions}><LockKeyhole aria-hidden="true" />{busy === 'lock' ? 'Mengunci…' : 'Kunci iuran'}</Button>}</div>
          {roster.participants.length === 0 ? <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Belum ada peserta.</p> : <ul className="mt-5 divide-y divide-slate-200">{roster.participants.map((participant) => <li key={participant.id} className="py-4 first:pt-0 last:pb-0"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{displayParticipantName(participant)}</p><p className="mt-1 text-xs text-slate-600">{participant.status} · {participant.chargeable ? 'masuk patungan' : 'tidak ditagih'}{participant.participant_charges[0] ? ` · ${rupiah.format(participant.participant_charges[0].amount)}` : ''}</p></div>{participant.is_guest && <Button type="button" variant="ghost" disabled={busy === participant.id} className="min-h-11 justify-start sm:justify-center" onClick={() => recover(participant.id)}><RotateCcw aria-hidden="true" />{busy === participant.id ? 'Mengganti…' : 'Ganti tautan guest'}</Button>}</div>
            {participant.status === 'confirmed' && <details className="mt-3 rounded-lg bg-slate-50 p-3"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Tindakan peserta</summary><div className="grid gap-4 pt-3 sm:grid-cols-2">
              {roster.contributions_locked_at && participant.participant_charges.length === 0 && <form onSubmit={(event) => assignCharge(event, participant.id)} className="rounded-lg border border-slate-200 bg-white p-4"><Label htmlFor={`amount-${participant.id}`}>Tagihan late join (Rp)</Label><Input id={`amount-${participant.id}`} name="amount" type="number" min={0} step={1000} required className={field} /><Button type="submit" variant="outline" disabled={busy === `charge-${participant.id}`} className="mt-3 min-h-11">Tetapkan tagihan</Button></form>}
              <form onSubmit={(event) => cancelParticipant(event, participant.id)} className="rounded-lg border border-slate-200 bg-white p-4"><Label htmlFor={`policy-${participant.id}`}>Kebijakan pembatalan</Label><select id={`policy-${participant.id}`} name="policy" className={select}><option value="waive">Hapus tagihan</option><option value="retain">Pertahankan tagihan</option></select><Label htmlFor={`reason-${participant.id}`} className="mt-4">Alasan</Label><Input id={`reason-${participant.id}`} name="reason" required maxLength={1000} className={field} /><Button type="submit" variant="destructive" disabled={busy === `cancel-${participant.id}`} className="mt-3 min-h-11">Batalkan peserta</Button></form>
            </div></details>}
          </li>)}</ul>}
        </section>
      </div>
      <aside className="space-y-6"><form onSubmit={addGuest} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="add-guest-title"><UserPlus className="size-6 text-emerald-700" aria-hidden="true" /><h2 id="add-guest-title" className="mt-3 text-lg font-bold">Tambahkan guest</h2><p className="mt-2 text-sm leading-relaxed text-slate-600">Dolend membuat tautan rahasia yang hanya ditampilkan sekali.</p><div className="mt-5"><Label htmlFor="guest-name">Nama peserta</Label><Input id="guest-name" name="display_name" required maxLength={120} className={field} /></div><div className="mt-4"><Label htmlFor="guest-whatsapp">Nomor WhatsApp</Label><Input id="guest-whatsapp" name="whatsapp" type="tel" inputMode="tel" required minLength={8} maxLength={32} className={field} placeholder="08…" /></div><Button type="submit" disabled={busy === 'guest'} className="mt-5 min-h-11 w-full bg-emerald-700 text-white hover:bg-emerald-800">{busy === 'guest' ? 'Menambahkan…' : 'Tambahkan peserta'}</Button></form>
        <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold">Tahap event</h2><p className="mt-2 text-sm text-slate-600">Konfirmasi saat waktu dan venue sudah siap. Tandai selesai setelah aktivitas berakhir.</p><div className="mt-5 grid gap-3"><Button type="button" variant="outline" className="min-h-11" disabled={busy === 'confirmed'} onClick={() => changeStatus('confirmed')}>Konfirmasi event</Button><Button type="button" variant="outline" className="min-h-11" disabled={busy === 'completed'} onClick={() => changeStatus('completed')}>Tandai selesai</Button></div></section>
      </aside>
    </div>
  </div>;
}

function NoticeBox({ notice }: { notice: Exclude<Notice, null> }) { return <p className={`rounded-xl border p-4 text-sm font-medium ${notice.kind === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>; }
