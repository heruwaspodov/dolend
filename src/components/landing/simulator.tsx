'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Copy, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { workspaceFormChoice, workspaceFormControl, workspaceFormPanel } from '@/components/organizer/workspace-form';
import { cn } from '@/lib/utils';
import { categories, defaultDemo, demoLink, rupiah, validConfig, type DemoConfig, type Policy } from './content';

const policies: { id: Policy; name: string; description: string; summary: string }[] = [
  { id: 'lunas', name: 'Wajib Lunas di Awal', description: 'Peserta mendapat tempat setelah bayar lunas.', summary: 'Bayar lunas di awal' },
  { id: 'dp', name: 'DP 50% di Awal', description: 'Peserta mendapat tempat setelah bayar uang muka 50%.', summary: 'Uang muka 50%' },
  { id: 'nanti', name: 'Catat Bayar di Lokasi', description: 'Peserta mendapat tempat saat mendaftar dan bayar saat bertemu.', summary: 'Bayar di lokasi' },
];
const names = ['Kamu (Penyelenggara)', 'Teman 1', 'Teman 2'];
export function Simulator({ contentWidth }: { contentWidth: string }) {
  const [config, setConfig] = useState<DemoConfig>(defaultDemo);
  const [notice, setNotice] = useState('');
  const manualLink = useRef<HTMLDetailsElement>(null);
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
  const paymentRequiredForSlot = total > 0 && config.policy !== 'nanti';
  const confirmed = valid ? sample.filter((_, index) => !paymentRequiredForSlot || config.paid[index]).length : 0;
  const link = valid ? demoLink(config) : '';
  const copyLink = async () => {
    try {
      if (!navigator.clipboard) throw new Error();
      await navigator.clipboard.writeText(link);
      if (manualLink.current) manualLink.current.open = false;
      setNotice('Tautan simulasi berhasil disalin.');
    } catch {
      if (manualLink.current) manualLink.current.open = true;
      linkInput.current?.focus();
      linkInput.current?.select();
      setNotice('Penyalinan otomatis tidak tersedia. Salin tautan yang sudah dipilih.');
    }
  };
  return <section id="simulasi" className="scroll-mt-16 border-y border-[#e6e3df] bg-[#f8f7f4] py-12 sm:py-16" aria-labelledby="simulator-title">
    <div className={contentWidth}>
      <div className="mb-6 max-w-xl sm:mb-8">
        <h2 id="simulator-title" className="text-2xl font-bold tracking-tight sm:text-3xl">Hitung patungan</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#514e4a] sm:text-base">Masukkan total biaya dan kuota. Lihat patungan per orang jika semua tempat terisi.</p>
      </div>
      <div className="grid items-start gap-x-6 gap-y-5 lg:grid-cols-2">
        <div className={cn(workspaceFormPanel, 'min-w-0 space-y-4 divide-y-0 rounded-xl p-4 sm:p-6')}>
          <h3 className="text-base font-semibold">Biaya dan kuota</h3>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="min-w-0 space-y-2"><Label htmlFor="demo-cost">Total biaya (Rp)</Label><Input id="demo-cost" type="number" min={0} max={1e12} step={1} inputMode="numeric" value={config.cost} onChange={event => update('cost', event.target.value)} aria-invalid={!/^\d{1,13}$/.test(config.cost) || Number(config.cost) > 1e12} aria-describedby={!valid ? 'demo-validation' : undefined} className={workspaceFormControl} /></div>
            <div className="min-w-0 space-y-2"><Label htmlFor="demo-capacity">Kuota peserta</Label><Input id="demo-capacity" type="number" min={2} max={30} step={1} inputMode="numeric" value={config.capacity} onChange={event => update('capacity', event.target.value)} aria-invalid={!/^\d{1,2}$/.test(config.capacity) || Number(config.capacity) < 2 || Number(config.capacity) > 30} aria-describedby={!valid ? 'demo-validation' : undefined} className={workspaceFormControl} /></div>
          </div>
          {!valid && <p role="alert" id="demo-validation" className="text-sm text-red-700">Isi biaya dengan rupiah bulat antara 0–1 triliun dan kuota antara 2–30 orang.</p>}
          <div className="border-t border-[#e6e3df] pt-4">
            <p className="text-sm font-medium text-[#514e4a]">Patungan per orang</p>
            <p className="mt-1 text-2xl font-bold wrap-anywhere text-[#005bab] tabular-nums" aria-live="polite" aria-atomic="true" data-testid="demo-quick-total">
              {valid ? rupiah(perPerson) : '—'}
            </p>
          </div>
          <p className="text-xs leading-relaxed text-[#514e4a]">Patungan dibulatkan ke atas dalam rupiah.</p>
        </div>

        <section id="contoh-undangan" aria-labelledby="demo-preview-title" className={cn(workspaceFormPanel, 'min-w-0 scroll-mt-20 divide-y-0 rounded-xl p-4 sm:p-6')}>
          <h3 id="demo-preview-title" className="text-base font-semibold">Pratinjau undangan</h3>
          <div className="mt-4 flex items-center gap-3">
            <Image src={category.banner} alt="" width={72} height={56} className="h-14 w-[72px] shrink-0 rounded-lg object-cover" />
            <div className="min-w-0">
              <p className="text-xs text-[#615d59]">{category.name}</p>
              <h4 className="mt-0.5 wrap-anywhere font-bold" data-testid="demo-preview-venue">{config.venue.trim() || 'Nama tempat'}</h4>
              <p className="mt-0.5 wrap-anywhere text-sm text-[#514e4a]" data-testid="demo-preview-schedule">{config.schedule.trim() || 'Jadwal kegiatan'}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#e6e3df] pt-4">
            <div className="min-w-0">
              <p className="text-xs text-[#615d59]">Total biaya</p>
              <p className="mt-1 wrap-anywhere text-sm font-semibold tabular-nums" data-testid="demo-total">{valid ? rupiah(total) : '—'}</p>
            </div>
            <div className="min-w-0 border-l border-[#e6e3df] pl-3">
              <p className="text-xs text-[#615d59]">Patungan per orang</p>
              <p className="mt-1 wrap-anywhere text-sm font-bold text-[#005bab] tabular-nums" data-testid="demo-per-person">{valid ? rupiah(perPerson) : '—'}</p>
            </div>
          </div>
          {config.policy === 'dp' && <p className="mt-3 text-sm leading-relaxed text-[#514e4a]" data-testid="demo-dp">DP per orang: <strong>{valid ? rupiah(upfront) : '—'}</strong> · Sisa pelunasan: <strong>{valid ? rupiah(perPerson - upfront) : '—'}</strong></p>}
          <div className="mt-4 border-t border-[#e6e3df] pt-3">
            <div className="mb-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm">
              <span>{valid && total === 0 ? 'Gratis' : policy.summary}</span>
              <span className="font-semibold text-[#005bab] tabular-nums" data-testid="demo-quota">{confirmed} / {valid ? capacity : '—'} terisi</span>
            </div>
            <div role="progressbar" aria-label="Kuota simulasi terisi" aria-valuemin={0} aria-valuemax={valid ? capacity : 30} aria-valuenow={confirmed} className="h-2 overflow-hidden rounded-full bg-[#e6e3df]">
              <div style={{ width: `${valid ? confirmed / capacity * 100 : 0}%` }} className="h-full rounded-full bg-[#006bc9] transition-[width] motion-reduce:transition-none" />
            </div>
          </div>
        </section>

        <details id="kategori" className={cn(workspaceFormPanel, 'group min-w-0 scroll-mt-20 divide-y-0 rounded-xl px-4 sm:px-6')}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-semibold marker:hidden">
            Sesuaikan contoh undangan
            <ChevronDown className="size-4 shrink-0 motion-safe:transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="space-y-5 border-t border-[#e6e3df] pt-4 pb-5">
            <fieldset><legend className="mb-2 text-sm font-semibold">Jenis kegiatan</legend>
              <div className="grid grid-cols-2 gap-2">{categories.map(({ id, name, icon: Icon }) => <Button key={id} type="button" variant="outline" aria-pressed={config.category === id} onClick={() => update('category', id)} className={cn('h-auto min-h-11 justify-start gap-2 whitespace-normal px-2.5 py-2 text-left text-sm', config.category === id && 'border-[#006bc9] bg-[#edf5ff] text-[#004780]')}><Icon aria-hidden="true" className="size-4 shrink-0" />{name}</Button>)}</div>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-2"><Label htmlFor="demo-venue">Nama tempat</Label><Input id="demo-venue" maxLength={120} value={config.venue} onChange={event => update('venue', event.target.value)} className={workspaceFormControl} /></div>
              <div className="min-w-0 space-y-2"><Label htmlFor="demo-schedule">Jadwal main</Label><Input id="demo-schedule" maxLength={120} value={config.schedule} onChange={event => update('schedule', event.target.value)} className={workspaceFormControl} /></div>
            </div>
            <fieldset className="space-y-2"><legend className="mb-2 text-sm font-semibold">Cara bayar dalam simulasi</legend>
              {policies.map(item => <label key={item.id} className={cn(workspaceFormChoice, 'flex cursor-pointer items-center gap-3 p-3')}><input type="radio" name="demo-policy" value={item.id} checked={config.policy === item.id} onChange={() => update('policy', item.id)} className="size-4 shrink-0 accent-[#006bc9]" /><span><span className="block text-sm font-semibold">{item.name}</span><span className="mt-1 block text-sm leading-relaxed text-[#514e4a]">{item.description}</span></span></label>)}
            </fieldset>
          </div>
        </details>

        <div className="min-w-0 divide-y divide-[#e6e3df] rounded-xl border border-[#e6e3df] bg-white px-4 sm:px-6">
          {(!valid || total > 0) && (
            <section aria-labelledby="demo-payments-title" className="py-4">
              <h3 id="demo-payments-title" className="text-base font-semibold">Pembayaran peserta contoh</h3>
              <p className="mt-1 text-sm leading-relaxed text-[#514e4a]">
                {!valid
                  ? 'Perbaiki biaya dan kuota untuk mencoba status pembayaran.'
                  : paymentRequiredForSlot
                    ? `Ubah status pembayaran untuk melihat kuota. Tempat terisi setelah peserta ${config.policy === 'dp' ? 'bayar uang muka' : 'bayar lunas'}.`
                    : 'Ubah status pembayaran. Peserta tetap dihitung dalam kuota.'}
              </p>
              <ul className="mt-2 divide-y divide-[#e6e3df]">
                {sample.map((name, index) => (
                  <li key={name} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="min-w-0 wrap-anywhere text-sm">{name}</span>
                    <Button
                      type="button"
                      variant="outline"
                      aria-label={`Ubah status ${name}`}
                      aria-pressed={config.paid[index]}
                      disabled={!valid}
                      onClick={() => update('paid', config.paid.map((value, position) => position === index ? !value : value))}
                      className="min-h-11 shrink-0 px-3 text-xs"
                    >
                      {config.paid[index] ? (config.policy === 'dp' ? 'Sudah bayar DP' : 'Lunas') : 'Belum bayar'}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="demo-share-title" className="py-4">
            <h3 id="demo-share-title" className="text-base font-semibold">Bagikan simulasi</h3>
            <p className="mt-1 text-sm leading-relaxed text-[#514e4a]">Teman bisa membuka simulasi yang sama. Untuk daftar atau melihat petunjuk bayar, gunakan undangan aktif.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={copyLink} disabled={!valid} className="min-h-11 px-3">
                <Copy aria-hidden="true" />Salin tautan
              </Button>
              {valid && <Button asChild variant="outline" className="min-h-11 px-3"><a href={`https://wa.me/?text=${encodeURIComponent(`Coba simulasi rencana bareng di Dolend (bukan undangan aktif): ${link}`)}`} target="_blank" rel="noopener noreferrer" aria-label="Bagikan simulasi ke WhatsApp"><MessageCircle aria-hidden="true" />Bagikan ke WhatsApp</a></Button>}
            </div>
            <details ref={manualLink} hidden={!valid} className="mt-1">
              <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-medium text-[#005bab] marker:hidden">Tampilkan tautan</summary>
              <Label htmlFor="demo-link" className="sr-only">Tautan simulasi</Label>
              <Input id="demo-link" ref={linkInput} readOnly value={link} className={workspaceFormControl} />
            </details>
            <p role="status" className={cn('text-sm font-medium text-[#005bab]', notice && 'mt-2')}>{notice}</p>
          </section>
        </div>
      </div>
    </div>
  </section>;
}
