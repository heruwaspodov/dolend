'use client';

import { useState } from 'react';
import { AlertTriangle, LoaderCircle, Share2, Users, WalletCards } from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Tab = 'create' | 'detail' | 'dashboard' | 'payment';
type PreviewState = 'ready' | 'loading' | 'error';
type Activity = { title: string; venue: string; date: string; capacity: number; cost: number; timing: string };
type Member = { name: string; role: 'host' | 'guest'; paid: boolean };

const rupiah = (amount: number) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(amount);

export default function DemoPage() {
  const [tab, setTab] = useState<Tab>('create');
  const [activity, setActivity] = useState<Activity | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [notice, setNotice] = useState('');
  const [expired, setExpired] = useState(false);
  const [previewState, setPreviewState] = useState<PreviewState>('ready');
  const full = !!activity && members.length >= activity.capacity;
  const dateLabel = activity ? new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Jakarta',
  }).format(new Date(`${activity.date}+07:00`)) : '';
  const shareUrl = activity ? `https://wa.me/?text=${encodeURIComponent(`Ikut ${activity.title} di ${activity.venue}, ${dateLabel} WIB. Ini undangan demo Dolend—belum menjadi reservasi: https://dolend.web.app/demo/`)}` : '#';

  function selectTab(next: Tab) {
    setTab(next);
    setNotice('');
    setPreviewState('ready');
  }

  function create(form: FormData) {
    const date = String(form.get('date'));
    const title = String(form.get('title')).trim();
    const venue = String(form.get('venue')).trim();
    if (!title || !venue) { setNotice('Isi nama aktivitas dan venue.'); return; }
    if (new Date(`${date}+07:00`).getTime() <= Date.now()) { setNotice('Pilih jadwal yang akan datang dalam WIB.'); return; }
    setActivity({ title, venue, date, capacity: Number(form.get('capacity')), cost: Number(form.get('cost')), timing: String(form.get('timing')) });
    setMembers([{ name: 'Kamu (host demo)', role: 'host', paid: false }]);
    setExpired(false);
    setNotice('Aktivitas demo dibuat. Belum tersimpan ke server.');
    setTab('detail');
  }

  function join(form: FormData) {
    const name = String(form.get('guest')).trim();
    if (!name) return;
    if (expired || full) { setNotice('Aktivitas tidak menerima peserta.'); return; }
    if (members.some(member => member.name.toLocaleLowerCase('id-ID') === name.toLocaleLowerCase('id-ID'))) {
      setNotice('Nama demo ini sudah ada di roster.'); return;
    }
    setMembers([...members, { name, role: 'guest', paid: false }]);
    setNotice('Berhasil bergabung di demo. Belum ada tagihan atau pembayaran nyata.');
  }

  function simulatePayment() {
    const target = members.find(member => !member.paid);
    if (!target || !activity?.cost) return;
    setMembers(members.map(member => member === target ? { ...member, paid: true } : member));
    setNotice(`Pembayaran ${target.name} ditandai lunas untuk simulasi. Tidak ada uang dipindahkan.`);
  }

  return <PageShell>
    <p className="mb-3 text-sm font-semibold text-emerald-800">PLAYGROUND DOLEND</p>
    <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">Rencana jadi ketemu.</h1>
    <p className="my-5 max-w-2xl text-muted-foreground">Coba alur aktivitas bersama dari membuat rencana sampai status pembayaran. Data hanya hidup di halaman ini dan hilang saat refresh. Tidak ada akun, reservasi, atau transaksi nyata.</p>

    <nav aria-label="Alur demo" className="mb-8 flex flex-wrap gap-2">
      {([['create', 'Buat aktivitas'], ['detail', 'Detail & gabung'], ['dashboard', 'Dashboard'], ['payment', 'Pembayaran']] as const).map(([key, label]) =>
        <Button key={key} className="min-h-11" variant={tab === key ? 'default' : 'outline'} onClick={() => selectTab(key)} aria-current={tab === key ? 'page' : undefined}>{label}</Button>)}
    </nav>

    <p role="status" aria-live="polite" className="mb-4 min-h-5 text-sm font-medium">{notice}</p>

    {tab === 'create' ? <CreateActivity onCreate={create} /> : !activity ? <EmptyActivity onCreate={() => selectTab('create')} /> : <>
      {tab === 'dashboard' ? <DashboardState activity={activity} members={members} previewState={previewState} setPreviewState={setPreviewState} /> :
        <EventCard activity={activity} members={members} dateLabel={dateLabel} expired={expired} full={full} shareUrl={shareUrl} />}

      {tab === 'detail' && <JoinPanel onJoin={join} expired={expired} full={full} shareUrl={shareUrl} />}
      {tab === 'payment' && <PaymentPanel activity={activity} members={members} onPay={simulatePayment} />}
      {(tab === 'detail' || tab === 'dashboard') && <Roster activity={activity} members={members} expired={expired} dashboard={tab === 'dashboard'} onToggleExpired={() => setExpired(!expired)} onDashboard={() => selectTab(tab === 'dashboard' ? 'detail' : 'dashboard')} />}
    </>}
  </PageShell>;
}

