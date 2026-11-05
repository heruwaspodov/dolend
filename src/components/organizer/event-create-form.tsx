'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { organizerRequest, type ActivityType, type OrganizerWorkspace } from '@/lib/organizer-client';
import { useOrganizerSession } from '@/lib/use-organizer-session';
import { venueSnapshotFromForm } from '@/lib/venue-form';
import { SessionGate } from './session-gate';

import { WorkspaceFormSection, workspaceFormAction, workspaceFormControl, workspaceFormPanel, workspaceFormWidth } from './workspace-form';

const field = `mt-2 ${workspaceFormControl}`;
const zones = [{ value: 'Asia/Jakarta', label: 'WIB', offset: '+07:00' }, { value: 'Asia/Makassar', label: 'WITA', offset: '+08:00' }, { value: 'Asia/Jayapura', label: 'WIT', offset: '+09:00' }];
type PaymentMethod={id:string;type:'static_qris'|'bank_transfer'|'cash';recipient_name:string;is_active:boolean};

export function EventCreateForm() {
  const { session, ready } = useOrganizerSession();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<OrganizerWorkspace[]>([]);
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [timezone, setTimezone] = useState('Asia/Jakarta');
  const [billingMode,setBillingMode]=useState<'dynamic'|'free'|'before_event'|'after_event'>('dynamic');
  const [paymentMethods,setPaymentMethods]=useState<PaymentMethod[]>([]);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    void Promise.all([
      organizerRequest<OrganizerWorkspace[]>('/organizer/workspaces', session.access_token, { signal: controller.signal }),
      organizerRequest<ActivityType[]>('/activity-types', session.access_token, { signal: controller.signal }),
      organizerRequest<PaymentMethod[]>('/payment-settings',session.access_token,{signal:controller.signal}),
    ]).then(([nextWorkspaces, nextActivities,nextMethods]) => { setWorkspaces(nextWorkspaces); setActivities(nextActivities);setPaymentMethods(nextMethods.filter(method=>method.type==='bank_transfer'&&method.is_active)); })
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
    try {
      const venueSnapshot = venueSnapshotFromForm(form);
      const fixed=billingMode!=='dynamic';
      const result = await organizerRequest<{ id: string }>('/events', session.access_token, { method: 'POST', body: JSON.stringify({
        workspace_id: form.get('workspace_id'), activity_type_id: form.get('activity_type_id'), title: form.get('title'), description: form.get('description') || undefined,
        starts_at: iso('starts_at'), ends_at: iso('ends_at'), registration_closes_at: iso('registration_closes_at'), timezone,
        capacity: Number(form.get('capacity')),
        ...(fixed?{billing_mode:billingMode,price_amount:billingMode==='free'?0:Number(form.get('price_amount')),hold_minutes:billingMode==='before_event'?Number(form.get('hold_minutes')):undefined,payment_due_at:billingMode==='after_event'?iso('payment_due_at'):undefined,payment_method_id:billingMode==='free'?undefined:form.get('payment_method_id')}:{estimated_total_cost:Number(form.get('estimated_total_cost')),payment_timing:form.get('payment_timing')}),
        visibility:form.get('visibility'),
        ...(venueSnapshot ? { venue_snapshot: venueSnapshot } : {}),
      }) });
      router.push(`/event/manage/?id=${result.id}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Event belum dapat dibuat.'); setSaving(false); }
  }

  if (!session) return <SessionGate ready={ready} />;
  return <div className={workspaceFormWidth}>
    <header className="mb-6">
      <h1 className="text-3xl font-semibold tracking-tight">Buat event</h1>
      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">Tentukan waktu dan biaya. Untuk event patungan, venue bisa dilengkapi saat planning.</p>
    </header>
    {loading && <p className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600" role="status">Menyiapkan form…</p>}
    {!loading && workspaces.length === 0 && !error && <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950" role="alert">Akun ini belum punya akses organizer pada workspace mana pun.</p>}
    {!loading && workspaces.length > 0 && <form className={workspaceFormPanel} onSubmit={submit}>
      <WorkspaceFormSection id="event-basics" title="Dasar event" description="Beri nama event dan tentukan siapa yang bisa membukanya.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="workspace">Workspace</Label><select id="workspace" name="workspace_id" required className={field}>{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select></div>
          <div><Label htmlFor="activity">Jenis aktivitas</Label><select id="activity" name="activity_type_id" required className={field}>{activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.name}</option>)}</select></div>
          <div className="sm:col-span-2"><Label htmlFor="title">Nama event</Label><Input id="title" name="title" required maxLength={200} className={field} placeholder="Badminton Jumat malam" /></div>
          <div className="sm:col-span-2"><Label htmlFor="description">Deskripsi <span className="font-normal text-slate-500">(opsional)</span></Label><textarea id="description" name="description" maxLength={10000} rows={4} className={`${field} h-auto resize-y py-2 placeholder:text-muted-foreground`} placeholder="Level permainan, perlengkapan, atau catatan lain" /></div>
          <div className="sm:col-span-2"><Label htmlFor="visibility">Akses event</Label><select id="visibility" name="visibility" defaultValue="unlisted" className={field}><option value="unlisted">Hanya lewat undangan</option><option value="public">Publik</option></select><p className="mt-2 text-xs leading-relaxed text-slate-600">Event undangan tidak tampil di discovery dan hanya dapat dibuka lewat tautan aktif.</p></div>
        </div>
      </WorkspaceFormSection>
      <WorkspaceFormSection id="event-time" title="Waktu" description="Atur jadwal dan batas pendaftaran dalam zona waktu event.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="starts">Mulai</Label><Input id="starts" name="starts_at" type="datetime-local" required className={field} /></div>
          <div><Label htmlFor="ends">Selesai</Label><Input id="ends" name="ends_at" type="datetime-local" required className={field} /></div>
          <div><Label htmlFor="closes">Pendaftaran ditutup</Label><Input id="closes" name="registration_closes_at" type="datetime-local" required className={field} /></div>
          <div><Label htmlFor="timezone">Zona waktu</Label><select id="timezone" name="timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} className={field}>{zones.map((zone) => <option key={zone.value} value={zone.value}>{zone.label}</option>)}</select></div>
        </div>
      </WorkspaceFormSection>
      <WorkspaceFormSection id="event-billing" title="Peserta dan biaya" description="Tentukan kapasitas dan cara peserta membayar.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="capacity">Kapasitas</Label><Input id="capacity" name="capacity" type="number" min={1} max={100000} defaultValue={12} required className={field} /></div>
          <div><Label htmlFor="billing-mode">Model biaya</Label><select id="billing-mode" name="billing_mode" value={billingMode} onChange={event=>setBillingMode(event.target.value as typeof billingMode)} className={field}><option value="dynamic">Patungan sesuai biaya aktual</option><option value="free">Gratis</option><option value="before_event">Harga tetap · bayar sebelum event</option><option value="after_event">Harga tetap · bayar setelah event</option></select></div>
          {billingMode==='dynamic'&&<><div><Label htmlFor="cost">Perkiraan biaya total (Rp)</Label><Input id="cost" name="estimated_total_cost" type="number" min={0} step={1000} defaultValue={0} required className={field} /></div>
          <div><Label htmlFor="timing">Waktu pembayaran</Label><select id="timing" name="payment_timing" className={field}><option value="before_event">Sebelum event</option><option value="after_event">Setelah event</option></select></div></>}
          {billingMode!=='dynamic'&&billingMode!=='free'&&<><div><Label htmlFor="price">Harga per peserta (Rp)</Label><Input id="price" name="price_amount" type="number" min={1} max={1e12} step={1} required className={field}/></div>
          <div><Label htmlFor="payment-method">Rekening penerima</Label><select id="payment-method" name="payment_method_id" required className={field}><option value="">Pilih rekening</option>{paymentMethods.map(method=><option key={method.id} value={method.id}>{method.recipient_name}</option>)}</select>{paymentMethods.length===0&&<p className="mt-2 text-xs text-amber-800">Tambahkan rekening bank aktif di halaman akun terlebih dahulu.</p>}</div></>}
          {billingMode==='before_event'&&<div><Label htmlFor="hold-minutes">Durasi tahan kursi (menit)</Label><Input id="hold-minutes" name="hold_minutes" type="number" min={1} max={1440} defaultValue={15} required className={field}/></div>}
          {billingMode==='after_event'&&<div><Label htmlFor="payment-due">Jatuh tempo pembayaran</Label><Input id="payment-due" name="payment_due_at" type="datetime-local" required className={field}/><p className="mt-2 text-xs text-slate-600">Harus setelah event selesai.</p></div>}
        </div>
      </WorkspaceFormSection>
      <WorkspaceFormSection id="event-venue" title="Venue" description={billingMode === 'dynamic' ? 'Opsional. Kosongkan jika tempat masih dibicarakan.' : 'Nama dan alamat tempat wajib diisi karena event langsung dipublikasikan.'}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="venue-name">Nama tempat</Label><Input id="venue-name" name="venue_name" maxLength={200} required={billingMode!=='dynamic'} className={field} /></div>
          <div><Label htmlFor="venue-address">Alamat</Label><Input id="venue-address" name="venue_address" maxLength={1000} required={billingMode!=='dynamic'} className={field} /></div>
          <div><Label htmlFor="latitude">Latitude</Label><Input id="latitude" name="latitude" type="number" inputMode="decimal" min={-90} max={90} step="any" className={field} placeholder="-6.200000" /></div>
          <div><Label htmlFor="longitude">Longitude</Label><Input id="longitude" name="longitude" type="number" inputMode="decimal" min={-180} max={180} step="any" className={field} placeholder="106.816666" /></div>
          <div className="sm:col-span-2"><Label htmlFor="maps">Tautan Google Maps <span className="font-normal text-slate-500">(opsional jika koordinat diisi)</span></Label><Input id="maps" name="maps_url" type="url" maxLength={2000} className={field} placeholder="https://www.google.com/maps/…" /></div>
          <div className="sm:col-span-2"><Label htmlFor="coarse-region-code">Kode area umum untuk rekomendasi</Label><Input id="coarse-region-code" name="coarse_region_code" maxLength={32} className={field} placeholder="Contoh: ID-JK" /><p className="mt-1 text-xs text-slate-500">Opsional. Gunakan kode kota/provinsi umum, jangan masukkan koordinat atau alamat di kolom ini.</p></div>
          <div className="sm:col-span-2"><Label htmlFor="meeting-instructions">Petunjuk bertemu</Label><textarea id="meeting-instructions" name="meeting_instructions" maxLength={1000} rows={3} className={`${field} h-auto resize-y py-2 placeholder:text-muted-foreground`} placeholder="Contoh: tunggu di lobi utama 15 menit sebelum mulai" /></div>
        </div>
      </WorkspaceFormSection>
      <div className="px-5 py-5 sm:px-8">
        {error && <p className="mb-3 rounded-lg bg-rose-50 p-4 text-sm font-medium text-rose-800" role="alert">{error}</p>}
        <div className="flex sm:justify-end">
          <Button type="submit" disabled={saving || activities.length === 0} className={`${workspaceFormAction} w-full sm:w-fit`}>{saving ? 'Membuat event…' : 'Buat event'}</Button>
        </div>
      </div>
    </form>}
    {error && (loading || workspaces.length === 0) && <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm font-medium text-rose-800" role="alert">{error}</p>}
  </div>;
}
