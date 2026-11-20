'use client';

import { SearchableSelect } from '@/components/ui/searchable-select';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, RefreshCw, SlidersHorizontal, Trash2 } from 'lucide-react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { organizerRequest, type ActivityType, type OrganizerWorkspace } from '@/lib/organizer-client';
import { costModelOptions, paymentTimingOptions, type CostModel, type PaymentTiming } from '@/lib/event-billing-options';
import { useOrganizerSession } from '@/lib/use-organizer-session';
import { venueSnapshotFromForm } from '@/lib/venue-form';
import { VenuePicker } from './venue-picker';
import { SessionGate } from './session-gate';
import { BillingChoices } from './billing-choices';
import { EventBasicsFields } from './event-basics-fields';

import { WorkspaceFormHeader, WorkspaceFormSection, workspaceFormDividers, workspaceFormAction, workspaceFormControl, workspaceFormPanel, workspaceFormWidth } from './workspace-form';

const field = `mt-2 ${workspaceFormControl}`;
const rupiah = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const zones = [{ value: 'Asia/Jakarta', label: 'WIB', offset: '+07:00' }, { value: 'Asia/Makassar', label: 'WITA', offset: '+08:00' }, { value: 'Asia/Jayapura', label: 'WIT', offset: '+09:00' }];
type PaymentMethod={id:string;type:'static_qris'|'bank_transfer'|'cash';recipient_name:string;is_active:boolean};