function CreateActivity({ onCreate }: { onCreate: (form: FormData) => void }) {
  return <section className="rounded-2xl border bg-card p-5 sm:p-8" aria-labelledby="create-title">
    <h2 id="create-title" className="mb-2 text-2xl font-bold">Mau aktivitas apa?</h2>
    <p className="mb-6 text-sm text-muted-foreground">Di versi nyata, hanya member dengan nomor terverifikasi yang bisa menjadi host.</p>
    <form action={onCreate} className="grid gap-5 sm:grid-cols-2">
      <Field label="Nama aktivitas" name="title" required maxLength={100} placeholder="Badminton Minggu pagi" />
      <Field label="Venue atau alamat" name="venue" required maxLength={200} placeholder="GOR dekat rumah" />
      <Field label="Jadwal (WIB, UTC+7)" name="date" type="datetime-local" required />
      <Field label="Kapasitas termasuk host" name="capacity" type="number" min={2} max={100} defaultValue={6} required />
      <Field label="Biaya per orang (Rp)" name="cost" type="number" min={0} max={10000000} step={1000} defaultValue={50000} required />
      <fieldset className="grid gap-2"><legend className="text-sm font-medium">Waktu pembayaran</legend><select name="timing" aria-label="Waktu pembayaran" className="min-h-11 rounded-lg border bg-background px-3"><option>Sebelum aktivitas</option><option>Sesudah aktivitas</option></select></fieldset>
      <Button className="min-h-11 sm:col-span-2" type="submit">Buat aktivitas demo</Button>
    </form>
  </section>;
}

function EmptyActivity({ onCreate }: { onCreate: () => void }) {
  return <section className="rounded-2xl border bg-card p-8" aria-labelledby="empty-title"><h2 id="empty-title" className="text-2xl font-bold">Belum ada aktivitas</h2><p className="my-4 text-muted-foreground">Mulai dengan membuat rencana pertamamu.</p><Button className="min-h-11" onClick={onCreate}>Buat rencana</Button></section>;
}

