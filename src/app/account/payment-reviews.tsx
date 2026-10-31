'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { paymentRequest } from '@/lib/payment-client';

type Review = { id: string; amount: number; status: string; proof_url: string | null };
type Participant = { id: string; users: { display_name: string }; participant_charges: { id: string } | null };
type Method = { id: string; type: string; recipient_name: string };
const money = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);

export function PaymentReviews({ token }: { token: string }) {
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);
  const [event, setEvent] = useState('');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [charge, setCharge] = useState('');
  const [methods, setMethods] = useState<Method[]>([]);
  const [receiptKey, setReceiptKey] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    paymentRequest<{ id: string; title: string }[]>('/organizer/events', token, { signal: controller.signal })
      .then(setEvents).catch(error => { if (error.name !== 'AbortError') setMessage(error.message); });
    return () => controller.abort();
  }, [token]);

  async function load(e: FormEvent) {
    e.preventDefault(); setBusy(true); setCharge(''); setMethods([]);
    try {
      const [rows, roster] = await Promise.all([
        paymentRequest<Review[]>(`/events/${event}/payment-reviews`, token),
        paymentRequest<{ participants: Participant[] }>(`/events/${event}/roster`, token),
      ]);
      setReviews(rows); setParticipants(roster.participants);
      setMessage(rows.length ? '' : 'Belum ada laporan pembayaran.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal memuat.'); }
    finally { setBusy(false); }
  }

  async function review(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault(); setBusy(true); const form = new FormData(e.currentTarget);
    try {
      const result = await paymentRequest<Review>(`/payments/${id}/review`, token, {
        method: 'POST', body: JSON.stringify({ decision: form.get('decision'), reason: form.get('reason') }),
      });
      setReviews(rows => rows.map(row => row.id === id ? { ...row, ...result } : row));
      setMessage('Review tersimpan.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal menyimpan.'); }
    finally { setBusy(false); }
  }

  async function selectCharge(id: string) {
    setCharge(id); setMethods([]); setReceiptKey(crypto.randomUUID());
    if (!id) return;
    setBusy(true);
    try {
      const result = await paymentRequest<{ methods: Method[] }>(`/charges/${id}`, token);
      setMethods(result.methods.filter(method => method.type === 'cash'));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal memuat metode.'); }
    finally { setBusy(false); }
  }

  async function recordCash(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); const values = new FormData(e.currentTarget);
    try {
      const report = await paymentRequest<Review>(`/charges/${charge}/payments`, token, {
        method: 'POST', body: JSON.stringify({ method_id: values.get('method'), amount: Number(values.get('amount')), idempotency_key: receiptKey }),
      });
      await paymentRequest(`/payments/${report.id}/review`, token, {
        method: 'POST', body: JSON.stringify({ decision: 'verified', reason: String(values.get('reason')) }),
      });
      setReceiptKey(crypto.randomUUID()); setCharge(''); setMethods([]);
      setMessage('Penerimaan tunai tercatat dan terverifikasi.');
      setReviews(await paymentRequest<Review[]>(`/events/${event}/payment-reviews`, token));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Tunai belum dapat dicatat.'); }
    finally { setBusy(false); }
  }

  return <section className="mt-6 space-y-5 rounded-xl border bg-card p-5 sm:p-8" aria-labelledby="payment-reviews-title">
    <h2 id="payment-reviews-title" className="text-xl font-bold">Verifikasi pembayaran event</h2>
    <p className="text-sm text-muted-foreground">Cocokkan laporan dengan penerimaan bank/e-wallet sebelum memverifikasi.</p>
    <form onSubmit={load} className="space-y-3">
      <Label htmlFor="review-event">Event yang dikelola</Label>
      <select id="review-event" required value={event} onChange={e => { setEvent(e.target.value); setReviews([]); setParticipants([]); setCharge(''); }} className="min-h-11 w-full rounded-md border bg-background px-3">
        <option value="">Pilih event</option>{events.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select>
      <Button disabled={busy} className="min-h-11">Muat laporan</Button>
    </form>
    <p role="status" aria-live="polite">{message}</p>
    {participants.some(p => p.participant_charges) && <form onSubmit={recordCash} className="space-y-3 border-t pt-5">
      <h3 className="font-semibold">Catat penerimaan tunai</h3>
      <Label htmlFor="cash-participant">Peserta</Label>
      <select id="cash-participant" required value={charge} disabled={busy} onChange={e => void selectCharge(e.target.value)} className="min-h-11 w-full rounded-md border bg-background px-3">
        <option value="">Pilih peserta</option>{participants.filter(p => p.participant_charges).map(p => <option key={p.id} value={p.participant_charges!.id}>{p.users.display_name}</option>)}
      </select>
      {charge && <><Label htmlFor="cash-method">Penerima tunai</Label><select id="cash-method" name="method" required className="min-h-11 w-full rounded-md border bg-background px-3">{methods.map(m => <option key={m.id} value={m.id}>{m.recipient_name}</option>)}</select>
        {!methods.length && <p className="text-sm text-muted-foreground">Metode tunai harus diaktifkan untuk event ini terlebih dahulu.</p>}
        <Label htmlFor="cash-amount">Nominal diterima (Rp)</Label><Input id="cash-amount" name="amount" type="number" min={1} max={1e12} step={1} required />
        <Label htmlFor="cash-reason">Catatan penerimaan</Label><Input id="cash-reason" name="reason" maxLength={1000} required />
        <Button disabled={busy || !methods.length} className="min-h-11">Catat tunai diterima</Button></>}
    </form>}
    <ul className="space-y-4">{reviews.map(row => <li key={row.id} className="space-y-3 border-t pt-4">
      <p>{money(row.amount)} · {row.status === 'verified' ? 'Terverifikasi' : row.status === 'rejected' ? 'Ditolak' : 'Menunggu verifikasi'}</p>
      {row.proof_url && <a className="underline" href={row.proof_url} target="_blank" rel="noreferrer">Lihat bukti pembayaran</a>}
      {row.status === 'pending_verification' && <form onSubmit={e => review(e, row.id)} className="space-y-3">
        <Label htmlFor={`reason-${row.id}`}>Catatan pemeriksaan</Label><Input id={`reason-${row.id}`} name="reason" required maxLength={1000} />
        <Label htmlFor={`decision-${row.id}`}>Keputusan</Label><select id={`decision-${row.id}`} name="decision" className="min-h-11 w-full rounded-md border bg-background px-3"><option value="verified">Verifikasi penerimaan</option><option value="rejected">Tolak laporan</option></select>
        <Button disabled={busy} className="min-h-11">Simpan review</Button>
      </form>}
    </li>)}</ul>
  </section>;
}
