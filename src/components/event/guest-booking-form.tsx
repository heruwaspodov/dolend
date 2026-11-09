'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Copy, LoaderCircle, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createGuestBooking, getGuestBooking } from '@/lib/guest-booking-client';
import { cancelGuestParticipation } from '@/lib/participation-client';

const statusLabel: Record<string,string> = {
  held: 'Tempat ditahan, lanjutkan pembayaran sesuai petunjuk organizer.',
  confirmed: 'Booking sudah dikonfirmasi.',
  attended: 'Kehadiran sudah dicatat.',
  no_show: 'Status kehadiran: tidak hadir.',
  expired: 'Booking sudah kedaluwarsa.',
  cancelled: 'Booking sudah dibatalkan.',
};

export function GuestBookingForm({ eventId,inviteToken,bookingToken,canBook = true,onParticipationChange }: { eventId: string; inviteToken?:string;bookingToken?:string;canBook?:boolean;onParticipationChange:()=>void }) {
  const [displayName, setDisplayName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [status, setStatus] = useState('');
  const [bookingUrl, setBookingUrl] = useState('');
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [chargeId,setChargeId] = useState<string | null>(null);
  const [invoiceId,setInvoiceId] = useState<string | null>(null);
  const [issuedBookingToken,setIssuedBookingToken]=useState('');

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const token = bookingToken??hash.get('booking');
    if (!token) {
      const frame = requestAnimationFrame(() => setLoadingStatus(false));
      return () => cancelAnimationFrame(frame);
    }
    const controller = new AbortController();
    void getGuestBooking(eventId, token, controller.signal)
      .then((booking) => {
        setStatus(booking.status);
        setChargeId(booking.charge_id ?? null);
        setInvoiceId(booking.invoice_id ?? null);
        setBookingUrl(window.location.href);
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message);
      })
      .finally(() => setLoadingStatus(false));
    return () => controller.abort();
  }, [bookingToken,eventId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const booking = await createGuestBooking(eventId, { display_name: displayName.trim(), whatsapp: whatsapp.trim() },inviteToken);
      const hash = new URLSearchParams({ ...(inviteToken?{invite:inviteToken}:{}),booking: booking.booking_token }).toString();
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#${hash}`);
      setStatus(booking.status);
      setIssuedBookingToken(booking.booking_token);
      setInvoiceId(booking.invoice_id ?? null);
      setBookingUrl(window.location.href);
      onParticipationChange();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Booking belum dapat dibuat.');
    } finally {
      setSubmitting(false);
    }
  }

  async function copyBookingLink() {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
    } catch {
      setError('Tautan belum dapat disalin. Salin manual dari kolom tautan.');
    }
  }

  async function cancelBooking(formEvent:FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();const token=bookingToken??issuedBookingToken;if(!token)return;setSubmitting(true);setError('');
    const reason=String(new FormData(formEvent.currentTarget).get('reason')??'').trim();
    try{const participation=await cancelGuestParticipation(eventId,token,reason);setStatus(participation.status);onParticipationChange();}
    catch(requestError){setError(requestError instanceof Error?requestError.message:'Booking belum dapat dibatalkan.');}
    finally{setSubmitting(false);}
  }

  if (loadingStatus) return <div aria-busy="true"><p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Memeriksa tautan booking…</p></div>;

  if (status && bookingUrl) return <section aria-labelledby="guest-booking-status">
    <h2 id="guest-booking-status" className="font-semibold">Status booking</h2>
    <p className="mt-2 rounded-lg border border-[#e6e3df] bg-[#f6f5f4] px-3 py-2.5 text-sm leading-relaxed">{statusLabel[status] ?? 'Booking tersedia.'}</p>
    <div className="mt-4 space-y-2">
      <Label htmlFor="booking-link"><LockKeyhole className="size-4" aria-hidden="true" />Tautan booking rahasia</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input id="booking-link" readOnly value={bookingUrl} className="min-h-11 min-w-0 bg-[#f6f5f4] sm:flex-1" />
        <Button type="button" className="min-h-11" onClick={copyBookingLink}><Copy aria-hidden="true" />{copied ? 'Tautan tersalin' : 'Salin tautan booking'}</Button>
      </div>
    </div>
    {chargeId && <Button asChild className="mt-3 min-h-11"><a href={`/payment/?charge=${chargeId}${new URL(bookingUrl).hash}`}>Lihat tagihan dan pembayaran</a></Button>}
    {invoiceId && <Button asChild className="mt-3 min-h-11"><a href={`/payment/?invoice=${invoiceId}${new URL(bookingUrl).hash}`}>Lihat invoice</a></Button>}
    {!['attended','no_show','cancelled'].includes(status)&&<details className="mt-5 border-t pt-4"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Batalkan booking</summary><form className="pt-3" onSubmit={cancelBooking}><Label htmlFor="guest-cancel-reason">Alasan</Label><Input id="guest-cancel-reason" name="reason" required maxLength={1000} className="mt-2 min-h-11"/><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Jika iuran sudah dikunci, pembatalan tidak otomatis menghapus tagihan. Hubungi organizer untuk penyesuaian.</p><Button type="submit" variant="destructive" disabled={submitting} className="mt-3 min-h-11">{submitting?'Membatalkan…':'Batalkan booking'}</Button></form></details>}
    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Siapa pun yang memiliki tautan ini dapat melihat status booking. Jangan bagikan ke orang lain.</p>
    {error && <p className="mt-3 text-sm font-medium text-rose-700" role="alert">{error}</p>}
  </section>;

  if (!canBook) return <p className="text-sm text-muted-foreground">Kapasitas aktivitas sudah penuh.</p>;

  return <section aria-labelledby="guest-booking-title">
    <h2 id="guest-booking-title" className="mb-2 font-semibold">Booking sebagai guest</h2>
    <p className="text-sm leading-relaxed text-muted-foreground">Tidak perlu akun. Gunakan nama dan nomor WhatsApp Indonesia yang dapat dihubungi organizer.</p>
    <form className="mt-5 space-y-4" onSubmit={submit}>
      <div className="space-y-2"><Label htmlFor="guest-name">Nama</Label><Input id="guest-name" name="name" autoComplete="name" maxLength={120} required className="min-h-11" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="guest-whatsapp">Nomor WhatsApp</Label><Input id="guest-whatsapp" name="tel" type="tel" inputMode="tel" autoComplete="tel" placeholder="0812 3456 7890" minLength={8} maxLength={32} required className="min-h-11" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} /></div>
      <Button type="submit" className="min-h-11" disabled={submitting}>{submitting ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}{submitting ? 'Membuat booking…' : 'Booking tempat'}</Button>
      {error && <p className="text-sm font-medium text-rose-700" role="alert">{error}</p>}
    </form>
  </section>;
}
