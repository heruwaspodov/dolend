'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { organizerRequest, type ActivityType, type OrganizerWorkspace } from '@/lib/organizer-client';
import { useOrganizerSession } from '@/lib/use-organizer-session';
import { SessionGate } from './session-gate';

const field = 'mt-2 min-h-11 border-slate-300 bg-white';
const select = `${field} w-full rounded-lg border px-3 text-sm outline-none focus-visible:border-emerald-700 focus-visible:ring-3 focus-visible:ring-emerald-700/20`;
const zones = [{ value: 'Asia/Jakarta', label: 'WIB', offset: '+07:00' }, { value: 'Asia/Makassar', label: 'WITA', offset: '+08:00' }, { value: 'Asia/Jayapura', label: 'WIT', offset: '+09:00' }];

export function EventCreateForm() {
  const { session, ready } = useOrganizerSession();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<OrganizerWorkspace[]>([]);
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [timezone, setTimezone] = useState('Asia/Jakarta');

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    void Promise.all([
      organizerRequest<OrganizerWorkspace[]>('/organizer/workspaces', session.access_token, { signal: controller.signal }),
      organizerRequest<ActivityType[]>('/activity-types', session.access_token, { signal: controller.signal }),
    ]).then(([nextWorkspaces, nextActivities]) => { setWorkspaces(nextWorkspaces); setActivities(nextActivities); })
      .catch((reason) => { if (reason.name !== 'AbortError') setError(reason.message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [session]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setSaving(true); setError('');
    const form = new FormData(event.currentTarget);
    const offset = zones.find((zone) => zone.value === timezone)?.offset ?? '+07:00';
    const iso = (name: string) => `${String(form.get(name))}:00${offset}`;
    const venueName = String(form.get('venue_name') ?? '').trim();
    const venueAddress = String(form.get('venue_address') ?? '').trim();
    try {
      const result = await organizerRequest<{ id: string }>('/events', session.access_token, { method: 'POST', body: JSON.stringify({
        workspace_id: form.get('workspace_id'), activity_type_id: form.get('activity_type_id'), title: form.get('title'), description: form.get('description') || undefined,
        starts_at: iso('starts_at'), ends_at: iso('ends_at'), registration_closes_at: iso('registration_closes_at'), timezone,
        capacity: Number(form.get('capacity')), estimated_total_cost: Number(form.get('estimated_total_cost')), payment_timing: form.get('payment_timing'),
        ...(venueName || venueAddress ? { venue_snapshot: { name: venueName, address: venueAddress, maps_url: String(form.get('maps_url') ?? '').trim() } } : {}),
      }) });
      router.push(`/event/manage/?id=${result.id}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Event belum dapat dibuat.'); setSaving(false); }
  }

  if (!session) return <SessionGate ready={ready} />;
  return <div className="mx-auto max-w-3xl">
    <header><p className="text-xs font-bold tracking-widest text-emerald-700 uppercase">Event baru</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">Mulai dari rencana yang sudah pasti</h1><p className="mt-3 text-sm leading-relaxed text-slate-600">Waktu dan perkiraan biaya dibutuhkan sekarang. Venue bisa ditambahkan atau diperbarui saat planning.</p></header>
    {loading && <p className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600" role="status">Menyiapkan form…</p>}
    {!loading && workspaces.length === 0 && !error && <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950" role="alert">Akun ini belum punya akses organizer pada workspace mana pun.</p>}
    {!loading && workspaces.length > 0 && <form className="mt-7 space-y-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" onSubmit={submit}>
      <fieldset className="grid gap-5 sm:grid-cols-2"><legend className="mb-5 text-lg font-bold">Dasar event</legend>
        <div><Label htmlFor="workspace">Workspace</Label><select id="workspace" name="workspace_id" required className={select}>{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select></div>
        <div><Label htmlFor="activity">Jenis aktivitas</Label><select id="activity" name="activity_type_id" required className={select}>{activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.name}</option>)}</select></div>
        <div className="sm:col-span-2"><Label htmlFor="title">Nama event</Label><Input id="title" name="title" required maxLength={200} className={field} placeholder="Badminton Jumat malam" /></div>
        <div className="sm:col-span-2"><Label htmlFor="description">Deskripsi <span className="font-normal text-slate-500">(opsional)</span></Label><textarea id="description" name="description" maxLength={10000} rows={4} className={`${select} py-3`} placeholder="Level permainan, perlengkapan, atau catatan lain" /></div>
      </fieldset>
      <fieldset className="grid gap-5 sm:grid-cols-2"><legend className="mb-5 text-lg font-bold">Waktu</legend>
        <div><Label htmlFor="starts">Mulai</Label><Input id="starts" name="starts_at" type="datetime-local" required className={field} /></div><div><Label htmlFor="ends">Selesai</Label><Input id="ends" name="ends_at" type="datetime-local" required className={field} /></div>
        <div><Label htmlFor="closes">Pendaftaran ditutup</Label><Input id="closes" name="registration_closes_at" type="datetime-local" required className={field} /></div><div><Label htmlFor="timezone">Zona waktu</Label><select id="timezone" name="timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} className={select}>{zones.map((zone) => <option key={zone.value} value={zone.value}>{zone.label}</option>)}</select></div>
      </fieldset>
      <fieldset className="grid gap-5 sm:grid-cols-2"><legend className="mb-5 text-lg font-bold">Peserta dan biaya</legend>
        <div><Label htmlFor="capacity">Kapasitas</Label><Input id="capacity" name="capacity" type="number" min={1} max={100000} defaultValue={12} required className={field} /></div><div><Label htmlFor="cost">Perkiraan biaya total (Rp)</Label><Input id="cost" name="estimated_total_cost" type="number" min={0} step={1000} defaultValue={0} required className={field} /></div>
        <div className="sm:col-span-2"><Label htmlFor="timing">Waktu pembayaran</Label><select id="timing" name="payment_timing" className={select}><option value="before_event">Sebelum event</option><option value="after_event">Setelah event</option></select></div>
      </fieldset>
      <fieldset className="grid gap-5 sm:grid-cols-2"><legend className="mb-2 text-lg font-bold">Venue <span className="text-sm font-normal text-slate-500">(opsional)</span></legend><p className="-mt-3 text-sm text-slate-600 sm:col-span-2">Kosongkan jika tempat masih dibicarakan.</p>
        <div><Label htmlFor="venue-name">Nama tempat</Label><Input id="venue-name" name="venue_name" maxLength={200} className={field} /></div><div><Label htmlFor="venue-address">Alamat</Label><Input id="venue-address" name="venue_address" maxLength={1000} className={field} /></div><div className="sm:col-span-2"><Label htmlFor="maps">Tautan Google Maps</Label><Input id="maps" name="maps_url" type="url" maxLength={2000} className={field} placeholder="https://www.google.com/maps/…" /></div>
      </fieldset>
      {error && <p className="rounded-lg bg-rose-50 p-4 text-sm font-medium text-rose-800" role="alert">{error}</p>}
      <Button type="submit" disabled={saving || activities.length === 0} className="min-h-11 w-full bg-emerald-700 px-5 text-white hover:bg-emerald-800 sm:w-auto">{saving ? 'Membuat event…' : 'Buat event'}</Button>
    </form>}
    {error && (loading || workspaces.length === 0) && <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm font-medium text-rose-800" role="alert">{error}</p>}
  </div>;
}
