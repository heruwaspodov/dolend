'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Copy, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createGuestBooking, getGuestBooking } from '@/lib/guest-booking-client';

const statusLabel: Record<string,string> = {
  held: 'Tempat ditahan, lanjutkan pembayaran sesuai petunjuk organizer.',
  confirmed: 'Booking sudah dikonfirmasi.',
  attended: 'Kehadiran sudah dicatat.',
  no_show: 'Status kehadiran: tidak hadir.',
  expired: 'Booking sudah kedaluwarsa.',
  cancelled: 'Booking sudah dibatalkan.',
};

export function GuestBookingForm({ eventId }: { eventId: string }) {
  const [displayName, setDisplayName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [status, setStatus] = useState('');
  const [bookingUrl, setBookingUrl] = useState('');
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [chargeId,setChargeId] = useState<string | null>(null);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const token = hash.get('booking');
    if (!token) {
      const frame = requestAnimationFrame(() => setLoadingStatus(false));
      return () => cancelAnimationFrame(frame);
    }
    const controller = new AbortController();
    void getGuestBooking(eventId, token, controller.signal)
      .then((booking) => {
        setStatus(booking.status);
        setChargeId(booking.charge_id ?? null);
        setBookingUrl(window.location.href);
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message);
      })
      .finally(() => setLoadingStatus(false));
    return () => controller.abort();
  }, [eventId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const booking = await createGuestBooking(eventId, { display_name: displayName.trim(), whatsapp: whatsapp.trim() });
      const hash = new URLSearchParams({ booking: booking.booking_token }).toString();
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#${hash}`);
      setStatus(booking.status);
      setBookingUrl(window.location.href);
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

  if (loadingStatus) return <Card aria-busy="true"><CardContent className="pt-6"><p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Memeriksa tautan booking…</p></CardContent></Card>;

  if (status && bookingUrl) return <Card><CardHeader><CardTitle role="heading" aria-level={2} className="flex items-center gap-2"><CheckCircle2 className="size-5 text-emerald-700" aria-hidden="true" />Status booking</CardTitle></CardHeader><CardContent>
    <p className="text-sm leading-relaxed">{statusLabel[status] ?? 'Booking tersedia.'}</p>
    <div className="mt-5 space-y-2"><Label htmlFor="booking-link">Tautan booking rahasia</Label><Input id="booking-link" readOnly value={bookingUrl} className="min-h-11" /></div>
    <Button type="button" variant="outline" className="mt-3 min-h-11" onClick={copyBookingLink}><Copy aria-hidden="true" />{copied ? 'Tautan tersalin' : 'Salin tautan booking'}</Button>
    {chargeId && <Button asChild className="mt-3 min-h-11"><a href={`/payment/?charge=${chargeId}${new URL(bookingUrl).hash}`}>Lihat tagihan dan pembayaran</a></Button>}
    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Siapa pun yang memiliki tautan ini dapat melihat status booking. Jangan bagikan ke orang lain.</p>
    {error && <p className="mt-3 text-sm font-medium text-rose-700" role="alert">{error}</p>}
  </CardContent></Card>;

  return <Card><CardHeader><CardTitle role="heading" aria-level={2}>Booking sebagai guest</CardTitle></CardHeader><CardContent>
    <p className="text-sm leading-relaxed text-muted-foreground">Tidak perlu akun. Gunakan nama dan nomor WhatsApp Indonesia yang dapat dihubungi organizer.</p>
    <form className="mt-5 space-y-4" onSubmit={submit}>
      <div className="space-y-2"><Label htmlFor="guest-name">Nama</Label><Input id="guest-name" name="name" autoComplete="name" maxLength={120} required value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="guest-whatsapp">Nomor WhatsApp</Label><Input id="guest-whatsapp" name="tel" type="tel" inputMode="tel" autoComplete="tel" placeholder="0812 3456 7890" minLength={8} maxLength={32} required value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} /></div>
      <Button type="submit" className="min-h-11" disabled={submitting}>{submitting ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}{submitting ? 'Membuat booking…' : 'Booking tempat'}</Button>
      {error && <p className="text-sm font-medium text-rose-700" role="alert">{error}</p>}
    </form>
  </CardContent></Card>;
}
