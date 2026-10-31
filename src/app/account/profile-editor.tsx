'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { LoaderCircle, Save, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ensureOwnProfile, getOwnProfile, updateOwnProfile, type OwnProfile } from '@/lib/profile-client';

export function ProfileEditor({ session }: { session: Session }) {
  const [profile, setProfile] = useState<OwnProfile>();
  const [bio, setBio] = useState('');
  const [timezone, setTimezone] = useState('Asia/Jakarta');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void getOwnProfile(session.access_token, controller.signal)
      .catch((requestError) => {
        if (requestError.code === 'PROFILE_NOT_FOUND') return ensureOwnProfile(session.access_token);
        throw requestError;
      })
      .then((result) => {
        setProfile(result);
        setBio(result.bio ?? '');
        setTimezone(result.default_timezone);
        setError('');
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [session.access_token]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const result = await updateOwnProfile(session.access_token, { bio: bio.trim() || null, default_timezone: timezone.trim() });
      setProfile(result);
      setMessage('Profil berhasil diperbarui.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Profil belum dapat disimpan.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <section className="rounded-2xl border border-slate-200 bg-white p-6" aria-busy="true"><p className="flex items-center gap-2 text-sm text-slate-600"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Memuat profil milikmu…</p></section>;

  if (!profile) return <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-bold">Profil belum tersedia</h2><p className="mt-2 text-sm text-amber-950">{error || 'Profil akan dibuat setelah verifikasi identitas selesai.'}</p></section>;

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8" aria-labelledby="profile-title">
    <div className="flex items-start gap-4"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><UserRound aria-hidden="true" /></span><div className="min-w-0"><p className="text-xs font-bold tracking-widest text-emerald-700 uppercase">Profil pribadi</p><h2 id="profile-title" className="mt-1 text-xl font-extrabold">{profile.display_name}</h2><p className="mt-1 break-all text-xs text-slate-500">{profile.email} · hanya terlihat olehmu</p></div></div>
    <form className="mt-6 grid gap-5 sm:grid-cols-2" onSubmit={save}>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="profile-bio">Tentang kamu</Label><textarea id="profile-bio" className="min-h-28 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus-visible:border-emerald-700 focus-visible:ring-3 focus-visible:ring-emerald-700/20" maxLength={1000} value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Contoh: Suka badminton dan lari pagi" /><p className="text-right text-xs text-slate-500">{bio.length}/1000</p></div>
      <div className="space-y-2"><Label htmlFor="profile-timezone">Zona waktu</Label><Input id="profile-timezone" className="min-h-11" value={timezone} onChange={(event) => setTimezone(event.target.value)} required maxLength={100} /></div>
      <div className="flex items-end"><Button type="submit" className="min-h-11 bg-emerald-700 px-5 text-white hover:bg-emerald-800" disabled={saving}>{saving ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Save aria-hidden="true" />}{saving ? 'Menyimpan…' : 'Simpan profil'}</Button></div>
      {(error || message) && <p className={`text-sm font-medium sm:col-span-2 ${error ? 'text-rose-700' : 'text-emerald-700'}`} role={error ? 'alert' : 'status'}>{error || message}</p>}
    </form>
  </section>;
}
