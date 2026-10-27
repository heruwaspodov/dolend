'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarDays, MapPin, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchPublicEvent, isEventPreview, isUuid, safeMapsUrl, type PublicEvent } from '@/lib/event-client';

type Result = { id: string; kind: 'found'; event: PublicEvent } | { id: string; kind: 'missing' } | { id: string; kind: 'error' };
export function EventDetail() {
  const id = useSearchParams().get('id') ?? '';
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!isUuid(id)) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort('timeout'), 15000);
    let active = true;
    fetchPublicEvent(id, controller.signal).then((event) => {
      if (active) setResult(event ? { id, kind: 'found', event } : { id, kind: 'missing' });
    }).catch(() => {
      if (active) setResult({ id, kind: 'error' });
    }).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [id, attempt]);
  if (!id || !isUuid(id)) return <State title="Tautan aktivitas tidak valid" description="Gunakan tautan lengkap dari penyelenggara untuk membuka aktivitas." />;
  if (!result || result.id !== id) return <EventLoading />;
  if (result.kind === 'missing') return <State title="Aktivitas tidak ditemukan" description="Aktivitas ini belum tersedia atau tautannya sudah tidak berlaku." />;
  if (result.kind === 'error') return <State title="Aktivitas belum bisa dimuat" description="Coba lagi sebentar, atau hubungi penyelenggara jika masalah berlanjut.">
    <Button className="mt-5 min-h-11" onClick={() => { setResult(null); setAttempt((value) => value + 1); }}>Coba lagi</Button>
  </State>;
  const event = result.event;
  const mapsUrl = safeMapsUrl(event.venue.maps_url);
  const date = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'short', timeZone: event.timezone });
  const seats = event.capacity - event.participants_count;
  return <article className="space-y-6">
    {isEventPreview && <Badge variant="outline">Contoh pratinjau · bukan pendaftaran aktif</Badge>}
    <div><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{event.title}</h1><p className="mt-4 whitespace-pre-line leading-relaxed text-muted-foreground">{event.description}</p></div>
    <Card><CardHeader><CardTitle>Rencana aktivitas</CardTitle></CardHeader><CardContent>
      <dl className="space-y-5">
        <div><dt className="flex items-center gap-2 font-medium"><CalendarDays className="size-4" aria-hidden="true" /> Jadwal</dt><dd className="mt-1 text-sm leading-relaxed text-muted-foreground"><time dateTime={event.starts_at}>{date.format(new Date(event.starts_at))}</time><br />Selesai {date.format(new Date(event.ends_at))}<br />Zona waktu: {event.timezone}</dd></div>
        <div><dt className="flex items-center gap-2 font-medium"><MapPin className="size-4" aria-hidden="true" /> {event.venue.name}</dt><dd className="mt-1 text-sm text-muted-foreground">{event.venue.address}</dd>{mapsUrl && <dd className="mt-2"><a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4">Buka Google Maps</a></dd>}</div>
        <div><dt className="flex items-center gap-2 font-medium"><Users className="size-4" aria-hidden="true" /> Kapasitas</dt><dd className="mt-1 text-sm text-muted-foreground">{event.participants_count} dari {event.capacity} peserta · {seats === 0 ? 'Penuh' : `${seats} tempat tersisa`}</dd></div>
        <div><dt className="font-medium">Biaya per orang</dt><dd className="mt-1 text-sm text-muted-foreground">{event.price_amount === 0 ? 'Gratis' : new Intl.NumberFormat('id-ID', { style: 'currency', currency: event.currency, maximumFractionDigits: 0 }).format(event.price_amount)}</dd></div>
      </dl>
    </CardContent></Card>
    <p className="text-sm text-muted-foreground">Pendaftaran aktivitas belum dibuka.</p>
  </article>;
}
function State({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  return <section role="status"><h1 className="text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-4 leading-relaxed text-muted-foreground">{description}</p>{children}</section>;
}
export function EventLoading() {
  return <section role="status" aria-live="polite" className="space-y-4"><p className="text-muted-foreground">Memuat aktivitas…</p><div className="h-10 w-3/4 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" aria-hidden="true" /><div className="h-48 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" aria-hidden="true" /></section>;
}
