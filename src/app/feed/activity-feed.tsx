'use client';

import { SearchableSelect } from '@/components/ui/searchable-select';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { LoaderCircle, MessageCircleWarning, RefreshCw, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOrganizerSession } from '@/lib/use-organizer-session';
import { deleteActivity, editActivity, getActivityFeed, publishActivity, reportActivity, type Activity, type ActivityInput } from '@/lib/activity-client';
import { ActivityPhotoModeration, ActivityPhotoPanel } from './activity-photo-panel';

const visibilityLabel: Record<ActivityInput['visibility'], string> = { public: 'Publik', followers: 'Pengikut', community: 'Komunitas', private: 'Pribadi' };
const dateLabel = (value: string) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value));

export function ActivityFeed() {
  const { session, ready } = useOrganizerSession();
  const [items, setItems] = useState<Activity[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<ActivityInput['visibility']>('followers');
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const pendingKey = useRef<string | null>(null);

  const load = useCallback(async (next?: string) => {
    if (!session) return;
    setLoading(true); setError('');
    try {
      const page = await getActivityFeed(session.access_token, next);
      setItems((current) => next ? [...current, ...page.items.filter((item) => !current.some((old) => old.id === item.id))] : page.items);
      setCursor(page.next_cursor);
    } catch (cause) {
      if (!(cause instanceof Error && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : 'Aktivitas belum dapat dimuat.');
    } finally { setLoading(false); }
  }, [session]);

  useEffect(() => { if (session) void Promise.resolve().then(() => load()); }, [session, load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!session || !body.trim()) return;
    setBusy('submit'); setError(''); setMessage('');
    const input: ActivityInput = { body: body.trim(), visibility };
    try {
      if (editing) {
        const updated = await editActivity(session.access_token, editing, input);
        setItems((current) => current.map((item) => item.id === editing ? { ...item, ...updated } : item));
        setEditing(null);
      } else {
        pendingKey.current ??= crypto.randomUUID();
        const created = await publishActivity(session.access_token, pendingKey.current, input);
        setItems((current) => [{ ...created, is_own: true }, ...current.filter((item) => item.id !== created.id)]);
        pendingKey.current = null;
      }
      setBody(''); setMessage('Aktivitas tersimpan.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Aktivitas belum dapat disimpan.'); }
    finally { setBusy(''); }
  }

  function startEdit(item: Activity) { setEditing(item.id); setBody(item.body); setVisibility(item.visibility); setError(''); setMessage(''); }
  async function remove(item: Activity) {
    if (!session) return; setBusy(item.id); setError('');
    try { await deleteActivity(session.access_token, item.id); setItems((current) => current.filter((entry) => entry.id !== item.id)); setMessage('Aktivitas dihapus.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Aktivitas belum dapat dihapus.'); }
    finally { setBusy(''); }
  }
  async function report(item: Activity) {
    if (!session) return; setBusy(`report-${item.id}`); setError('');
    try { await reportActivity(session.access_token, item.id, 'other', ''); setMessage('Laporan diterima.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Laporan belum dapat dikirim.'); }
    finally { setBusy(''); }
  }

  if (!ready) return <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600" role="status">Memeriksa sesi…</p>;
  if (!session) return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h1 className="text-2xl font-extrabold">Aktivitas Dolend</h1><p className="mt-3 text-sm leading-relaxed text-slate-600">Masuk dengan Google untuk melihat aktivitas diri, teman, dan komunitas.</p><Button asChild className="mt-5 min-h-11 bg-emerald-700 text-white hover:bg-emerald-800"><Link href="/account/">Masuk dengan Google</Link></Button></section>;

  return <div className="mx-auto max-w-2xl space-y-5">
    <header><p className="text-xs font-bold tracking-widest text-emerald-700 uppercase">Jaringan aktivitas</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">Aktivitas</h1><p className="mt-2 text-sm text-slate-600">Kabar terbaru dari dirimu, teman, dan komunitas.</p></header>
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="composer-title">
      <h2 id="composer-title" className="font-bold">{editing ? 'Ubah aktivitas' : 'Bagikan aktivitas'}</h2>
      <label htmlFor="activity-body" className="sr-only">Tulis aktivitas</label>
      <textarea id="activity-body" value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} required rows={4} placeholder="Apa yang sedang kamu lakukan?" className="mt-3 min-h-28 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus-visible:border-emerald-700 focus-visible:ring-3 focus-visible:ring-emerald-700/20" />
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="text-sm font-medium" htmlFor="activity-visibility">Siapa yang bisa melihat?</label>
        <SearchableSelect id="activity-visibility" value={visibility} onValueChange={event => setVisibility(event as ActivityInput['visibility'])}>
          {(['public', 'followers', 'private'] as const).map((value) => <option key={value} value={value}>{visibilityLabel[value]}</option>)}
        </SearchableSelect>
      </div>
      <div className="mt-4 flex flex-wrap gap-2"><Button type="submit" disabled={busy === 'submit' || !body.trim()} className="min-h-11 bg-emerald-700 text-white hover:bg-emerald-800">{busy === 'submit' ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Send aria-hidden="true" />}{busy === 'submit' ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Bagikan'}</Button>{editing && <Button type="button" variant="outline" className="min-h-11" onClick={() => { setEditing(null); setBody(''); }}>Batal</Button>}</div>
    </form>
    <ActivityPhotoModeration token={session.access_token} />
    {(error || message) && <p role={error ? 'alert' : 'status'} className={`rounded-lg p-3 text-sm ${error ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>{error || message}</p>}
    {loading && items.length === 0 && <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600" role="status" aria-busy="true"><LoaderCircle className="mr-2 inline size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Memuat aktivitas…</p>}
    {!loading && !error && items.length === 0 && <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><h2 className="font-bold">Belum ada aktivitas</h2><p className="mt-2 text-sm text-slate-600">Aktivitasmu dan teman yang kamu ikuti akan muncul di sini.</p></section>}
    <div className="space-y-4" aria-live="polite">{items.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby={`activity-${item.id}`}>
      <header className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 id={`activity-${item.id}`} className="font-bold">{item.is_own ? 'Kamu' : item.author_name ?? 'Pengguna Dolend'}</h2><p className="mt-1 text-xs text-slate-500">{dateLabel(item.created_at)} · {visibilityLabel[item.visibility]}</p></div>{item.is_own && <div className="flex shrink-0 gap-1"><Button type="button" variant="ghost" className="min-h-11 px-2" aria-label="Ubah aktivitas" onClick={() => startEdit(item)}>Ubah</Button><Button type="button" variant="ghost" className="min-h-11 px-2 text-rose-700" aria-label="Hapus aktivitas" disabled={busy === item.id} onClick={() => void remove(item)}><Trash2 aria-hidden="true" /><span className="sr-only">Hapus</span></Button></div>}</header>
      <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed">{item.body}</p>
      <ActivityPhotoPanel key={`${item.id}:${item.visibility}`} token={session.access_token} activityId={item.id} isOwn={Boolean(item.is_own)} />
      {(item.source_event_title || item.community_name) && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Sumber: {item.source_event_title ? `Event ${item.source_event_title}` : `Komunitas ${item.community_name}`}</p>}
      {!item.is_own && <Button type="button" variant="ghost" className="mt-3 min-h-11 px-2 text-slate-600" disabled={busy === `report-${item.id}`} onClick={() => void report(item)}><MessageCircleWarning aria-hidden="true" />Laporkan</Button>}
    </article>)}</div>
    {error && items.length > 0 && <Button type="button" variant="outline" className="min-h-11" onClick={() => void load()}><RefreshCw aria-hidden="true" />Coba muat ulang</Button>}
    {cursor && <Button type="button" variant="outline" disabled={loading} className="min-h-11 w-full" onClick={() => void load(cursor)}>{loading ? 'Memuat…' : 'Muat aktivitas sebelumnya'}</Button>}
  </div>;
}
