'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { LoaderCircle, RefreshCw, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOrganizerSession } from '@/lib/use-organizer-session';
import { createChallenge, getChallenges, joinChallenge, leaveChallenge, type Challenge } from '@/lib/challenge-client';

const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta';
const dateInZone = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone() }).format(date);
const today = () => dateInZone(new Date());
const plusDays = (days: number) => dateInZone(new Date(Date.now() + days * 86400000));

export function ChallengeHub() {
  const { session, ready } = useOrganizerSession();
  const [items, setItems] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [target, setTarget] = useState('3');
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState(() => plusDays(7));

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true); setError('');
    try { setItems(await getChallenges(session.access_token)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Challenge belum dapat dimuat.'); }
    finally { setLoading(false); }
  }, [session]);
  useEffect(() => { if (session) void Promise.resolve().then(load); }, [session, load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!session) return;
    setBusy('create'); setError(''); setMessage('');
    try {
      await createChallenge(session.access_token, { title: title.trim(), description: description.trim(), target: Number(target), starts_on: startsOn, ends_on: endsOn, timezone: timezone() });
      setTitle(''); setDescription(''); setMessage('Challenge dibuat.'); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Challenge belum dapat dibuat.'); }
    finally { setBusy(''); }
  }

  async function toggle(item: Challenge) {
    if (!session) return;
    setBusy(item.id); setError(''); setMessage('');
    try {
      if (item.joined) await leaveChallenge(session.access_token, item.id);
      else await joinChallenge(session.access_token, item.id);
      setMessage(item.joined ? 'Kamu keluar dari challenge.' : 'Kamu bergabung ke challenge.'); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Keanggotaan belum dapat diperbarui.'); }
    finally { setBusy(''); }
  }

  if (!ready) return <p role="status" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Memeriksa sesi…</p>;
  if (!session) return <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6"><h1 className="text-2xl font-bold">Challenges</h1><p className="mt-2 text-sm text-slate-600">Masuk dengan akun Google untuk mengikuti dan membuat challenge.</p></section>;

  return <section className="mx-auto max-w-3xl space-y-6 py-6">
    <header><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Aktivitas terverifikasi</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">Challenges</h1><p className="mt-2 text-sm text-slate-600">Progres dihitung dari kehadiran event yang dicatat organizer. Periode mengikuti zona waktu yang dipilih pembuat.</p></header>
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="challenge-form-title">
      <h2 id="challenge-form-title" className="font-bold">Buat challenge</h2>
      <label className="block text-sm font-medium" htmlFor="challenge-title">Nama</label>
      <input id="challenge-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus-visible:outline-2 focus-visible:outline-emerald-700" />
      <label className="block text-sm font-medium" htmlFor="challenge-description">Deskripsi</label>
      <textarea id="challenge-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-emerald-700" />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-medium">Target kehadiran<input aria-label="Target kehadiran" type="number" min={1} max={10000} value={target} onChange={(event) => setTarget(event.target.value)} required className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label>
        <label className="text-sm font-medium">Mulai<input aria-label="Tanggal mulai" type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} required className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label>
        <label className="text-sm font-medium">Selesai<input aria-label="Tanggal selesai" type="date" min={startsOn} value={endsOn} onChange={(event) => setEndsOn(event.target.value)} required className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label>
      </div>
      <p className="text-xs text-slate-600">Zona waktu: {timezone()}. Maksimum periode 366 hari.</p>
      <Button type="submit" disabled={busy === 'create'} className="min-h-11 bg-emerald-700 text-white hover:bg-emerald-800">{busy === 'create' ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Trophy aria-hidden="true" />} Buat challenge</Button>
    </form>
    {(error || message) && <p role={error ? 'alert' : 'status'} className={`rounded-lg p-3 text-sm ${error ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>{error || message}</p>}
    {loading && items.length===0 && <p role="status" aria-busy="true" className="rounded-xl border bg-white p-5 text-sm text-slate-600"><LoaderCircle className="mr-2 inline size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Memuat challenge…</p>}
    {!loading && !error && items.length===0 && <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><h2 className="font-bold">Belum ada challenge terbuka</h2><p className="mt-2 text-sm text-slate-600">Challenge baru akan muncul setelah dibuat.</p></section>}
    <div className="space-y-3">{items.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">{item.title}</h2><p className="mt-1 text-xs text-slate-500">{item.starts_on} – {item.ends_on} · {item.timezone}</p></div><Button type="button" variant={item.joined ? 'outline' : 'default'} disabled={busy===item.id} className="min-h-11" onClick={() => void toggle(item)}>{busy===item.id ? 'Menyimpan…' : item.joined ? 'Keluar' : 'Ikuti'}</Button></div><p className="mt-3 text-sm text-slate-700">{item.description || 'Tantangan kehadiran event terverifikasi.'}</p>{item.joined && <p className="mt-3 text-sm font-medium text-emerald-800">Progres: {item.progress ?? 0} / {item.target} kehadiran{item.completed_at ? ' · target tercapai' : ''}</p>}</article>)}</div>
    {error && items.length>0 && <Button type="button" variant="outline" className="min-h-11" onClick={() => void load()}><RefreshCw aria-hidden="true" />Coba muat ulang</Button>}
  </section>;
}
