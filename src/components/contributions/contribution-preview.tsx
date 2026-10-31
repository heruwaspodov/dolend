'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const money = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
type Participant = { id: number; charge: number | null };

export function ContributionPreview() {
  const [cost, setCost] = useState('300000');
  const [participants, setParticipants] = useState<Participant[]>([{ id: 1, charge: null }]);
  const [locked, setLocked] = useState(false);
  const [nextId, setNextId] = useState(2);
  const [lateCharge, setLateCharge] = useState('');
  const [booking, setBooking] = useState('not_booked');
  const valid = /^\d{1,13}$/.test(cost) && Number(cost) <= 1e12;
  const estimate = valid && participants.length ? Math.ceil(Number(cost) / participants.length) : null;
  const validLate = /^\d{1,13}$/.test(lateCharge) && Number(lateCharge) <= 1e12;
  return <section className="my-8 space-y-5 rounded-xl border bg-card p-5 sm:p-8" aria-labelledby="contribution-title">
    <h2 id="contribution-title" className="text-2xl font-bold">Kumpulkan peserta, lalu kunci iuran</h2>
    <p className="text-sm text-muted-foreground">Prototipe alur baru · recruiting. Data hanya di halaman ini, hilang saat refresh. Belum membuat event atau menerima pembayaran.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="contribution-cost">Estimasi total biaya (Rp)</Label><Input id="contribution-cost" inputMode="numeric" value={cost} onChange={e => setCost(e.target.value)} aria-invalid={!valid} /></div>
      <div className="space-y-2"><Label htmlFor="venue-booking">Status booking venue</Label><select id="venue-booking" className="min-h-11 w-full rounded-md border bg-background px-3" value={booking} onChange={e => setBooking(e.target.value)}><option value="not_booked">Belum dipesan</option><option value="pending">Menunggu konfirmasi</option><option value="booked">Sudah dipesan</option><option value="cancelled">Booking dibatalkan</option></select></div>
    </div>
    <p aria-live="polite">{locked ? 'Iuran dikunci. Perubahan estimasi biaya tidak mengubah tagihan.' : `Estimasi belum final: ${estimate === null ? 'belum tersedia' : money(estimate)} / orang.`}</p>
    <p className="text-sm text-muted-foreground">Pembagi: peserta aktif yang dikenai iuran, termasuk organizer bila ikut. Dibulatkan ke atas ke rupiah penuh. Status venue tidak menentukan status pembayaran.</p>
    {locked && <div className="space-y-2"><Label htmlFor="late-charge">Iuran peserta baru (Rp), ditentukan organizer</Label><Input id="late-charge" inputMode="numeric" value={lateCharge} onChange={e => setLateCharge(e.target.value)} aria-invalid={!validLate} /></div>}
    <div className="flex flex-wrap gap-3"><Button className="min-h-11" disabled={!valid || !participants.length || locked} onClick={() => { setParticipants(participants.map(p => ({ ...p, charge: estimate }))); setLateCharge(String(estimate)); setLocked(true); }}>Kunci iuran</Button><Button variant="outline" className="min-h-11" disabled={locked && !validLate} onClick={() => { setParticipants([...participants, { id: nextId, charge: locked ? Number(lateCharge) : null }]); setNextId(nextId + 1); }}>Tambah peserta</Button></div>
    {!participants.length && <p>Belum ada peserta. Tambahkan peserta untuk menghitung estimasi.</p>}
    <ul className="divide-y">{participants.map(p => <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span>{p.id === 1 ? 'Organizer (ikut)' : `Peserta ${p.id}`} · {p.charge === null ? 'Belum ditagih' : money(p.charge)}</span><Button variant="outline" className="min-h-11" disabled={locked} onClick={() => setParticipants(participants.filter(item => item.id !== p.id))}>Batalkan peserta {p.id}</Button></li>)}</ul>
    {locked && <p className="text-sm text-muted-foreground">Pembatalan setelah lock memerlukan keputusan organizer dan audit; belum tersedia di prototipe.</p>}
    <p className="text-sm text-muted-foreground">Pembayaran MVP: QRIS statis, transfer, atau tunai langsung ke organizer. Laporan bayar menunggu verifikasi organizer; gambar QRIS tidak membuktikan pembayaran berhasil.</p>
  </section>;
}
