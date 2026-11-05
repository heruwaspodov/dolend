'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useOrganizerSession } from '@/lib/use-organizer-session';
import { getMyStats, rebuildMyStats, type ProfileStats } from '@/lib/stats-client';

export function StatsPanel() {
  const { session, ready } = useOrganizerSession();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!session) return;
    setBusy(true); setError('');
    try { await rebuildMyStats(session.access_token); setStats(await getMyStats(session.access_token)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Statistik belum dapat dimuat.'); }
    finally { setBusy(false); }
  }, [session]);
  useEffect(() => { if (session) void Promise.resolve().then(load); }, [session, load]);

  if (!ready) return <p role="status" className="mt-6 rounded-xl border bg-white p-5 text-sm text-slate-600">Memeriksa sesi…</p>;
  if (!session) return <section className="mt-6 rounded-2xl border bg-white p-6"><h1 className="text-2xl font-extrabold">Statistik aktivitas</h1><p className="mt-3 text-sm text-slate-600">Masuk dengan Google untuk melihat statistik akunmu.</p><Button asChild className="mt-5 min-h-11 bg-emerald-700 text-white"><Link href="/account/">Masuk dengan Google</Link></Button></section>;
  return <section className="mx-auto mt-6 max-w-3xl space-y-5">
    <header><p className="text-xs font-bold tracking-widest text-emerald-700 uppercase">Ringkasan pribadi</p><h1 className="mt-2 text-3xl font-extrabold">Statistik aktivitas</h1><p className="mt-2 text-sm text-slate-600">Ringkasan 7 hari dalam zona waktu profilmu. Statistik hanya terlihat olehmu.</p></header>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {busy && <p role="status" aria-busy="true" className="rounded-xl border bg-white p-5 text-sm text-slate-600">Menghitung ulang dari catatan sumber…</p>}
    {!busy && stats && <>
      <p className="text-xs text-slate-500">{stats.period_start} · {stats.period_days} hari · {stats.timezone}</p>
      <div className="grid gap-3 sm:grid-cols-2">{stats.metrics.map((metric) => <article key={`${metric.metric_key}:${metric.rule_version}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-600">{metric.label}</p><p className="mt-2 text-4xl font-extrabold tabular-nums">{metric.metric_value}</p><p className="mt-3 text-xs text-slate-500">{metric.source_kind === 'verified' ? 'Terverifikasi dari kehadiran event' : 'Dihitung dari aktivitas yang kamu bagikan'} · aturan v{metric.rule_version}</p></article>)}</div>
      {stats.metrics.length === 0 && <p className="rounded-xl border border-dashed bg-white p-5 text-sm text-slate-600">Belum ada data statistik untuk periode ini.</p>}
      <p className="text-xs leading-relaxed text-slate-500">Angka terverifikasi berasal dari catatan kehadiran. Aktivitas yang dibagikan adalah catatan sosial, bukan pengukuran olahraga. Jarak dan kalori tidak dihitung tanpa data pendukung.</p>
    </>}
    <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => void load()}>Hitung ulang</Button>
  </section>;
}
