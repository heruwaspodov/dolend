'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { CalendarDays, Clock3, UsersRound } from 'lucide-react';
import { useOrganizerEvents } from '@/lib/use-organizer-events';
import { SessionGate } from './session-gate';

function Metric({ label, value, detail, icon: Icon }: { label: string; value: number | string; detail: string; icon: typeof CalendarDays }) {
  return <article className="rounded-xl border border-[#e6e6e6] bg-white p-5 sm:p-6">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-sm text-[#615d59]">{label}</p><p className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-[#171615]">{value}</p></div>
      <span className="grid size-10 place-items-center rounded-lg bg-[#f2f7fc] text-[#0075de]"><Icon aria-hidden="true" className="size-5" /></span>
    </div>
    <p className="mt-4 text-xs text-[#77736f]">{detail}</p>
  </article>;
}

export function OrganizerDashboard() {
  const { session, ready, events, loading, error } = useOrganizerEvents();
  const activeCount = useMemo(() => events.filter((event) => ['recruiting', 'confirmed', 'published'].includes(event.status)).length, [events]);
  const completedCount = useMemo(() => events.filter((event) => event.status === 'completed').length, [events]);
  const firstName = typeof session?.user.user_metadata?.full_name === 'string' ? session.user.user_metadata.full_name.trim().split(/\s+/)[0] : '';

  if (!session) return <SessionGate ready={ready} />;

  return <div className="space-y-8 sm:space-y-10">
    <header>
      <p className="text-xs font-semibold tracking-[0.12em] text-[#615d59]">RINGKASAN</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.055em] text-[#171615] sm:text-[40px] sm:leading-[1.1]">Selamat datang{firstName ? `, ${firstName}` : ''}</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-[#615d59] sm:text-base">Ringkasan event yang kamu kelola di Dolend.</p>
    </header>

    <section aria-label="Ringkasan event" className="grid gap-3 sm:grid-cols-3 sm:gap-4">
      <Metric label="Semua event" value={loading ? '—' : events.length} detail="Event yang kamu kelola" icon={CalendarDays} />
      <Metric label="Event aktif" value={loading ? '—' : activeCount} detail="Mencari peserta atau terkonfirmasi" icon={Clock3} />
      <Metric label="Event selesai" value={loading ? '—' : completedCount} detail="Aktivitas yang sudah berlangsung" icon={UsersRound} />
    </section>

    {error && <div className="rounded-xl border border-[#f0cbc8] bg-[#fff8f7] p-5 text-sm text-[#8b2c25]" role="alert">{error}</div>}
    <section className="rounded-xl border border-[#e6e6e6] bg-white p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-xl font-semibold tracking-[-0.035em] text-[#171615]">Kelola event kamu</h2><p className="mt-1 text-sm text-[#6b6763]">Lihat jadwal dan status semua event dalam satu tabel.</p></div>
        <Link href="/dashboard/events/" className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#0075de] px-5 text-sm font-medium text-white transition-colors hover:bg-[#005bab] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0075de]">Buka My Event</Link>
      </div>
    </section>
  </div>;
}
