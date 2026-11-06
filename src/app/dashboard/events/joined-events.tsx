'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Eye, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { organizerRequest } from '@/lib/organizer-client';

type JoinedEvent = {
  id: string;
  title: string;
  starts_at: string;
  timezone: string;
  event_status: string;
  participation_status: string;
  can_view: boolean;
  invoice: { id: string; status: string } | null;
};

const participationLabels: Record<string, string> = {
  held: 'Kursi ditahan', confirmed: 'Terdaftar', attended: 'Hadir',
  no_show: 'Tidak hadir', expired: 'Kedaluwarsa', cancelled: 'Pendaftaran dibatalkan',
};
const invoiceLabels: Record<string, string> = {
  open: 'Belum lunas', paid: 'Lunas', void: 'Tagihan dibatalkan', waived: 'Tagihan dibebaskan',
};

export function JoinedEvents({ token }: { token: string }) {
  const [result, setResult] = useState<{ events: JoinedEvent[] } | { error: true } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void organizerRequest<JoinedEvent[]>('/participant/events', token, { signal: controller.signal })
      .then(events => { if (!controller.signal.aborted) setResult({ events }); })
      .catch(() => { if (!controller.signal.aborted) setResult({ error: true }); });
    return () => controller.abort();
  }, [token, attempt]);

  return (
    <section aria-labelledby="joined-title">
      <header className="border-b px-4 py-4 sm:px-5">
        <h2 id="joined-title" className="font-semibold">Event yang kamu ikuti</h2>
        <p className="mt-1 text-sm text-muted-foreground">Lihat jadwal, status pendaftaran, dan tagihanmu.</p>
      </header>
      {!result ? <p role="status" className="p-5 text-sm text-muted-foreground">Memuat pendaftaran…</p> : 'error' in result ? (
        <div className="flex flex-wrap items-center gap-3 p-5">
          <p role="alert" className="text-sm text-destructive">Pendaftaran belum bisa dimuat.</p>
          <Button variant="outline" className="min-h-11" onClick={() => { setResult(null); setAttempt(value => value + 1); }}>Coba lagi</Button>
        </div>
      ) : result.events.length === 0 ? (
        <div className="px-5 py-8">
          <h3 className="font-medium">Belum ada event yang kamu ikuti</h3>
          <p className="mt-1 text-sm text-muted-foreground">Setelah mendaftar, event akan tampil di sini.</p>
        </div>
      ) : (
        <ul className="divide-y">
          {result.events.map(event => (
            <li key={event.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <h3 className="break-words text-sm font-semibold">{event.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  <time dateTime={event.starts_at}>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: event.timezone }).format(new Date(event.starts_at))}</time>
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-md bg-[#e8f3fd] px-2 py-0.5 text-[#005bab]">{participationLabels[event.participation_status] ?? event.participation_status}</span>
                  {event.event_status === 'cancelled' && <span className="rounded-md bg-[#fff0ef] px-2 py-0.5 text-[#9a332c]">Event dibatalkan</span>}
                  {event.invoice && <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground">{invoiceLabels[event.invoice.status] ?? event.invoice.status}</span>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {event.can_view && <Button asChild variant="outline" className="min-h-11">
                  <Link href={`/event/?id=${event.id}&member=1`}><Eye aria-hidden="true" /> Lihat event</Link>
                </Button>}
                {event.invoice && <Button asChild variant="ghost" className="min-h-11">
                  <Link href={`/payment/?invoice=${event.invoice.id}`}><ReceiptText aria-hidden="true" /> Lihat tagihan</Link>
                </Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
