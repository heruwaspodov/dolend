'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';

type SocialProfile = { profile_id: string; display_name: string; bio: string | null; avatar_path: string | null; created_at?: string; status: string };
type ListKind = 'requests' | 'followers' | 'following' | 'blocks';
const labels: Record<ListKind, string> = { requests: 'Permintaan mengikuti', followers: 'Pengikut', following: 'Mengikuti', blocks: 'Diblokir' };

export function SocialPanel() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<ListKind>('requests');
  const [items, setItems] = useState<SocialProfile[]>([]);
  const [before, setBefore] = useState<string | null>(null);
  const [privateProfile, setPrivateProfile] = useState(false);
  const [target, setTarget] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);

  const request = useCallback(async (path: string, method = 'GET', body?: Record<string, unknown>) => {
    if (!session) throw new Error('Masuk untuk mengelola relasi.');
    const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
    if (!base) throw new Error('Layanan belum dikonfigurasi.');
    const response = await fetch(`${base}/dolend-api/v1/social${path}`, { method, headers: { authorization: `Bearer ${session.access_token}`, ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json() as { data?: unknown; error?: { message?: string } };
    if (!response.ok) throw new Error(result.error?.message ?? 'Permintaan belum dapat diproses.');
    return result.data;
  }, [session]);

  const load = useCallback(async (kind: ListKind = active, cursor: string | null = null, append = false) => {
    if (!session) return;
    setBusy(true);
    try {
      const result = await request(`/list/${kind}?limit=50${cursor ? `&before=${encodeURIComponent(cursor)}` : ''}`) as SocialProfile[];
      const page = result ?? [];
      setItems(current => append ? [...current, ...page] : page);
      setBefore(page.length === 50 ? page[page.length - 1].profile_id : null);
      setNotice('');
    }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Data belum dapat dimuat.'); }
    finally { setBusy(false); }
  }, [active, request, session]);

  useEffect(() => {
    if (!session) return;
    let mounted = true;
    void request(`/list/${active}?limit=50`).then(value => {
      if (!mounted) return;
      const page = (value as SocialProfile[]) ?? [];
      setItems(page);
      setBefore(page.length === 50 ? page[page.length - 1].profile_id : null);
      setNotice('');
    }).catch(error => {
      if (mounted) setNotice(error instanceof Error ? error.message : 'Data belum dapat dimuat.');
    });
    void request(`/profile/${session.user.id}`).then(value => {
      if (!mounted) return;
      const result = value as { is_private?: boolean } | null;
      setPrivateProfile(Boolean(result?.is_private));
    }).catch(() => { if (mounted) setNotice('Pengaturan privasi belum dapat dimuat.'); });
    return () => { mounted = false; };
  }, [session, active, request]);

  async function changePrivacy(value: boolean) {
    setBusy(true);
    try { await request('/privacy', 'PATCH', { is_private: value }); setPrivateProfile(value); setNotice('Privasi profil berhasil diperbarui.'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Perubahan belum tersimpan.'); }
    finally { setBusy(false); }
  }

  async function act(action: 'follow' | 'blocks' | 'reports', body?: Record<string, unknown>) {
    const id = target.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) { setNotice('Masukkan ID profil yang valid.'); return; }
    setBusy(true);
    try {
      const result = await request(`/${action}/${id}`, 'POST', body);
      setTarget('');
      await load();
      const followsNow = action === 'follow' && result === 'accepted';
      setNotice(followsNow ? 'Sekarang mengikuti profil.' : action === 'follow' ? 'Permintaan mengikuti dikirim.' : action === 'blocks' ? 'Profil diblokir.' : 'Laporan terkirim.');
    }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Permintaan belum dapat diproses.'); }
    finally { setBusy(false); }
  }

  async function respond(id: string, accept: boolean) {
    setBusy(true);
    try { await request(`/requests/${id}`, 'POST', { accept }); await load(); setNotice(accept ? 'Permintaan disetujui.' : 'Permintaan ditolak.'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Permintaan belum dapat diproses.'); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto max-w-3xl space-y-5 py-8">
    <header><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Jaringan sosial</p><h1 className="mt-2 text-3xl font-extrabold">Privasi dan relasi</h1><p className="mt-2 text-sm text-slate-600">Atur siapa yang dapat mengikuti profil dan kelola permintaan masuk. Nomor telepon tidak digunakan untuk mencari akun.</p></header>
    {!ready ? <p aria-live="polite">Memeriksa sesi…</p> : !session ? <section className="rounded-xl border bg-white p-5">Masuk dengan akun Google untuk mengelola relasi.</section> : <>
      <section className="rounded-2xl border bg-white p-5" aria-labelledby="privacy-title"><h2 id="privacy-title" className="font-bold">Privasi profil</h2><p className="mt-1 text-sm text-slate-600">Profil privat memerlukan persetujuanmu sebelum pengikut dapat melihat profil.</p><label className="mt-4 flex min-h-11 items-center gap-3"><input type="checkbox" checked={privateProfile} onChange={event => void changePrivacy(event.target.checked)} disabled={busy} />Jadikan profil privat</label></section>
      <section className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap gap-2" role="tablist" aria-label="Daftar relasi">{(Object.keys(labels) as ListKind[]).map(kind => <button key={kind} type="button" role="tab" aria-selected={active === kind} className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${active === kind ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-800'}`} onClick={() => setActive(kind)}>{labels[kind]}</button>)}</div>
        <ul className="mt-4 divide-y">{items.map(item => <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={item.profile_id}><div><p className="font-semibold">{item.display_name}</p><p className="text-xs text-slate-500">{item.profile_id}</p></div>{active === 'requests' && <div className="flex gap-2"><Button variant="outline" className="min-h-11 border-emerald-800 text-emerald-900 hover:bg-emerald-50" disabled={busy} onClick={() => void respond(item.profile_id, true)}>Setujui</Button><Button variant="outline" className="min-h-11" disabled={busy} onClick={() => void respond(item.profile_id, false)}>Tolak</Button></div>}{active === 'blocks' && <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => void request(`/blocks/${item.profile_id}`, 'DELETE').then(() => load()).catch(() => setNotice('Buka blokir belum berhasil.'))}>Buka blokir</Button>}</li>)}</ul>
        {!busy && items.length === 0 && <p className="py-4 text-sm text-slate-600">Belum ada {labels[active].toLowerCase()}.</p>}
        {before && <Button variant="outline" className="mt-3 min-h-11" disabled={busy} onClick={() => void load(active, before, true)}>{busy ? 'Memuat…' : 'Muat lagi'}</Button>}
      </section>
      <section className="rounded-2xl border bg-white p-5"><h2 className="font-bold">Ikuti, blokir, atau laporkan profil</h2><p className="mt-1 text-sm text-slate-600">Gunakan ID profil dari halaman profil tujuan.</p><label className="mt-4 block text-sm font-semibold" htmlFor="social-target">ID profil</label><input id="social-target" value={target} onChange={event => setTarget(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border px-3" autoComplete="off" /><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" className="min-h-11 border-emerald-800 text-emerald-900 hover:bg-emerald-50" disabled={busy} onClick={() => void act('follow')}>Ikuti</Button><Button variant="outline" className="min-h-11" disabled={busy} onClick={() => void act('blocks')}>Blokir</Button><Button variant="outline" className="min-h-11" disabled={busy} onClick={() => void act('reports', { reason: 'other' })}>Laporkan</Button></div></section>
      {notice && <p role="status" aria-live="polite" className="text-sm text-slate-700">{notice}</p>}
    </>}
  </div>;
}
