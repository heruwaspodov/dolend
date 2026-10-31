'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CalendarDays, MapPin, Plus, UsersRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { organizerRequest, type OrganizerEvent } from '@/lib/organizer-client';
import { useOrganizerSession } from '@/lib/use-organizer-session';
import { SessionGate } from './session-gate';

const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
const statusLabel: Record<string, string> = { recruiting: 'Mencari peserta', confirmed: 'Terkonfirmasi', completed: 'Selesai', cancelled: 'Dibatalkan', published: 'Terbit' };

export function OrganizerDashboard() {
  const { session, ready } = useOrganizerSession();
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    void organizerRequest<OrganizerEvent[]>('/organizer/events', session.access_token, { signal: controller.signal })
      .then(setEvents)
      .catch((reason) => { if (reason.name !== 'AbortError') setError(reason.message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [session]);

  if (!session) return <SessionGate ready={ready} />;
  return <div className="space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold tracking-widest text-emerald-700 uppercase">Ruang organizer</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">Event kamu</h1><p className="mt-2 text-sm text-slate-600">Buat rencana, pantau peserta, lalu kunci patungan saat daftar sudah siap.</p></div>
      <Button asChild className="min-h-11 bg-emerald-700 px-5 text-white hover:bg-emerald-800"><Link href="/event/create/"><Plus aria-hidden="true" />Buat event</Link></Button>
    </header>
    {loading && <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600" role="status">Memuat event…</p>}
    {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm font-medium text-rose-800" role="alert">{error}</p>}
    {!loading && !error && events.length === 0 && <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <UsersRound className="mx-auto size-8 text-emerald-700" aria-hidden="true" /><h2 className="mt-4 text-lg font-bold">Belum ada event yang dikelola</h2><p className="mx-auto mt-2 max-w-md text-sm text-slate-600">Mulai dari waktu dan perkiraan biaya. Venue boleh ditentukan belakangan.</p><Button asChild variant="outline" className="mt-5 min-h-11"><Link href="/event/create/">Buat event pertama</Link></Button>
    </section>}
    {!loading && !error && events.length > 0 && <ul className="grid gap-4 md:grid-cols-2">{events.map((event) => <li key={event.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="text-lg font-bold leading-snug">{event.title}</h2><Badge variant="secondary">{statusLabel[event.status] ?? event.status}</Badge></div>
      <div className="mt-4 space-y-2 text-sm text-slate-600"><p className="flex items-start gap-2"><CalendarDays className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" /><span>{date.format(new Date(event.starts_at))}</span></p><p className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" /><span>{event.venue_booking_status === 'booked' ? 'Venue sudah dipesan' : 'Venue belum final'}</span></p><p>Perkiraan biaya {rupiah.format(event.estimated_total_cost)}</p></div>
      <Button asChild variant="outline" className="mt-5 min-h-11 w-full"><Link href={`/event/manage/?id=${event.id}`}>Kelola event</Link></Button>
    </li>)}</ul>}
  </div>;
}
