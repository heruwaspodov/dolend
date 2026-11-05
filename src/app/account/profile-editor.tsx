'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { LoaderCircle, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SettingsSection, settingsAction, settingsControl } from './settings-section';
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

  return (
    <SettingsSection id="profile-title" title="Profil" description="Atur bio dan zona waktu yang kamu gunakan.">
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Memuat profil milikmu…
        </p>
      ) : !profile ? (
        <p className="text-sm text-muted-foreground">{error || 'Profil akan dibuat setelah verifikasi identitas selesai.'}</p>
      ) : (
        <form className="grid gap-4" onSubmit={save}>
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
              <UserRound className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="break-words text-base font-semibold">{profile.display_name}</h3>
              <p className="break-words text-xs text-muted-foreground">{profile.email} · hanya terlihat olehmu</p>
            </div>
          </div>
          <div className="grid max-w-56 gap-2">
            <Label htmlFor="profile-timezone">Zona waktu</Label>
            <Input id="profile-timezone" className={settingsControl} value={timezone} onChange={(event) => setTimezone(event.target.value)} required maxLength={100} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="profile-bio">Tentang kamu</Label>
            <textarea
              id="profile-bio"
              className={`${settingsControl} h-auto min-h-24 resize-y py-2 placeholder:text-muted-foreground`}
              aria-describedby="profile-bio-count"
              maxLength={1000}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="Contoh: Suka badminton dan lari pagi"
            />
            <p id="profile-bio-count" className="text-right text-xs tabular-nums text-muted-foreground">{bio.length}/1000 karakter</p>
          </div>

          <Button type="submit" className={`${settingsAction} w-full sm:w-fit`} disabled={saving}>
            {saving && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {saving ? 'Menyimpan…' : 'Simpan profil'}
          </Button>
          {(error || message) && <p className={`text-sm font-medium ${error ? 'text-rose-700' : 'text-emerald-700'}`} role={error ? 'alert' : 'status'}>{error || message}</p>}
        </form>
      )}
    </SettingsSection>
  );
}
