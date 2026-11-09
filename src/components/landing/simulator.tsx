'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, Check, ChevronDown, Copy, Link2, LockKeyhole, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { workspaceFormChoice, workspaceFormControl, workspaceFormPanel } from '@/components/organizer/workspace-form';
import { cn } from '@/lib/utils';
import { categories, defaultDemo, demoLink, rupiah, validConfig, type DemoConfig, type Policy } from './content';

const policies: { id: Policy; name: string; description: string; badge: string }[] = [
  { id: 'lunas', name: 'Wajib Lunas di Awal', description: 'Simulasikan slot terkonfirmasi setelah peserta membayar lunas.', badge: 'LUNAS DI AWAL' },
  { id: 'dp', name: 'DP 50% di Awal', description: 'Coba ilustrasi uang muka dan sisa pelunasan per peserta.', badge: 'DP 50% DI AWAL' },
  { id: 'nanti', name: 'Catat Bayar di Lokasi', description: 'Peserta mengonfirmasi tempat lebih dulu, lalu membayar saat bertemu.', badge: 'BAYAR DI LOKASI' },
];
const names = ['Kamu (Penyelenggara)', 'Teman 1', 'Teman 2'];
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
  return <section id="simulasi" className="scroll-mt-16 border-y border-[#e6e3df] bg-[#f8f7f4] py-12 sm:py-16" aria-labelledby="simulator-title">
    <div className="mx-auto w-[calc(100%-2.5rem)] max-w-7xl sm:w-[calc(100%-4rem)]">
      <div className="mb-6 max-w-xl sm:mb-8">
        <h2 id="simulator-title" className="text-2xl font-bold tracking-tight sm:text-3xl">Coba hitung patungan</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#514e4a] sm:text-base">Ubah biaya dan kuota untuk melihat perkiraan iuran per orang saat kuota penuh.</p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2 lg:gap-6">
        <div className={cn(workspaceFormPanel, 'min-w-0 space-y-4 divide-y-0 p-4 sm:p-6')}>
          <h3 className="text-base font-semibold">Biaya dan kuota</h3>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="min-w-0 space-y-2"><Label htmlFor="demo-cost">Total biaya (Rp)</Label><Input id="demo-cost" type="number" min={0} max={1e12} step={1} inputMode="numeric" value={config.cost} onChange={event => update('cost', event.target.value)} aria-invalid={!/^\d{1,13}$/.test(config.cost) || Number(config.cost) > 1e12} aria-describedby={!valid ? 'demo-validation' : undefined} className={workspaceFormControl} /></div>
            <div className="min-w-0 space-y-2"><Label htmlFor="demo-capacity">Kuota peserta</Label><Input id="demo-capacity" type="number" min={2} max={30} step={1} inputMode="numeric" value={config.capacity} onChange={event => update('capacity', event.target.value)} aria-invalid={!/^\d{1,2}$/.test(config.capacity) || Number(config.capacity) < 2 || Number(config.capacity) > 30} aria-describedby={!valid ? 'demo-validation' : undefined} className={workspaceFormControl} /></div>
          </div>
          {!valid && <p role="alert" id="demo-validation" className="text-sm text-red-700">Isi biaya dengan rupiah bulat antara 0–1 triliun dan kuota antara 2–30 orang.</p>}
          <div className="rounded-lg bg-[#edf5ff] px-4 py-3">
            <p className="text-sm font-medium text-[#004780]">Patungan per orang</p>
            <p className="mt-1 text-xl font-bold wrap-anywhere text-[#004780] tabular-nums" aria-live="polite" aria-atomic="true" data-testid="demo-quick-total">
              {valid ? rupiah(perPerson) : '—'}
            </p>
          </div>
          <details id="kategori" className="group scroll-mt-20 border-t border-[#e6e3df]">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-2 text-sm font-semibold marker:hidden">
              Sesuaikan contoh undangan
              <ChevronDown className="size-4 shrink-0 motion-safe:transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="space-y-5 pt-2 pb-3">
              <fieldset><legend className="mb-2 text-sm font-semibold">Jenis kegiatan</legend>
                <div className="grid grid-cols-2 gap-2">{categories.map(({ id, name, icon: Icon }) => <Button key={id} type="button" variant="outline" aria-pressed={config.category === id} onClick={() => update('category', id)} className={cn('h-auto min-h-11 justify-start gap-2 whitespace-normal px-2.5 py-2 text-left text-xs', config.category === id && 'border-[#006bc9] bg-[#edf5ff] text-[#004780]')}><Icon aria-hidden="true" className="size-4 shrink-0" />{name}</Button>)}</div>
              </fieldset>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-2"><Label htmlFor="demo-venue">Nama tempat</Label><Input id="demo-venue" maxLength={120} value={config.venue} onChange={event => update('venue', event.target.value)} className={workspaceFormControl} /></div>
                <div className="min-w-0 space-y-2"><Label htmlFor="demo-schedule">Jadwal main</Label><Input id="demo-schedule" maxLength={120} value={config.schedule} onChange={event => update('schedule', event.target.value)} className={workspaceFormControl} /></div>
              </div>
              <fieldset className="space-y-2"><legend className="mb-2 text-sm font-semibold">Cara bayar dalam simulasi</legend>
                {policies.map(item => <label key={item.id} className={cn(workspaceFormChoice, 'flex cursor-pointer items-center gap-3 p-3')}><input type="radio" name="demo-policy" value={item.id} checked={config.policy === item.id} onChange={() => update('policy', item.id)} className="size-4 shrink-0 accent-[#006bc9]" /><span><span className="block text-xs font-bold">{item.name}</span><span className="mt-1 block text-xs leading-relaxed text-[#514e4a]">{item.description}</span></span></label>)}
              </fieldset>
            </div>
          </details>
          <a href="#contoh-undangan" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#005bab] underline-offset-4 hover:underline lg:hidden">Lihat contoh undangan <ArrowDown className="size-4" aria-hidden="true" /></a>
        </div>
        <div id="contoh-undangan" className="min-w-0 scroll-mt-20 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold">Tampilan untuk peserta</h3>
            <span className="rounded-md bg-[#edf5ff] px-2 py-1 text-xs font-semibold text-[#004780]">Simulasi</span>
          </div>
          <Card className="gap-0 overflow-hidden border-[#e6e3df] bg-white py-0 shadow-none">
            <div className="relative isolate flex min-h-44 flex-col justify-between gap-8 bg-slate-950 p-4 sm:min-h-48"><Image src={category.banner} alt="" fill sizes="(min-width: 1024px) 588px, 100vw" className="-z-20 object-cover" /><div className="absolute inset-0 -z-10 bg-linear-to-t from-slate-950 via-slate-950/40 to-slate-950/5" />
              <div className="flex flex-wrap items-start justify-between gap-2"><span className="rounded-md bg-white/95 px-2.5 py-1 text-[10px] font-extrabold text-slate-900 uppercase">{category.name}</span><span className={cn('rounded-md px-2.5 py-1 text-[10px] font-bold text-white', config.policy === 'nanti' ? 'bg-amber-700' : 'bg-[#005bab]')}>{policy.badge}</span></div>
              <div className="text-white"><h4 className="wrap-anywhere text-lg leading-tight font-bold" data-testid="demo-preview-venue">{config.venue.trim() || 'Nama venue'}</h4><p className="mt-1 wrap-anywhere text-xs text-[#e6e3df]" data-testid="demo-preview-schedule">{config.schedule.trim() || 'Jadwal kegiatan'}</p></div>
            </div>
            <CardContent className="space-y-5 p-5">
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#e6e3df]/80 bg-[#f6f5f4] p-3"><div className="min-w-0"><span className="block text-xs text-[#514e4a]">Total biaya</span><p className="mt-1 wrap-anywhere text-sm font-bold" data-testid="demo-total">{valid ? rupiah(total) : '—'}</p></div><div className="min-w-0 border-l border-[#e6e3df] pl-3 text-right"><span className="block text-xs text-[#514e4a]">Patungan per orang</span><p className="mt-1 wrap-anywhere text-base font-extrabold text-[#005bab]" data-testid="demo-per-person">{valid ? rupiah(perPerson) : '—'}</p></div></div>
              {config.policy === 'dp' && <div className="rounded-lg bg-cyan-50 p-3 text-xs leading-relaxed text-cyan-900" data-testid="demo-dp">DP per orang: <strong>{valid ? rupiah(upfront) : '—'}</strong> · Sisa pelunasan: <strong>{valid ? rupiah(perPerson - upfront) : '—'}</strong></div>}
              <div><div className="mb-2 flex justify-between gap-2 text-xs font-semibold"><span>Kuota terkonfirmasi</span><span className="text-[#005bab]" data-testid="demo-quota">{confirmed} / {valid ? capacity : '—'} terisi</span></div><div role="progressbar" aria-label="Kuota simulasi terkonfirmasi" aria-valuemin={0} aria-valuemax={valid ? capacity : 30} aria-valuenow={confirmed} className="h-2 overflow-hidden rounded-full border border-[#e6e3df] bg-slate-100"><div style={{ width: `${valid ? confirmed / capacity * 100 : 0}%` }} className="h-full rounded-full bg-[#006bc9] transition-[width] motion-reduce:transition-none" /></div><p className="mt-2 text-xs leading-relaxed text-[#514e4a]">{config.policy === 'nanti' || total === 0 ? 'Peserta contoh langsung mengisi kuota.' : 'Hanya status lunas atau DP pada simulasi yang mengisi kuota.'}</p></div>
              <div className="space-y-2 border-t border-slate-100 pt-4"><h5 className="text-xs font-bold text-slate-700">Status peserta contoh</h5><p className="text-xs text-[#514e4a]">Klik status untuk mencoba perubahan kuota.</p>
                {sample.map((name, index) => <div key={name} className="flex items-center justify-between gap-2 rounded-lg border border-[#e6e3df]/70 bg-[#f6f5f4] p-2"><span className="flex min-w-0 items-center gap-2 text-xs"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#e6e3df] text-[10px] font-bold text-slate-600" aria-hidden="true">{index === 0 ? 'K' : index}</span><span className="min-w-0 wrap-anywhere">{name}</span></span><Button type="button" size="sm" aria-label={`Ubah status ${name}`} aria-pressed={config.paid[index]} onClick={() => update('paid', config.paid.map((value, position) => position === index ? !value : value))} className={cn('min-h-11 shrink-0 px-2 text-[10px] font-bold', config.paid[index] ? 'bg-[#dcecff] text-[#004780] hover:bg-blue-200' : 'bg-amber-100 text-amber-800 hover:bg-amber-200')}>{config.paid[index] ? <><Check className="size-3" aria-hidden="true" />{config.policy === 'dp' ? 'DP 50%' : 'LUNAS'}</> : 'BELUM BAYAR'}</Button></div>)}
              </div>
              <div className="space-y-2 border-t border-slate-100 pt-4"><Label htmlFor="demo-link" className="text-xs"><Link2 className="size-3.5" aria-hidden="true" />Tautan simulasi</Label><div className="flex flex-wrap gap-2"><Input id="demo-link" ref={linkInput} readOnly value={link} placeholder="Lengkapi angka yang valid" className="min-h-11 min-w-0 flex-1 basis-40 bg-[#f6f5f4] text-xs" /><Button type="button" onClick={copyLink} disabled={!valid} className="min-h-11 bg-[#006bc9] text-white hover:bg-[#005bab]"><Copy aria-hidden="true" />Salin Link</Button></div>
                {valid && <Button asChild variant="outline" className="min-h-11 w-full"><a href={`https://wa.me/?text=${encodeURIComponent(`Coba simulasi rencana bareng di Dolend (bukan undangan aktif): ${link}`)}`} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />Bagikan simulasi ke WhatsApp</a></Button>}
                <p className="flex items-start gap-1.5 text-xs leading-relaxed text-[#514e4a]"><LockKeyhole className="mt-0.5 size-3 shrink-0" aria-hidden="true" />Tautan ini membuka simulasi yang sama. Teman belum bisa mendaftar atau membayar lewat tautan ini.</p>
              </div>
              <p className="text-xs leading-relaxed text-[#514e4a]">Patungan dibulatkan ke atas ke rupiah penuh. DP di sini hanya contoh.</p>
            </CardContent>
          </Card>
          <p role="status" aria-live="polite" className="min-h-5 text-sm font-medium text-[#004780]">{notice}</p>
        </div>
      </div>
    </div>
  </section>;
}