export function EventCreateForm() {
  const { session, ready } = useOrganizerSession();
  const router = useRouter();
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>();
  const [workspaces, setWorkspaces] = useState<OrganizerWorkspace[]>([]);
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [timezone, setTimezone] = useState('Asia/Jakarta');
  const [costModel, setCostModel] = useState<CostModel>('dynamic');
  const [paymentTiming, setPaymentTiming] = useState<PaymentTiming>('before_event');
  const [venueEditorOpen, setVenueEditorOpen] = useState(false);
  const [capacityValue, setCapacityValue] = useState('12');
  const [estimatedCostValue, setEstimatedCostValue] = useState('0');
  const [fixedPriceValue, setFixedPriceValue] = useState('');
  const [priceOptionsEnabled,setPriceOptionsEnabled]=useState(false);
  const [priceOptions,setPriceOptions]=useState([{id:'initial-1',name:'',amount:'',quota:''},{id:'initial-2',name:'',amount:'',quota:''}]);
  const fixedPrice = costModel === 'fixed';
  const [paymentMethods,setPaymentMethods]=useState<PaymentMethod[]>([]);
  const [paymentMethodsLoaded,setPaymentMethodsLoaded]=useState(false);
  const [paymentMethodsError,setPaymentMethodsError]=useState('');
  const [paymentRefreshKey,setPaymentRefreshKey]=useState(0);
  const capacity = Number(capacityValue);
  const estimatedCost = Number(estimatedCostValue);
  const fixedPriceAmount = Number(fixedPriceValue);
  const normalizedPriceOptions=priceOptions.map(option=>({name:option.name.trim(),amount:Number(option.amount),quota:Number(option.quota)}));
  const priceOptionsValid=normalizedPriceOptions.length>=2&&normalizedPriceOptions.length<=20&&normalizedPriceOptions.every(option=>option.name&&Number.isSafeInteger(option.amount)&&option.amount>0&&Number.isSafeInteger(option.quota)&&option.quota>0)&&normalizedPriceOptions.reduce((sum,option)=>sum+option.quota,0)===capacity&&new Set(normalizedPriceOptions.map(option=>option.name.toLocaleLowerCase('id-ID'))).size===normalizedPriceOptions.length;
  const hasValidCapacity = Number.isSafeInteger(capacity) && capacity >= 1 && capacity <= 100000;
  const hasValidEstimatedCost = estimatedCostValue.trim() !== '' && Number.isSafeInteger(estimatedCost) && estimatedCost >= 0 && estimatedCost <= 1e12;
  const hasValidFixedPrice = Number.isSafeInteger(fixedPriceAmount) && fixedPriceAmount >= 1 && fixedPriceAmount <= 1e12;
  const perPersonEstimate = costModel === 'free' ? 0
    : costModel === 'fixed' ? (priceOptionsEnabled&&priceOptionsValid ? Math.min(...normalizedPriceOptions.map(option=>option.amount)) : hasValidFixedPrice ? fixedPriceAmount : null)
      : hasValidCapacity && hasValidEstimatedCost ? Math.ceil(estimatedCost / capacity) : null;
  const formatRupiah = (amount: number) => `Rp ${rupiah.format(amount)}`;

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

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    void organizerRequest<PaymentMethod[]>('/payment-settings', session.access_token, { signal: controller.signal })
      .then(methods => { setPaymentMethods(methods.filter(method => method.type === 'bank_transfer' && method.is_active)); setPaymentMethodsError(''); setPaymentMethodsLoaded(true); })
      .catch(reason => { if (reason.name !== 'AbortError') { setPaymentMethodsError(reason.message); setPaymentMethodsLoaded(true); } });
    return () => controller.abort();
  }, [session, paymentRefreshKey]);

  useEffect(() => {
    const refresh = () => setPaymentRefreshKey(key => key + 1);
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setSaving(true); setError('');
    const form = new FormData(event.currentTarget);
    const offset = zones.find((zone) => zone.value === timezone)?.offset ?? '+07:00';
    const iso = (name: string) => `${String(form.get(name))}:00${offset}`;
    try {
      const venueSnapshot = venueSnapshotFromForm(form);
      const billing = {
        cost_model: costModel,
        payment_timing: costModel === 'free' ? undefined : paymentTiming,
        estimated_total_cost: costModel === 'dynamic' ? Number(form.get('estimated_total_cost')) : undefined,
        price_amount: fixedPrice ? priceOptionsEnabled ? Math.min(...normalizedPriceOptions.map(option=>option.amount)) : Number(form.get('price_amount')) : undefined,
        price_options: fixedPrice && priceOptionsEnabled ? normalizedPriceOptions : undefined,
        payment_method_id: fixedPrice ? form.get('payment_method_id') : undefined,
        hold_minutes: fixedPrice && paymentTiming === 'before_event' ? Number(form.get('hold_minutes')) : undefined,
        payment_due_at: fixedPrice && paymentTiming === 'after_event' ? iso('payment_due_at') : undefined,
      };
      const result = await organizerRequest<{ id: string }>('/events', session.access_token, { method: 'POST', body: JSON.stringify({
        workspace_id: form.get('workspace_id'), activity_type_id: form.get('activity_type_id'), title: form.get('title'), description: form.get('description') || undefined,
        starts_at: iso('starts_at'), ends_at: iso('ends_at'), registration_closes_at: iso('registration_closes_at'), timezone,
        capacity: Number(form.get('capacity')),
        ...billing,
        visibility:form.get('visibility'),
        ...(venueSnapshot ? { venue_snapshot: venueSnapshot } : {}),
      }) });
      router.push(`/event/manage/?id=${result.id}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Event belum dapat dibuat.'); setSaving(false); }
  }

  if (!session) return <SessionGate ready={ready} />;
  const workspace = selectedWorkspace ?? workspaces[0]?.id;
  const fixedPriceControls = fixedPrice ? <div className="ml-6 grid gap-4 rounded-lg bg-[#f6f5f4] p-4 sm:grid-cols-2">
    {!priceOptionsEnabled && <div>
      <Label htmlFor="price">Harga per peserta (Rp)</Label>
      <Input id="price" name="price_amount" type="number" min={1} max={1e12} step={1} value={fixedPriceValue} onChange={event => setFixedPriceValue(event.target.value)} required className={field} />
    </div>}
    <div className="sm:col-span-2">
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><input type="checkbox" checked={priceOptionsEnabled} onChange={event=>setPriceOptionsEnabled(event.target.checked)} className="size-4 accent-[#005bab]" />Gunakan pilihan harga dan kuota per kategori</label>
      {priceOptionsEnabled && <div className="mt-4 space-y-3">
        <p className="text-sm text-[#615d59]">Peserta memilih satu kategori. Total kuota kategori harus sama dengan kapasitas event ({capacity}).</p>
        {priceOptions.map((option,index)=><div key={option.id} className="grid gap-3 rounded-lg border border-[#e6e3df] bg-white p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <div><Label htmlFor={`option-name-${index}`}>Nama kategori</Label><Input id={`option-name-${index}`} placeholder="Kategori" value={option.name} maxLength={80} onChange={event=>setPriceOptions(items=>items.map((item,i)=>i===index?{...item,name:event.target.value}:item))} className={field} /></div>
          <div><Label htmlFor={`option-amount-${index}`}>Harga (Rp)</Label><Input id={`option-amount-${index}`} type="number" min={1} max={1e12} value={option.amount} onChange={event=>setPriceOptions(items=>items.map((item,i)=>i===index?{...item,amount:event.target.value}:item))} className={field} /></div>
          <div><Label htmlFor={`option-quota-${index}`}>Kuota</Label><Input id={`option-quota-${index}`} type="number" min={1} max={100000} value={option.quota} onChange={event=>setPriceOptions(items=>items.map((item,i)=>i===index?{...item,quota:event.target.value}:item))} className={field} /></div>
          {priceOptions.length>2&&<Button type="button" variant="ghost" size="icon" className="size-11 self-end text-[#615d59] hover:text-rose-700" aria-label={`Hapus kategori ${option.name.trim()||index+1}`} title="Hapus kategori" onClick={()=>setPriceOptions(items=>items.length>2?items.filter((_,i)=>i!==index):items)}><Trash2 className="size-4" aria-hidden="true" /></Button>}
        </div>)}
        <div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" disabled={priceOptions.length>=20} className="min-h-11" onClick={()=>setPriceOptions(items=>[...items,{id:crypto.randomUUID(),name:'',amount:'',quota:''}])}>Tambah kategori</Button><span className="text-xs text-[#615d59]">Minimal 2, maksimal 20 kategori.</span></div>
        {!priceOptionsValid&&<p className="text-sm text-rose-700" role="status">Isi nama unik, harga dan kuota positif; jumlah kuota harus tepat {capacity}.</p>}
      </div>}
    </div>
  </div> : null;
  return <div className={cn(workspaceFormWidth, workspaceFormPanel)}>
    <WorkspaceFormHeader icon={SlidersHorizontal} title="Buat event" description="Isi detail kegiatan, jadwal, dan biaya sebelum mengajak peserta." />
    {loading && <p className="px-5 py-6 sm:px-8 text-sm text-slate-600" role="status">Menyiapkan form…</p>}
    {!loading && workspaces.length === 0 && !error && <p className="px-5 py-6 sm:px-8 text-sm text-amber-950" role="alert">Akun ini belum punya akses organizer pada workspace mana pun.</p>}
    {!loading && workspaces.length > 0 && <form className={workspaceFormDividers} onSubmit={submit}>
      <WorkspaceFormSection id="event-basics" title="Dasar event" description="Beri nama event dan tentukan siapa yang bisa membukanya.">
        <EventBasicsFields activities={activities} workspaces={workspaces} onWorkspaceChange={setSelectedWorkspace} />
      </WorkspaceFormSection>
      <WorkspaceFormSection id="event-time" title="Jadwal" description="Atur jadwal dan batas pendaftaran dalam zona waktu event.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="starts">Mulai</Label><Input id="starts" name="starts_at" type="datetime-local" required className={field} /></div>
          <div><Label htmlFor="ends">Selesai</Label><Input id="ends" name="ends_at" type="datetime-local" required className={field} /></div>
          <div><Label htmlFor="closes">Pendaftaran ditutup</Label><Input id="closes" name="registration_closes_at" type="datetime-local" required className={field} /></div>
          <div><Label htmlFor="timezone">Zona waktu</Label><SearchableSelect id="timezone" name="timezone" value={timezone} onValueChange={event => setTimezone(event)} className="mt-2">{zones.map((zone) => <option key={zone.value} value={zone.value}>{zone.label}</option>)}</SearchableSelect></div>
        </div>
      </WorkspaceFormSection>
      <WorkspaceFormSection id="event-billing" title="Peserta dan biaya" description="Tentukan kuota, cara menghitung iuran, dan kapan peserta membayar.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="capacity">Kapasitas (orang)</Label><Input id="capacity" name="capacity" type="number" inputMode="numeric" min={1} max={100000} value={capacityValue} onChange={event => setCapacityValue(event.target.value)} required className={field} /></div>
          <div className="sm:col-span-2">
            <BillingChoices legend="Model biaya" name="cost_model" options={costModelOptions} value={costModel} onChange={setCostModel} renderAfterOption={option=>option==='fixed'?fixedPriceControls:null} />
          </div>
          {costModel === 'dynamic' && <div>
            <Label htmlFor="cost">Perkiraan biaya total (Rp)</Label>
            <Input id="cost" name="estimated_total_cost" type="number" min={0} max={1e12} step={1} value={estimatedCostValue} onChange={event => setEstimatedCostValue(event.target.value)} required className={field} />
          </div>}
          <div className="sm:col-span-2 border-t border-[#e6e3df] pt-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-sm font-medium" id="per-person-estimate-label">
                {costModel === 'dynamic' ? 'Estimasi patungan per orang' : costModel === 'fixed' ? 'Harga per peserta' : 'Biaya peserta'}
              </p>
              <output htmlFor={costModel === 'dynamic' ? 'capacity cost' : costModel === 'fixed' ? 'price' : undefined} aria-live="polite" aria-atomic="true" className="text-lg font-semibold tabular-nums text-[#005bab]">
                {perPersonEstimate === null ? '—' : costModel === 'free' ? 'Gratis' : formatRupiah(perPersonEstimate)}
              </output>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[#615d59]">
              {costModel === 'dynamic' ? 'Asumsi kuota penuh; estimasi dibulatkan ke atas dan menyesuaikan jumlah peserta yang ikut.'
                : costModel === 'fixed' ? priceOptionsEnabled ? 'Harga mengikuti kategori yang dipilih peserta.' : 'Setiap peserta membayar nominal yang sama.'
                  : 'Peserta tidak dikenakan biaya.'}
            </p>
          </div>
          {costModel !== 'free' && <div className="border-t border-[#e6e3df] pt-4 sm:col-span-2">
            <BillingChoices legend="Waktu pembayaran" name="payment_timing" options={paymentTimingOptions} value={paymentTiming} onChange={setPaymentTiming} inline />
          </div>}
          {fixedPrice && <div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="payment-method">Rekening penerima</Label>
              <Button type="button" variant="ghost" size="sm" className="min-h-11 gap-1 text-[#005bab]" onClick={() => setPaymentRefreshKey(key => key + 1)}>
                <RefreshCw className="size-4" aria-hidden="true" />Muat ulang
              </Button>
            </div>
            <SearchableSelect id="payment-method" name="payment_method_id" required className="mt-2">
              <option value="">Pilih rekening</option>
              {paymentMethods.map(method => <option key={method.id} value={method.id}>{method.recipient_name}</option>)}
            </SearchableSelect>
            {paymentMethodsError ? <p className="mt-2 text-xs text-rose-700" role="alert">Gagal memuat rekening: {paymentMethodsError}</p>
              : paymentMethodsLoaded && paymentMethods.length === 0 ? <p className="mt-2 text-xs text-amber-800">Belum ada rekening Transfer bank aktif. Tambahkan atau aktifkan di <a href="/account/#payment-settings-title" className="underline underline-offset-2">Pengaturan pembayaran</a>.</p>
                : !paymentMethodsLoaded ? <p className="mt-2 text-xs text-[#615d59]" role="status">Memuat rekening…</p> : null}
          </div>}
          {fixedPrice && paymentTiming === 'before_event' && <div>
            <Label htmlFor="hold-minutes">Durasi tahan kursi (menit)</Label>
            <Input id="hold-minutes" name="hold_minutes" type="number" min={1} max={1440} defaultValue={15} required className={field} />
          </div>}
          {fixedPrice && paymentTiming === 'after_event' && <div>
            <Label htmlFor="payment-due">Jatuh tempo pembayaran</Label>
            <Input id="payment-due" name="payment_due_at" type="datetime-local" required className={field} />
            <p className="mt-2 text-xs text-[#615d59]">Harus setelah event selesai.</p>
          </div>}
        </div>
      </WorkspaceFormSection>
      <WorkspaceFormSection id="event-venue" title="Lokasi" description={costModel === 'dynamic' ? 'Opsional. Kosongkan jika tempat masih dibicarakan.' : 'Nama dan alamat tempat wajib diisi untuk model biaya ini.'}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Button type="button" variant="outline" className="min-h-11 w-full sm:w-fit" aria-expanded={venueEditorOpen} aria-controls="create-venue-picker" onClick={() => setVenueEditorOpen(open => !open)}>
              <MapPin aria-hidden="true" />{venueEditorOpen ? 'Tutup pencarian venue' : 'Cari atau pilih venue'}
            </Button>
          </div>
          <div id="create-venue-picker" className="sm:col-span-2" hidden={!venueEditorOpen}>
            <VenuePicker key={workspace} workspace={workspace} token={session.access_token} />
          </div>
          <details className="rounded-lg border border-[#e6e3df] bg-white px-3 sm:col-span-2">
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Detail lokasi manual</summary>
            <div className="grid gap-4 pb-4 sm:grid-cols-2">
              <div><Label htmlFor="venue-name">Nama tempat</Label><Input id="venue-name" name="venue_name" maxLength={200} required={costModel !== 'dynamic'} className={field} /></div>
              <div><Label htmlFor="venue-address">Alamat</Label><Input id="venue-address" name="venue_address" maxLength={1000} required={costModel !== 'dynamic'} className={field} /></div>
              <div className="sm:col-span-2"><Label htmlFor="maps">Tautan Google Maps <span className="font-normal text-[#615d59]">(opsional jika koordinat diisi)</span></Label><Input id="maps" name="maps_url" type="url" maxLength={2000} className={field} placeholder="https://www.google.com/maps/…" /></div>
              <details className="rounded-lg border border-[#e6e3df] bg-white px-3 sm:col-span-2">
                <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Koordinat dan kode area</summary>
                <div className="grid gap-4 pb-4 sm:grid-cols-2">
                  <p className="text-sm text-[#615d59] sm:col-span-2">Jika memakai koordinat, isi latitude dan longitude bersama-sama.</p>
                  <div><Label htmlFor="latitude">Latitude</Label><Input id="latitude" name="latitude" type="number" inputMode="decimal" min={-90} max={90} step="any" className={field} placeholder="-6.200000" /></div>
                  <div><Label htmlFor="longitude">Longitude</Label><Input id="longitude" name="longitude" type="number" inputMode="decimal" min={-180} max={180} step="any" className={field} placeholder="106.816666" /></div>
                  <div className="sm:col-span-2"><Label htmlFor="coarse-region-code">Kode area umum untuk rekomendasi</Label><Input id="coarse-region-code" name="coarse_region_code" maxLength={32} className={field} placeholder="Contoh: ID-JK" /><p className="mt-1 text-xs text-[#615d59]">Opsional. Gunakan kode kota/provinsi umum, jangan masukkan koordinat atau alamat di kolom ini.</p></div>
                </div>
              </details>
              <div className="sm:col-span-2"><Label htmlFor="meeting-instructions">Petunjuk bertemu</Label><textarea id="meeting-instructions" name="meeting_instructions" maxLength={1000} rows={3} className={`${field} h-auto resize-y py-2 placeholder:text-[#615d59]`} placeholder="Contoh: tunggu di lobi utama 15 menit sebelum mulai" /></div>
            </div>
          </details>
        </div>
      </WorkspaceFormSection>
      <div className="px-5 py-5 sm:px-8">
        {error && <p className="mb-3 rounded-lg bg-rose-50 p-4 text-sm font-medium text-rose-800" role="alert">{error}</p>}
        <div className="flex sm:justify-end">
          <Button type="submit" disabled={saving || activities.length === 0 || (priceOptionsEnabled&&!priceOptionsValid)} className={`${workspaceFormAction} w-full sm:w-fit`}>{saving ? 'Membuat event…' : 'Buat event'}</Button>
        </div>
      </div>
    </form>}
    {error && (loading || workspaces.length === 0) && <p className="px-5 py-6 sm:px-8 text-sm font-medium text-rose-800" role="alert">{error}</p>}
  </div>;
}
