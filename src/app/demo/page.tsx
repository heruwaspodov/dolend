'use client';

import { useState } from 'react';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Activity = { title: string; venue: string; date: string; capacity: number; cost: number; timing: string };
const rupiah = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);

export default function DemoPage() {
  const [tab, setTab] = useState<'create' | 'detail' | 'dashboard'>('create');
  const [activity, setActivity] = useState<Activity | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [expired, setExpired] = useState(false);
  const full = !!activity && members.length >= activity.capacity;
  const dateLabel = activity ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(`${activity.date}+07:00`)) : '';
  function create(form: FormData) {
    const date = String(form.get('date'));
    if (!String(form.get('title')).trim() || !String(form.get('venue')).trim()) { setNotice('Isi nama aktivitas dan venue.'); return; }
    if (new Date(`${date}+07:00`).getTime() <= Date.now()) { setNotice('Pilih jadwal yang akan datang dalam WIB.'); return; }
    setActivity({ title: String(form.get('title')).trim(), venue: String(form.get('venue')).trim(), date, capacity: Number(form.get('capacity')), cost: Number(form.get('cost')), timing: String(form.get('timing')) });
    setMembers(['Kamu (host demo)']); setExpired(false); setNotice('Aktivitas demo dibuat. Belum tersimpan ke server.'); setTab('detail');
  }
  return <PageShell>
    <p className="mb-3 text-sm font-semibold text-emerald-800">PLAYGROUND DOLEND</p>
    <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">Rencana jadi ketemu.</h1>
    <p className="my-5 max-w-xl text-muted-foreground">Coba alur aktivitas bersama. Semua data hanya contoh di halaman ini dan hilang saat refresh. Tidak ada akun, undangan, reservasi, atau pembayaran nyata.</p>
    <nav aria-label="Alur demo" className="mb-8 flex flex-wrap gap-2">
      {([['create', 'Buat aktivitas'], ['detail', 'Detail & gabung'], ['dashboard', 'Dashboard']] as const).map(([key, label]) => <Button key={key} className="min-h-11" variant={tab === key ? 'default' : 'outline'} onClick={() => { setTab(key); setNotice(''); }} aria-current={tab === key ? 'page' : undefined}>{label}</Button>)}
    </nav>
    <p role="status" className="mb-4 text-sm font-medium">{notice}</p>
    {tab === 'create' ? <section className="rounded-2xl border bg-card p-5 sm:p-8">
      <h2 className="mb-6 text-2xl font-bold">Mau aktivitas apa?</h2>
      <p className="mb-6 text-sm text-muted-foreground">Di versi nyata, hanya member terdaftar dengan nomor terverifikasi yang bisa menjadi host.</p>
      <form action={create} className="grid gap-5 sm:grid-cols-2">
        <Field label="Nama aktivitas" name="title" required maxLength={100} placeholder="Badminton Minggu pagi" />
        <Field label="Venue atau alamat" name="venue" required maxLength={200} placeholder="GOR dekat rumah" />
        <Field label="Jadwal (WIB, UTC+7)" name="date" type="datetime-local" required />
        <Field label="Kapasitas termasuk host" name="capacity" type="number" min={2} max={100} defaultValue={6} required />
        <Field label="Biaya per orang (Rp)" name="cost" type="number" min={0} max={10000000} step={1000} defaultValue={50000} required />
        <div className="grid gap-2"><Label htmlFor="timing">Waktu pembayaran</Label><select id="timing" name="timing" className="min-h-11 rounded-lg border bg-background px-3"><option>Sebelum aktivitas</option><option>Sesudah aktivitas</option></select></div>
        <Button className="min-h-11 sm:col-span-2" type="submit">Buat aktivitas demo</Button>
      </form>
    </section> : !activity ? <section className="rounded-2xl border p-8"><h2 className="text-2xl font-bold">Belum ada aktivitas</h2><p className="my-4">Mulai dengan membuat rencana pertamamu.</p><Button className="min-h-11" onClick={() => setTab('create')}>Buat rencana</Button></section> : <>
      <section className="rounded-2xl border bg-card p-5 sm:p-8">
        <span className="text-sm font-semibold text-emerald-800">{expired ? 'Sudah berakhir' : full ? 'Kapasitas penuh' : 'Terbuka'} · Demo</span>
        <h2 className="my-4 break-words text-3xl font-bold">{activity.title}</h2>
        <dl className="grid gap-5 sm:grid-cols-2">{[['Jadwal', `${dateLabel} WIB`], ['Venue', activity.venue], ['Kapasitas', `${members.length} / ${activity.capacity} orang`], ['Biaya per orang', rupiah(activity.cost)], ['Pembayaran', activity.timing], ['Metode', 'Transfer manual · simulasi saja']].map(([label, value]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>)}</dl>
        <a className="mt-5 inline-block underline underline-offset-4" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.venue)}`}>Lihat venue di Google Maps ↗</a>
        {tab === 'detail' && <div className="mt-8 border-t pt-6">
          <h3 className="text-xl font-bold">Gabung sebagai tamu</h3><p className="my-3 text-sm text-muted-foreground">Tamu bergabung tanpa akun; member memiliki akun. Di sini keduanya hanya simulasi. Jangan masukkan data pribadi.</p>
          <form action={(form) => { const name = String(form.get('guest')).trim(); if (!name) return; if (expired || full) { setNotice('Aktivitas tidak menerima peserta.'); return; } if (members.includes(name)) { setNotice('Nama demo ini sudah ada di roster.'); return; } setMembers([...members, name]); setNotice('Berhasil bergabung di demo. Belum ada tagihan atau pembayaran.'); }} className="flex flex-wrap items-end gap-3">
            <div className="grid min-w-0 flex-1 gap-2"><Label htmlFor="guest">Nama panggilan demo</Label><Input id="guest" name="guest" maxLength={50} required disabled={full || expired} className="min-h-11" /></div><Button disabled={full || expired} type="submit" className="min-h-11">{expired ? 'Aktivitas berakhir' : full ? 'Sudah penuh' : 'Gabung demo'}</Button>
          </form>
          <p className="mt-5 text-sm">Undangan WhatsApp dan QRIS/gateway belum tersedia. Tautan demo tidak memuat data aktivitas.</p>
        </div>}
      </section>
      <section className="mt-6 rounded-2xl border p-5 sm:p-8"><h2 className="text-2xl font-bold">Roster peserta</h2><ul className="my-5 divide-y">{members.map((name, i) => <li className="flex flex-wrap justify-between gap-2 py-3" key={name}><span className="break-all">{name}</span><span className="text-sm text-muted-foreground">{i === 0 ? 'Host · member demo' : 'Tamu demo'} · {activity.cost ? 'Belum dibayar (demo)' : 'Gratis'}</span></li>)}</ul>
        <p className="text-sm">Estimasi total: {rupiah(activity.cost * members.length)}. Belum ada dana diterima.</p>
        <div className="mt-5 flex flex-wrap gap-3"><Button className="min-h-11" variant="outline" onClick={() => setTab(tab === 'dashboard' ? 'detail' : 'dashboard')}>{tab === 'dashboard' ? 'Buka detail' : 'Lihat dashboard'}</Button><Button className="min-h-11" variant="outline" onClick={() => setExpired(!expired)}>{expired ? 'Buka kembali simulasi' : 'Simulasikan berakhir'}</Button></div>
      </section>
    </>}
  </PageShell>;
}

function Field({ label, ...props }: React.ComponentProps<typeof Input> & { label: string; name: string }) {
  return <div className="grid gap-2"><Label htmlFor={props.name}>{label}</Label><Input {...props} id={props.name} className="min-h-11" /></div>;
}
