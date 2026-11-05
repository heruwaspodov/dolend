'use client';

import Link from 'next/link';
import { ArrowUpRight, CalendarDays, Plus } from 'lucide-react';
import { useOrganizerEvents } from '@/lib/use-organizer-events';
import { SessionGate } from '@/components/organizer/session-gate';

const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const statusLabel: Record<string, string> = { recruiting: 'Mencari peserta', confirmed: 'Terkonfirmasi', completed: 'Selesai', cancelled: 'Dibatalkan', published: 'Terbit' };
const statusStyle: Record<string, string> = {
  recruiting: 'bg-[#e8f3fd] text-[#005bab]',
  confirmed: 'bg-[#eaf6ed] text-[#236b34]',
  completed: 'bg-[#f0efed] text-[#4e4b48]',
  cancelled: 'bg-[#fff0ef] text-[#9a332c]',
  published: 'bg-[#e8f3fd] text-[#005bab]',
};

export function MyEvents() {
  const { session, ready, events, loading, error } = useOrganizerEvents();

  if (!session) return <SessionGate ready={ready} />;

  return <div className="space-y-7">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-semibold tracking-[0.12em] text-[#615d59]">MY EVENT</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.055em] text-[#171615] sm:text-[40px] sm:leading-[1.1]">Event yang kamu kelola</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#615d59]">Pantau jadwal, status, dan perkiraan biaya event kamu.</p></div>
      <Link href="/event/create/" className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-full bg-[#0075de] px-5 text-sm font-medium text-white transition-colors hover:bg-[#005bab] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0075de] sm:self-auto"><Plus aria-hidden="true" className="size-4" />Buat event</Link>
    </header>

    <section aria-label="Daftar event" className="overflow-hidden rounded-xl border border-[#e6e6e6] bg-white">
      {loading && <p className="p-6 text-sm text-[#615d59]" role="status">Memuat event…</p>}
      {error && <p className="p-6 text-sm text-[#8b2c25]" role="alert">{error}</p>}
      {!loading && !error && events.length === 0 && <div className="px-6 py-14 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-[#f2f7fc] text-[#0075de]"><CalendarDays aria-hidden="true" className="size-6" /></span>
        <h2 className="mt-5 text-lg font-semibold tracking-[-0.025em] text-[#171615]">Belum ada event</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#615d59]">Buat event pertama untuk mulai merencanakan aktivitas bersama.</p>
        <Link href="/event/create/" className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#0075de] px-5 text-sm font-medium text-white hover:bg-[#005bab] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0075de]"><Plus aria-hidden="true" className="size-4" />Buat event pertama</Link>
      </div>}
      {!loading && !error && events.length > 0 && <div className="overflow-x-auto" role="region" aria-label="Tabel event" tabIndex={0}>
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <caption className="sr-only">Daftar event yang kamu kelola</caption>
          <thead className="bg-[#faf9f8] text-xs font-semibold uppercase tracking-[0.08em] text-[#615d59]"><tr>
            <th scope="col" className="px-5 py-4">Event</th><th scope="col" className="px-5 py-4">Jadwal</th><th scope="col" className="px-5 py-4">Venue</th><th scope="col" className="px-5 py-4">Perkiraan biaya</th><th scope="col" className="px-5 py-4">Aksi</th>
          </tr></thead>
          <tbody className="divide-y divide-[#eeedeb]">{events.map((event) => <tr key={event.id} className="align-middle hover:bg-[#fcfbfa]">
            <th scope="row" className="max-w-[260px] px-5 py-4 font-medium text-[#211f1d]"><span className="block truncate">{event.title}</span><span className={`mt-1.5 inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-medium ${statusStyle[event.status] ?? 'bg-[#f0efed] text-[#4e4b48]'}`}>{statusLabel[event.status] ?? event.status}</span></th>
            <td className="whitespace-nowrap px-5 py-4 text-[#4e4b48]">{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: event.timezone }).format(new Date(event.starts_at))}</td>
            <td className="px-5 py-4 text-[#4e4b48]">{event.venue_booking_status === 'booked' ? 'Sudah dipesan' : 'Belum final'}</td>
            <td className="whitespace-nowrap px-5 py-4 text-[#4e4b48]">{rupiah.format(event.estimated_total_cost)}</td>
            <td className="px-5 py-4"><Link href={`/event/manage/?id=${event.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#e6e6e6] px-3 font-medium text-[#31302e] hover:border-[#0075de] hover:text-[#005bab] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0075de]">Kelola<ArrowUpRight aria-hidden="true" className="size-4" /></Link></td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  </div>;
}
