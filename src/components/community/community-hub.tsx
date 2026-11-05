'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

type Community = { id: string; slug: string; name: string; description: string; visibility: 'public' | 'private'; member_count?: number; membership_status?: string | null; role?: 'owner' | 'admin' | 'member' | null; members?: { profile_id: string; role: string }[]; requests?: { profile_id: string; status: string }[]; events?: { id: string; title: string; starts_at: string; status: string }[] };
const apiBase = () => process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
const publicKey = () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function CommunityHub() {
  const search = useSearchParams();
  const slug = search.get('slug');
  const [communities, setCommunities] = useState<Community[]>([]);
  const [community, setCommunity] = useState<Community | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const request = useCallback(async <T,>(path: string, method = 'GET', body?: unknown): Promise<T> => {
    const base = apiBase();
    const key = publicKey();
    if (!base || !key) throw new Error('Konfigurasi API belum tersedia.');
    const response = await fetch(`${base}/dolend-api/v1/communities${path}`, {
      method, cache: 'no-store',
      headers: { apikey: key, ...(sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error?.message ?? 'Komunitas belum dapat diakses.');
    return result?.data as T;
  }, [sessionToken]);

  const reload = useCallback(async () => {
    setReady(false); setMessage('');
    try {
      const [list, detail] = await Promise.all([
        request<Community[]>('/'),
        slug ? request<Community>(`/${encodeURIComponent(slug)}`) : Promise.resolve(null),
      ]);
      setCommunities(Array.isArray(list) ? list : []);
      setCommunity(detail);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Komunitas belum dapat diakses.'); }
    finally { setReady(true); }
  }, [request, slug]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data }) => setSessionToken(data.session?.access_token ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSessionToken(session?.access_token ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    const task = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(task);
  }, [reload]);

  async function act(path: string, method: string, body?: unknown) {
    setBusy(true); setMessage('');
    try { await request(path, method, body); setMessage('Perubahan komunitas tersimpan.'); await reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Perubahan belum dapat disimpan.'); }
    finally { setBusy(false); }
  }

  async function create(form: FormData) {
    const name = String(form.get('name') ?? '').trim();
    const slugValue = String(form.get('slug') ?? '').trim().toLowerCase();
    await act('', 'POST', { name, slug: slugValue, description: String(form.get('description') ?? ''), visibility: String(form.get('visibility') ?? 'public') });
    if (slugValue) window.history.pushState({}, '', `/communities/?slug=${encodeURIComponent(slugValue)}`);
  }

  return <div className="space-y-8">
    <header>
      <p className="text-sm font-semibold text-emerald-700">Ruang aktivitas bersama</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Komunitas</h1>
      <p className="mt-3 max-w-2xl text-slate-600">Temukan komunitas, ajukan bergabung, dan lihat event yang dibagikan komunitas.</p>
    </header>
    {message && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="status">{message}</p>}
    {!ready ? <p role="status">Memuat komunitas…</p> : slug ? <section className="space-y-5" aria-labelledby="community-detail-title">
      {!community ? <div className="rounded-xl border p-5"><h2 className="font-bold">Komunitas tidak tersedia</h2><p className="mt-2 text-sm text-slate-600">Komunitas privat hanya tampil bagi anggota aktif.</p><Button asChild variant="outline" className="mt-4 min-h-11"><Link href="/communities/">Kembali ke komunitas</Link></Button></div> : <>
        <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">{community.visibility === 'private' ? 'Komunitas privat' : 'Komunitas publik'} · {community.member_count ?? community.members?.length ?? 0} anggota</p>
          <h2 id="community-detail-title" className="mt-2 text-2xl font-bold">{community.name}</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{community.description || 'Belum ada deskripsi.'}</p>
          {community.role ? <p className="mt-4 text-sm font-semibold">Peran kamu: {community.role === 'owner' ? 'Pemilik' : community.role === 'admin' ? 'Admin' : 'Anggota'}</p> : community.membership_status === 'pending' ? <p className="mt-4 text-sm">Permintaan bergabung menunggu persetujuan.</p> : community.membership_status === 'invited' ? <div className="mt-4 flex flex-wrap gap-2"><Button disabled={busy} className="min-h-11" onClick={() => void act(`/${community.id}/invites/respond`, 'POST', { accept: true })}>Terima undangan</Button><Button disabled={busy} variant="outline" className="min-h-11" onClick={() => void act(`/${community.id}/invites/respond`, 'POST', { accept: false })}>Tolak</Button></div> : <Button disabled={!sessionToken || busy} className="mt-4 min-h-11" onClick={() => void act(`/${community.id}/join`, 'POST')}>{sessionToken ? community.visibility === 'private' ? 'Ajukan bergabung' : 'Gabung komunitas' : 'Masuk untuk bergabung'}</Button>}
          {(community.role === 'owner' || community.role === 'admin') && <div className="mt-6 border-t pt-5"><h3 className="font-bold">Permintaan bergabung</h3>{community.requests?.filter(item => item.status === 'pending').length ? <ul className="mt-3 space-y-2">{community.requests.filter(item => item.status === 'pending').map(item => <li key={item.profile_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3"><span className="text-xs">Profil {item.profile_id}</span><Button className="min-h-11" disabled={busy} onClick={() => void act(`/${community.id}/requests/${item.profile_id}`, 'POST', { approve: true })}>Setujui</Button></li>)}</ul> : <p className="mt-2 text-sm text-slate-600">Belum ada permintaan.</p>}</div>}
          {community.role && community.role !== 'owner' && <Button variant="outline" disabled={busy} className="mt-5 min-h-11" onClick={() => void act(`/${community.id}/membership`, 'DELETE')}>Keluar dari komunitas</Button>}
          {community.role === 'owner' && <div className="mt-6 border-t pt-5"><h3 className="font-bold">Pindahkan kepemilikan</h3><p className="mt-1 text-sm text-slate-600">Pemilik harus memilih anggota aktif sebelum bisa keluar.</p><form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={event => { event.preventDefault(); const profile_id = String(new FormData(event.currentTarget).get('profile_id') ?? ''); if (profile_id) void act(`/${community.id}/transfer`, 'POST', { profile_id }); }}><Input aria-label="ID profil anggota" name="profile_id" placeholder="ID profil anggota aktif" required className="min-h-11"/><Button type="submit" disabled={busy} className="min-h-11">Transfer pemilik</Button></form></div>}
        </div>
        <section className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Event komunitas</h3>{community.events?.length ? <ul className="mt-3 divide-y">{community.events.map(event => <li key={event.id} className="py-3"><p className="font-semibold">{event.title}</p><p className="mt-1 text-sm text-slate-600">{new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short'}).format(new Date(event.starts_at))}</p></li>)}</ul> : <p className="mt-2 text-sm text-slate-600">Belum ada event yang dipublikasikan.</p>}</section>
      </>}
    </section> : <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
      <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7" aria-labelledby="discover-title"><h2 id="discover-title" className="text-xl font-bold">Jelajahi komunitas publik</h2>{communities.length ? <ul className="mt-4 divide-y">{communities.map(item => <li key={item.id} className="py-4"><Link className="text-lg font-semibold text-emerald-800 underline-offset-4 hover:underline" href={`/communities/?slug=${encodeURIComponent(item.slug)}`}>{item.name}</Link><p className="mt-1 text-sm text-slate-600">{item.description || 'Belum ada deskripsi.'}</p><p className="mt-2 text-xs text-slate-500">{item.member_count ?? 0} anggota{item.membership_status === 'pending' ? ' · menunggu persetujuan' : ''}</p></li>)}</ul> : <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Belum ada komunitas publik. Kamu bisa memulai komunitas baru.</p>}</section>
      <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7"><h2 className="text-xl font-bold">Buat komunitas</h2>{sessionToken ? <form className="mt-4 space-y-4" action={async form => await create(form)}><div><label className="mb-1 block text-sm font-semibold" htmlFor="community-name">Nama</label><Input id="community-name" name="name" minLength={2} maxLength={120} required className="min-h-11"/></div><div><label className="mb-1 block text-sm font-semibold" htmlFor="community-slug">Alamat</label><Input id="community-slug" name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={3} maxLength={60} required className="min-h-11"/><p className="mt-1 text-xs text-slate-500">Huruf kecil, angka, dan tanda hubung.</p></div><div><label className="mb-1 block text-sm font-semibold" htmlFor="community-description">Deskripsi</label><textarea id="community-description" name="description" maxLength={2000} rows={4} className="w-full rounded-lg border border-input bg-transparent p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"/></div><div><label className="mb-1 block text-sm font-semibold" htmlFor="community-visibility">Akses</label><select id="community-visibility" name="visibility" className="min-h-11 w-full rounded-lg border border-input bg-background px-3"><option value="public">Publik</option><option value="private">Privat, perlu persetujuan</option></select></div><Button disabled={busy} type="submit" className="min-h-11 w-full">Buat komunitas</Button></form> : <p className="mt-4 text-sm text-slate-600">Masuk dengan akun Google untuk membuat komunitas dan mengelola membership.</p>}</section>
    </div>}
  </div>;
}
