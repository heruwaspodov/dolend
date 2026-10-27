'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Link2, LockKeyhole, MessageCircle, SlidersHorizontal, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { categories, defaultDemo, demoLink, rupiah, validConfig, type DemoConfig, type Policy } from './content';

const policies: { id: Policy; name: string; description: string; badge: string }[] = [
  { id: 'lunas', name: 'Wajib Lunas di Awal', description: 'Simulasikan slot terkonfirmasi setelah peserta membayar lunas.', badge: 'LUNAS DI AWAL' },
  { id: 'dp', name: 'DP 50% di Awal', description: 'Coba ilustrasi uang muka dan sisa pelunasan per peserta.', badge: 'DP 50% DI AWAL' },
  { id: 'nanti', name: 'Catat Bayar di Lokasi', description: 'Peserta mengonfirmasi tempat lebih dulu, lalu membayar saat bertemu.', badge: 'BAYAR DI LOKASI' },
];
const names = ['Kamu (Organizer)', 'Rizky Pratama', 'Siti Aulia'];
export function Simulator() {
  const [config, setConfig] = useState<DemoConfig>(defaultDemo);
  const [notice, setNotice] = useState('');
  const linkInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const restore = () => {
      if (!window.location.hash.startsWith('#simulasi?demo=')) return;
      try {
        if (window.location.hash.length > 4000) throw new Error();
        const raw = new URLSearchParams(window.location.hash.split('?')[1]).get('demo');
        const data: unknown = JSON.parse(raw ?? 'null');
        if (!validConfig(data)) throw new Error();
        // Copy only known fields: shared links cannot inject arbitrary properties or URLs.
        setConfig({ category: data.category, venue: data.venue, schedule: data.schedule, cost: data.cost, capacity: data.capacity, policy: data.policy, paid: [...data.paid] });
        document.getElementById('simulasi')?.scrollIntoView({ behavior: 'instant' });
      } catch { setNotice('Tautan simulasi tidak valid. Kamu tetap bisa mencoba contoh di bawah.'); }
    };
    const initial = requestAnimationFrame(restore);
    window.addEventListener('hashchange', restore);
    return () => { cancelAnimationFrame(initial); window.removeEventListener('hashchange', restore); };
  }, []);
  const update = <K extends keyof DemoConfig>(key: K, value: DemoConfig[K]) => {
    setConfig(current => ({ ...current, [key]: value }));
    setNotice('');
  };
  const valid = validConfig(config);
  const category = categories.find(item => item.id === config.category)!;
  const policy = policies.find(item => item.id === config.policy)!;
  const capacity = valid ? Number(config.capacity) : 0;
  const total = valid ? Number(config.cost) : 0;
  const perPerson = valid ? Math.ceil(total / capacity) : 0;
  const upfront = config.policy === 'dp' ? Math.ceil(perPerson / 2) : config.policy === 'nanti' ? 0 : perPerson;
  const sample = names.slice(0, valid ? Math.min(3, capacity) : 3);
  const confirmed = valid ? sample.filter((_, index) => total === 0 || config.policy === 'nanti' || config.paid[index]).length : 0;
  const link = valid ? demoLink(config) : '';
  const copyLink = async () => {
    try {
      if (!navigator.clipboard) throw new Error();
      await navigator.clipboard.writeText(link);
      setNotice('Tautan simulasi berhasil disalin.');
    } catch {
      linkInput.current?.focus(); linkInput.current?.select();
      setNotice('Penyalinan otomatis tidak tersedia. Salin tautan pada kotak di atas.');
    }
  };
  return <section id="simulasi" className="scroll-mt-20 border-y border-slate-200 bg-white py-16 sm:py-20" aria-labelledby="simulator-title">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <p className="text-xs font-bold tracking-widest text-emerald-700 uppercase">Simulasi interaktif</p>
        <h2 id="simulator-title" className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Coba Hitung & Buat Undangan Event</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">Isi rencana kamu, lalu lihat ilustrasi patungan dan tampilan undangannya. Semua perubahan di sini hanya simulasi, tanpa pendaftaran atau transaksi sungguhan.</p>
      </div>
      <div className="mx-auto grid max-w-6xl items-start gap-8 lg:grid-cols-2">
        <div className="min-w-0 space-y-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
          <div className="border-b border-slate-200 pb-4"><h3 className="flex items-center gap-2 text-lg font-bold"><SlidersHorizontal className="size-5 text-emerald-600" aria-hidden="true" />Pengaturan Event</h3><p className="mt-1 text-xs text-slate-500">Tentukan tempat, kuota, dan skema patungan contoh.</p></div>
          <fieldset><legend className="mb-3 text-xs font-bold tracking-wider text-slate-700 uppercase">Pilih jenis kegiatan</legend>
            <div className="grid grid-cols-2 gap-2">{categories.map(({ id, name, icon: Icon }) => <Button key={id} type="button" variant="outline" aria-pressed={config.category === id} onClick={() => update('category', id)} className={cn('h-auto min-h-12 justify-start gap-2 whitespace-normal px-3 py-3 text-left text-xs', config.category === id && 'border-emerald-600 bg-emerald-50 text-emerald-800')}><Icon aria-hidden="true" className="size-4 shrink-0" />{name}</Button>)}</div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="demo-venue">Nama Tempat / Venue</Label><Input id="demo-venue" maxLength={120} value={config.venue} onChange={event => update('venue', event.target.value)} className="min-h-11 bg-white" /></div>
            <div className="space-y-2"><Label htmlFor="demo-schedule">Jadwal Main</Label><Input id="demo-schedule" maxLength={120} value={config.schedule} onChange={event => update('schedule', event.target.value)} className="min-h-11 bg-white" /></div>
            <div className="space-y-2"><Label htmlFor="demo-cost">Total Biaya Venue (Rp)</Label><Input id="demo-cost" type="number" min={0} max={1e12} step={1} inputMode="numeric" value={config.cost} onChange={event => update('cost', event.target.value)} aria-invalid={!/^\d{1,13}$/.test(config.cost) || Number(config.cost) > 1e12} aria-describedby={!valid ? 'demo-validation' : undefined} className="min-h-11 bg-white" /></div>
            <div className="space-y-2"><Label htmlFor="demo-capacity">Maksimal Kuota (Orang)</Label><Input id="demo-capacity" type="number" min={2} max={30} step={1} inputMode="numeric" value={config.capacity} onChange={event => update('capacity', event.target.value)} aria-invalid={!/^\d{1,2}$/.test(config.capacity) || Number(config.capacity) < 2 || Number(config.capacity) > 30} aria-describedby={!valid ? 'demo-validation' : undefined} className="min-h-11 bg-white" /></div>
          </div>
          {!valid && <p role="alert" id="demo-validation" className="text-sm text-red-700">Isi biaya dengan rupiah bulat antara 0–1 triliun dan kuota antara 2–30 orang.</p>}
          <fieldset className="space-y-2"><legend className="mb-3 text-xs font-bold tracking-wider text-slate-700 uppercase">Aturan pembayaran peserta · simulasi</legend>
            {policies.map(item => <label key={item.id} className={cn('flex min-h-16 cursor-pointer items-center gap-3 rounded-lg border bg-white p-3', config.policy === item.id ? 'border-emerald-600' : 'border-slate-200')}><input type="radio" name="demo-policy" value={item.id} checked={config.policy === item.id} onChange={() => update('policy', item.id)} className="size-4 shrink-0 accent-emerald-600" /><span><span className="block text-xs font-bold">{item.name}</span><span className="mt-1 block text-xs leading-relaxed text-slate-500">{item.description}</span></span></label>)}
          </fieldset>
        </div>
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-slate-700 uppercase"><Smartphone className="size-4 text-emerald-600" aria-hidden="true" />Preview Web Peserta</h3><span className="rounded bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-800">Simulasi langsung</span></div>
          <Card className="gap-0 overflow-hidden border-slate-200 bg-white py-0 shadow-lg">
            <div className="relative h-48"><Image src={category.banner} alt="" fill sizes="(max-width: 1024px) 100vw, 540px" className="object-cover" /><div className="absolute inset-0 bg-linear-to-t from-slate-950/90 via-slate-900/10 to-transparent" />
              <div className="absolute inset-x-3 top-3 flex flex-wrap justify-between gap-2"><span className="rounded-md bg-white/95 px-2.5 py-1 text-[10px] font-extrabold text-slate-900 uppercase">{category.name}</span><span className={cn('rounded-md px-2.5 py-1 text-[10px] font-bold text-white', config.policy === 'dp' ? 'bg-cyan-700' : config.policy === 'nanti' ? 'bg-amber-700' : 'bg-emerald-700')}>{policy.badge}</span></div>
              <div className="absolute inset-x-4 bottom-4 text-white"><h4 className="wrap-anywhere text-lg leading-tight font-bold" data-testid="demo-preview-venue">{config.venue.trim() || 'Nama venue'}</h4><p className="mt-1 wrap-anywhere text-xs text-slate-200" data-testid="demo-preview-schedule">{config.schedule.trim() || 'Jadwal kegiatan'}</p></div>
            </div>
            <CardContent className="space-y-5 p-5">
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200/80 bg-slate-50 p-3"><div className="min-w-0"><span className="block text-[11px] text-slate-500">Total Biaya Tempat</span><p className="mt-1 wrap-anywhere text-sm font-bold" data-testid="demo-total">{valid ? rupiah(total) : '—'}</p></div><div className="min-w-0 border-l border-slate-200 pl-3 text-right"><span className="block text-[11px] text-slate-500">Patungan Per Orang</span><p className="mt-1 wrap-anywhere text-base font-extrabold text-emerald-700" data-testid="demo-per-person">{valid ? rupiah(perPerson) : '—'}</p></div></div>
              {config.policy === 'dp' && <div className="rounded-lg bg-cyan-50 p-3 text-xs leading-relaxed text-cyan-900" data-testid="demo-dp">DP per orang: <strong>{valid ? rupiah(upfront) : '—'}</strong> · Sisa pelunasan: <strong>{valid ? rupiah(perPerson - upfront) : '—'}</strong></div>}
              <div><div className="mb-2 flex justify-between gap-2 text-xs font-semibold"><span>Kuota terkonfirmasi</span><span className="text-emerald-700" data-testid="demo-quota">{confirmed} / {valid ? capacity : '—'} terisi</span></div><div role="progressbar" aria-label="Kuota simulasi terkonfirmasi" aria-valuemin={0} aria-valuemax={valid ? capacity : 30} aria-valuenow={confirmed} className="h-2 overflow-hidden rounded-full border border-slate-200 bg-slate-100"><div style={{ width: `${valid ? confirmed / capacity * 100 : 0}%` }} className="h-full rounded-full bg-emerald-500 transition-[width] motion-reduce:transition-none" /></div><p className="mt-2 text-[11px] leading-relaxed text-slate-500">{config.policy === 'nanti' || total === 0 ? 'Peserta contoh langsung mengisi kuota.' : 'Hanya status lunas atau DP pada simulasi yang mengisi kuota.'}</p></div>
              <div className="space-y-2 border-t border-slate-100 pt-4"><h5 className="text-xs font-bold text-slate-700">Simulasi Status Peserta</h5><p className="text-[11px] text-slate-500">Klik status untuk mencoba perubahan kuota.</p>
                {sample.map((name, index) => <div key={name} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/70 bg-slate-50 p-2"><span className="flex min-w-0 items-center gap-2 text-xs"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600" aria-hidden="true">{index === 0 ? 'K' : index === 1 ? 'RP' : 'SA'}</span><span className="min-w-0 wrap-anywhere">{name}</span></span><Button type="button" size="sm" aria-label={`Ubah status ${name}`} aria-pressed={config.paid[index]} onClick={() => update('paid', config.paid.map((value, position) => position === index ? !value : value))} className={cn('min-h-11 shrink-0 px-2 text-[10px] font-bold', config.paid[index] ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-amber-100 text-amber-800 hover:bg-amber-200')}>{config.paid[index] ? <><Check className="size-3" aria-hidden="true" />{config.policy === 'dp' ? 'DP 50%' : 'LUNAS'}</> : 'BELUM BAYAR'}</Button></div>)}
              </div>
              <div className="space-y-2 border-t border-slate-100 pt-4"><Label htmlFor="demo-link" className="text-xs"><Link2 className="size-3.5" aria-hidden="true" />Tautan simulasi</Label><div className="flex flex-wrap gap-2"><Input id="demo-link" ref={linkInput} readOnly value={link} placeholder="Lengkapi angka yang valid" className="min-h-11 min-w-0 flex-1 basis-40 bg-slate-50 text-xs" /><Button type="button" onClick={copyLink} disabled={!valid} className="min-h-11 bg-emerald-600 text-white hover:bg-emerald-700"><Copy aria-hidden="true" />Salin Link</Button></div>
                {valid && <Button asChild variant="outline" className="min-h-11 w-full"><a href={`https://wa.me/?text=${encodeURIComponent(`Coba simulasi rencana bareng di Dolend (bukan undangan aktif): ${link}`)}`} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />Bagikan simulasi ke WhatsApp</a></Button>}
                <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500"><LockKeyhole className="mt-0.5 size-3 shrink-0" aria-hidden="true" />Tautan hanya membuka simulasi ini. Tidak membuat event, menyimpan peserta, atau menerima pembayaran.</p>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">Patungan dibulatkan ke atas ke rupiah penuh. Contoh DP hanya ilustrasi; fitur pembayaran belum aktif.</p>
            </CardContent>
          </Card>
          <p role="status" aria-live="polite" className="min-h-5 text-sm font-medium text-emerald-800">{notice}</p>
        </div>
      </div>
    </div>
  </section>;
}