function EventCard({ activity, members, dateLabel, expired, full, shareUrl }: { activity: Activity; members: Member[]; dateLabel: string; expired: boolean; full: boolean; shareUrl: string }) {
  return <section className="rounded-2xl border bg-card p-5 sm:p-8" aria-labelledby="event-title">
    <span className="text-sm font-semibold text-emerald-800">{expired ? 'Sudah berakhir' : full ? 'Kapasitas penuh' : 'Terbuka'} · Demo</span>
    <h2 id="event-title" className="my-4 break-words text-3xl font-bold">{activity.title}</h2>
    <dl className="grid gap-5 sm:grid-cols-2">{[['Jadwal', `${dateLabel} WIB`], ['Venue', activity.venue], ['Kapasitas', `${members.length} / ${activity.capacity} orang`], ['Biaya per orang', rupiah(activity.cost)], ['Pembayaran', activity.timing], ['Metode', 'Transfer manual · simulasi saja']].map(([label, value]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>)}</dl>
    <div className="mt-6 flex flex-wrap gap-3"><Button asChild variant="outline" className="min-h-11"><a target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.venue)}`}>Lihat Google Maps ↗</a></Button><Button asChild className="min-h-11"><a data-testid="whatsapp-share" target="_blank" rel="noopener noreferrer" href={shareUrl}><Share2 aria-hidden="true" /> Bagikan via WhatsApp</a></Button></div>
  </section>;
}

function JoinPanel({ onJoin, expired, full, shareUrl }: { onJoin: (form: FormData) => void; expired: boolean; full: boolean; shareUrl: string }) {
  return <section className="mt-6 rounded-2xl border bg-card p-5 sm:p-8" aria-labelledby="join-title">
    <h2 id="join-title" className="text-xl font-bold">Gabung sebagai tamu</h2><p className="my-3 text-sm text-muted-foreground">Tamu bergabung tanpa akun; member memiliki akun. Di sini keduanya hanya simulasi. Jangan masukkan data pribadi.</p>
    <form action={onJoin} className="flex flex-wrap items-end gap-3">
      <div className="grid min-w-0 flex-1 gap-2"><Label htmlFor="guest">Nama panggilan demo</Label><Input id="guest" name="guest" maxLength={50} required disabled={full || expired} className="min-h-11" /></div><Button disabled={full || expired} type="submit" className="min-h-11">{expired ? 'Aktivitas berakhir' : full ? 'Sudah penuh' : 'Gabung demo'}</Button>
    </form>
    <p className="mt-5 text-sm">Tautan WhatsApp membuka pesan demo dan belum berisi token undangan. <a className="font-semibold underline underline-offset-4" href={shareUrl} target="_blank" rel="noopener noreferrer">Pratinjau pesan WhatsApp ↗</a></p>
  </section>;
}

function PaymentPanel({ activity, members, onPay }: { activity: Activity; members: Member[]; onPay: () => void }) {
  const unpaid = members.filter(member => !member.paid);
  return <section className="mt-6 rounded-2xl border bg-card p-5 sm:p-8" aria-labelledby="payment-title">
    <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800"><WalletCards aria-hidden="true" /></span><div><h2 id="payment-title" className="text-2xl font-bold">Pembayaran demo</h2><p className="text-sm text-muted-foreground">{activity.timing}</p></div></div>
    {activity.cost === 0 ? <p className="mt-6 rounded-xl bg-emerald-50 p-4 font-semibold text-emerald-900">Aktivitas ini gratis. Tidak ada tagihan.</p> : <>
      <dl className="my-6 grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-3"><div><dt className="text-sm text-muted-foreground">Per orang</dt><dd className="font-bold">{rupiah(activity.cost)}</dd></div><div><dt className="text-sm text-muted-foreground">Lunas</dt><dd className="font-bold">{members.length - unpaid.length} orang</dd></div><div><dt className="text-sm text-muted-foreground">Belum dibayar</dt><dd className="font-bold">{unpaid.length} orang</dd></div></dl>
      <Button className="min-h-11" onClick={onPay} disabled={!unpaid.length}>Simulasikan transfer manual</Button>
    </>}
    <p className="mt-5 text-sm text-muted-foreground">Simulasi ini tidak membuat QRIS, mengunggah bukti, atau memindahkan uang. Payment gateway tetap ditunda.</p>
  </section>;
}

function DashboardState({ activity, members, previewState, setPreviewState }: { activity: Activity; members: Member[]; previewState: PreviewState; setPreviewState: (state: PreviewState) => void }) {
  return <section className="rounded-2xl border bg-card p-5 sm:p-8" aria-labelledby="dashboard-title">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-emerald-800">DASHBOARD HOST · DEMO</p><h2 id="dashboard-title" className="mt-1 text-3xl font-bold">{activity.title}</h2></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-900">{members.length} peserta</span></div>
    <fieldset className="mt-7"><legend className="text-sm font-semibold">Uji keadaan tampilan</legend><div className="mt-3 flex flex-wrap gap-2">{([['ready', 'Siap'], ['loading', 'Loading'], ['error', 'Error']] as const).map(([state, label]) => <Button key={state} size="sm" className="min-h-11" variant={previewState === state ? 'default' : 'outline'} onClick={() => setPreviewState(state)}>{label}</Button>)}</div></fieldset>
    {previewState === 'loading' ? <div className="mt-7 rounded-xl bg-slate-50 p-6" aria-busy="true" aria-label="Memuat ringkasan aktivitas"><LoaderCircle className="mb-3 animate-spin text-emerald-700 motion-reduce:animate-none" aria-hidden="true" /><p className="font-semibold">Memuat ringkasan aktivitas…</p><div className="mt-4 h-3 w-3/4 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" /></div> : previewState === 'error' ? <div className="mt-7 rounded-xl border border-red-200 bg-red-50 p-6 text-red-950" role="alert"><AlertTriangle className="mb-3" aria-hidden="true" /><h3 className="font-bold">Ringkasan gagal dimuat</h3><p className="my-2 text-sm">Coba lagi. Aktivitas demo tidak berubah.</p><Button variant="outline" className="min-h-11 border-red-300 bg-white" onClick={() => setPreviewState('ready')}>Coba lagi</Button></div> : <div className="mt-7 grid gap-4 sm:grid-cols-3"><Metric icon={<Users aria-hidden="true" />} label="Peserta" value={`${members.length}/${activity.capacity}`} /><Metric icon={<WalletCards aria-hidden="true" />} label="Sudah lunas" value={`${members.filter(member => member.paid).length} orang`} /><Metric icon={<Share2 aria-hidden="true" />} label="Status" value="Draft demo" /></div>}
  </section>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-4"><span className="text-emerald-700">{icon}</span><p className="mt-3 text-sm text-muted-foreground">{label}</p><p className="mt-1 font-bold">{value}</p></div>;
}

function Roster({ activity, members, expired, dashboard, onToggleExpired, onDashboard }: { activity: Activity; members: Member[]; expired: boolean; dashboard: boolean; onToggleExpired: () => void; onDashboard: () => void }) {
  return <section className="mt-6 rounded-2xl border bg-card p-5 sm:p-8" aria-labelledby="roster-title"><h2 id="roster-title" className="text-2xl font-bold">Roster peserta</h2><ul className="my-5 divide-y">{members.map(member => <li className="flex flex-wrap justify-between gap-2 py-3" key={member.name}><span className="break-all">{member.name}</span><span className="text-sm text-muted-foreground">{member.role === 'host' ? 'Host · member demo' : 'Tamu demo'} · {activity.cost === 0 ? 'Gratis' : member.paid ? 'Lunas (demo)' : 'Belum dibayar (demo)'}</span></li>)}</ul>
    <p className="text-sm">Estimasi total: {rupiah(activity.cost * members.length)}. Dana diterima: {rupiah(activity.cost * members.filter(member => member.paid).length)} (simulasi).</p>
    <div className="mt-5 flex flex-wrap gap-3"><Button className="min-h-11" variant="outline" onClick={onDashboard}>{dashboard ? 'Buka detail' : 'Lihat dashboard'}</Button><Button className="min-h-11" variant="outline" onClick={onToggleExpired}>{expired ? 'Buka kembali simulasi' : 'Simulasikan berakhir'}</Button></div>
  </section>;
}

function Field({ label, ...props }: React.ComponentProps<typeof Input> & { label: string; name: string }) {
  return <div className="grid gap-2"><Label htmlFor={props.name}>{label}</Label><Input {...props} id={props.name} className="min-h-11" /></div>;
}
