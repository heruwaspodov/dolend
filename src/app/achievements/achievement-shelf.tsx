'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { LoaderCircle, RefreshCw, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOrganizerSession } from '@/lib/use-organizer-session';
import { getProfileAchievements, type Achievement } from '@/lib/challenge-client';
import { getOwnProfile } from '@/lib/profile-client';

export function AchievementShelf() {
  const { session, ready } = useOrganizerSession();
  const [items, setItems] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true); setError('');
    try {
      const profile = await getOwnProfile(session.access_token);
      setItems(await getProfileAchievements(session.access_token, profile.id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Pencapaian belum dapat dimuat.'); }
    finally { setLoading(false); }
  }, [session]);
  useEffect(() => { if (session) void Promise.resolve().then(load); }, [session, load]);

  if (!ready) return <p role="status" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Memeriksa sesi…</p>;
  if (!session) return <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6"><h1 className="text-2xl font-bold">Pencapaian</h1><p className="mt-2 text-sm text-slate-600">Masuk dengan akun Google untuk melihat lencana pribadimu.</p></section>;

  return <section className="mx-auto max-w-3xl space-y-5 py-6">
    <header><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Lencana terverifikasi</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">Pencapaian</h1><p className="mt-2 text-sm text-slate-600">Lencana dihitung dari kehadiran pada event selesai yang dicatat organizer.</p><Link href="/challenges/" className="mt-3 inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-emerald-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-emerald-700">Lihat challenges</Link></header>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {loading && items.length===0 && <p role="status" aria-busy="true" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600"><LoaderCircle className="mr-2 inline size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Memuat pencapaian…</p>}
    {!loading && !error && items.length===0 && <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><Trophy className="mx-auto size-8 text-emerald-700" aria-hidden="true" /><h2 className="mt-3 font-bold">Belum ada pencapaian</h2><p className="mt-2 text-sm text-slate-600">Lencana akan muncul setelah kamu memenuhi aturan kehadiran yang berlaku.</p></section>}
    <div className="grid gap-3 sm:grid-cols-2">{items.map((item) => <article key={`${item.code}-${item.rule_version}`} className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm"><Trophy className="size-6 text-emerald-700" aria-hidden="true" /><h2 className="mt-3 font-bold">{item.title}</h2><p className="mt-1 text-sm text-slate-600">{item.description}</p><p className="mt-3 text-xs text-slate-500">Aturan v{item.rule_version} · Diberikan {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(item.awarded_at))}</p></article>)}</div>
    {error && <Button type="button" variant="outline" className="min-h-11" onClick={() => void load()}><RefreshCw aria-hidden="true" />Coba lagi</Button>}
  </section>;
}
