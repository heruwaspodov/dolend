'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MapPin, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchPublicEvent, isEventPreview, isUuid, safeMapsUrl, type PublicEvent } from '@/lib/event-client';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { EventParticipation } from './event-participation';
import { EventVenueMap } from './event-venue-map';

type Result = { id: string; kind: 'found'; event: PublicEvent; inviteToken?:string;bookingToken?:string } | { id: string; kind: 'missing' } | { id: string; kind: 'error' };
export function EventDetail() {
  const params = useSearchParams();
  const id = params.get('id') ?? '';
  const memberView = params.get('member') === '1';
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [rosterRequest, setRosterRequest] = useState({ id: '', page: 1 });
  useEffect(() => {
    if (!isUuid(id)) return;
    const controller = new AbortController();
    const fragment=new URLSearchParams(window.location.hash.slice(1));
    const inviteToken=fragment.get('invite')??undefined;
    const bookingToken=fragment.get('booking')??undefined;
    const timeout = setTimeout(() => controller.abort('timeout'), 15000);
    let active = true;
    const rosterPage = rosterRequest.id === id ? rosterRequest.page : 1;
    fetchPublicEvent(id, controller.signal,inviteToken,bookingToken,undefined,rosterPage).then(async event => {
      if (event || !memberView || isEventPreview || controller.signal.aborted) return event;
      const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
      return session ? fetchPublicEvent(id, controller.signal, undefined, undefined, session.access_token, rosterPage) : null;
    }).then((event) => {
      if (!active) return;
      setResult(current => {
        if (!event) return { id, kind: 'missing' };
        return {
          id, kind: 'found', event, inviteToken,
          bookingToken: current?.id === id && current.kind === 'found' ? current.bookingToken : bookingToken,
        };
      });
    }).catch(() => {
      if (active) setResult(current => current?.id === id && current.kind === 'found' ? current : { id, kind: 'error' });
    }).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [id, attempt, memberView, rosterRequest]);
  if (!id || !isUuid(id)) return <State title="Tautan aktivitas tidak valid" description="Gunakan tautan lengkap dari penyelenggara untuk membuka aktivitas." />;
  if (!result || result.id !== id) return <EventLoading />;
  if (result.kind === 'missing') return <State title="Aktivitas tidak ditemukan" description="Aktivitas ini belum tersedia atau tautannya sudah tidak berlaku." />;
  if (result.kind === 'error') return <State title="Aktivitas belum bisa dimuat" description="Coba lagi sebentar, atau hubungi penyelenggara jika masalah berlanjut.">
    <Button className="mt-5 min-h-11" onClick={() => { setResult(null); setAttempt((value) => value + 1); }}>Coba lagi</Button>
  </State>;
  const event = result.event;
  const activity = event.activity_type_slug === 'badminton'
    ? { label: 'Badminton', cover: '/images/landing/badminton.jpg' }
    : event.activity_type_slug === 'football'
      ? { label: 'Sepak bola', cover: '/images/landing/soccer-hero.jpg' }
      : null;
  const { latitude, longitude } = event.venue;
  const hasCoordinates = latitude !== undefined && longitude !== undefined;
  const mapsUrl = safeMapsUrl(event.venue.maps_url) ?? (hasCoordinates
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`
    : undefined);
  const day = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeZone: event.timezone });
  const time = new Intl.DateTimeFormat('id-ID', { timeStyle: 'short', timeZone: event.timezone });
  const start = new Date(event.starts_at);
  const end = new Date(event.ends_at);
  const startDay = day.format(start);
  const endDay = day.format(end);
  const seats = event.capacity - event.participants_count;
  const dynamic = event.contribution_mode === 'dynamic';
  const timing = dynamic ? event.payment_timing : event.payment_mode;
  const paymentLabel = !dynamic && event.price_amount === 0 ? 'Gratis'
    : timing === 'before_event' ? 'Bayar sebelum event'
    : timing === 'after_event' ? 'Bayar setelah event'
    : dynamic ? 'Patungan' : null;
  const money = new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: event.currency, maximumFractionDigits: 0,
  });
  const perPerson = dynamic
    ? event.contributions_locked_at ? null : event.estimated_per_person
    : event.price_amount;
  const estimatedTotal = dynamic ? event.estimated_total_cost : null;
  const fullCapacityEstimate = estimatedTotal != null ? Math.ceil(estimatedTotal / event.capacity) : null;

  return <div className="space-y-4">
    {isEventPreview && <Badge variant="outline">Contoh pratinjau · bukan pendaftaran aktif</Badge>}
    <article className="overflow-hidden rounded-2xl border border-[#e6e3df] bg-white text-[#20201f] [--primary:#006bc9] [--primary-foreground:#fff] [--ring:#006bc9] [&_[data-slot=button][data-variant=default]:hover]:bg-[#005bab]">
      <header className="relative isolate flex min-h-44 flex-col justify-end gap-10 bg-slate-900 p-5 text-white sm:p-7">
        {activity && <>
          <Image src={activity.cover} alt="" fill sizes="(max-width: 896px) 100vw, 832px" className="-z-20 object-cover" />
          <div className="absolute inset-0 -z-10 bg-linear-to-t from-slate-950/95 via-slate-950/45 to-slate-950/5" />
        </>}
        {(activity || paymentLabel) && <div className="flex flex-wrap items-start justify-between gap-2">
          {activity && <span className="rounded-md bg-white px-2.5 py-1 text-xs font-bold text-slate-900 uppercase">{activity.label}</span>}
          {paymentLabel && <span className="ml-auto rounded-md bg-[#005bab] px-2.5 py-1 text-xs font-bold text-white uppercase">{paymentLabel}</span>}
        </div>}
        <div className={activity ? 'pt-6 sm:pt-16' : ''}>
          <h1 className="text-2xl leading-tight font-bold tracking-tight wrap-anywhere sm:text-4xl">{event.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-white sm:text-base">
            <time dateTime={event.starts_at}>{startDay}, {time.format(start)}</time>
            {startDay === endDay ? '–' : ' sampai '}
            <time dateTime={event.ends_at}>{startDay !== endDay && `${endDay}, `}{time.format(end)}</time>
            <span className="block text-xs text-slate-200">{event.timezone}</span>
          </p>
        </div>
      </header>

      <div className="space-y-6 p-5 sm:space-y-7 sm:p-7">
        <section aria-label="Biaya event">
          <dl className={`grid rounded-xl border border-[#e6e3df] bg-[#f6f5f4] p-3 sm:p-4 ${estimatedTotal != null ? 'grid-cols-2' : ''}`}>
            {estimatedTotal != null && <div className="min-w-0 pr-3 sm:pr-4">
              <dt className="text-sm text-[#615d59]">Estimasi total biaya</dt>
              <dd className="mt-1 text-lg font-bold wrap-anywhere tabular-nums sm:text-xl">{money.format(estimatedTotal)}</dd>
            </div>}
            <div className={estimatedTotal != null ? 'min-w-0 border-l border-[#e6e3df] pl-3 text-right sm:pl-4' : 'min-w-0'}>
              <dt className="text-sm text-[#615d59]">{dynamic ? 'Estimasi iuran saat ini per orang' : 'Biaya per orang'}</dt>
              <dd className="mt-1 text-lg font-bold wrap-anywhere text-[#005bab] tabular-nums sm:text-xl">
                {perPerson == null ? '—' : !dynamic && perPerson === 0 ? 'Gratis' : money.format(perPerson)}
              </dd>
            </div>
          </dl>
          {dynamic && <p className="mt-2 text-sm leading-relaxed text-[#615d59]">
            {event.contributions_locked_at ? 'Iuran sudah dikunci. Lihat tagihan pribadi melalui tautan booking.'
              : perPerson == null ? 'Belum ada peserta yang dikenai iuran.'
              : 'Estimasi saat ini dibagi ke peserta terkonfirmasi yang dikenai iuran.'}
          </p>}
          {!event.contributions_locked_at && fullCapacityEstimate != null && fullCapacityEstimate !== perPerson &&
            <p className="mt-1 text-sm leading-relaxed text-[#615d59]">
              Jika semua {event.capacity} tempat terisi dan ikut patungan, estimasinya <strong className="font-semibold text-[#20201f]">{money.format(fullCapacityEstimate)} per orang</strong>.
            </p>}
        </section>

        <section aria-labelledby="event-quota">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 id="event-quota" className="text-sm font-semibold">Kuota terkonfirmasi</h2>
            <p className="text-sm font-semibold text-[#005bab] tabular-nums">{event.participants_count} / {event.capacity} terisi</p>
          </div>
          <div role="progressbar" aria-labelledby="event-quota" aria-valuemin={0} aria-valuemax={event.capacity} aria-valuenow={event.participants_count} className="mt-2 h-2 overflow-hidden rounded-full border border-[#e6e3df] bg-slate-100">
            <div className="h-full rounded-full bg-primary" style={{ width: `${event.participants_count / event.capacity * 100}%` }} />
          </div>
          <p className="mt-2 text-sm text-[#615d59]">{seats === 0 ? 'Kapasitas penuh' : `${seats} tempat tersisa`}</p>
        </section>

        <EventParticipantList count={event.participants_count} roster={event.participant_roster} onPage={page => setRosterRequest({ id, page })} />

        <section aria-labelledby="event-location" className="border-t border-[#e6e3df] pt-5 sm:pt-6">
          <h2 id="event-location" className="flex items-center gap-2 font-semibold"><MapPin className="size-4 shrink-0" aria-hidden="true" />Lokasi</h2>
          <p className="mt-2 text-sm font-medium wrap-anywhere">{event.venue.name}</p>
          {event.venue.address && <p className="mt-1 text-sm wrap-anywhere text-[#615d59]">{event.venue.address}</p>}
          {hasCoordinates && <EventVenueMap key={`${latitude},${longitude}`} latitude={latitude} longitude={longitude} />}
          {mapsUrl && <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-medium text-[#005bab] underline underline-offset-4">Buka Google Maps</a>}
          {event.venue.meeting_instructions && <p className="mt-2 text-sm leading-relaxed wrap-anywhere whitespace-pre-line text-[#615d59]"><span className="font-medium text-[#20201f]">Petunjuk bertemu:</span> {event.venue.meeting_instructions}</p>}
          {event.description && <p className="mt-3 text-sm leading-relaxed wrap-anywhere whitespace-pre-line text-[#615d59]">{event.description}</p>}
        </section>

        <div className="border-t border-[#e6e3df] pt-5 sm:pt-6">
          {isEventPreview
            ? <p className="text-sm text-[#615d59]">Pendaftaran aktivitas belum dibuka pada pratinjau.</p>
            : <EventParticipation key={event.id} eventId={event.id} inviteToken={result.inviteToken} bookingToken={result.bookingToken} seats={seats} onParticipationChange={() => setAttempt(value => value + 1)} />}
        </div>
      </div>
    </article>
  </div>;
}

function EventParticipantList({ count, roster, onPage }: {
  count: number;
  roster: PublicEvent['participant_roster'];
  onPage: (page: number) => void;
}) {
  const pageSize = 10;
  const page = roster?.page ?? 1;
  const first = (page - 1) * pageSize;
  const lastPage = Math.ceil(count / pageSize);

  return <section aria-labelledby="event-participants" className="border-t border-[#e6e3df] pt-5 sm:pt-6">
    <h2 id="event-participants" className="font-semibold">Daftar peserta</h2>
    {count === 0 ? <p className="mt-2 text-sm text-[#615d59]">Belum ada peserta terkonfirmasi.</p>
      : !roster?.names.length ? <p className="mt-2 text-sm text-[#615d59]">Daftar nama peserta belum tersedia.</p> : <>
      <ul className="mt-3 space-y-2" aria-label="Peserta terkonfirmasi">
        {roster.names.map((name, index) => {
          const number = first + index + 1;
          return <li key={number} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e6e3df] bg-[#f6f5f4] p-2.5 text-sm">
            <span className="inline-flex min-w-0 items-center gap-2 wrap-anywhere"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e6e3df] text-slate-600" aria-hidden="true"><UserRound className="size-4" /></span>{name?.trim() || `Peserta ${number}`}</span>
            <span className="rounded-md bg-[#dcecff] px-2 py-1 text-xs font-semibold text-[#004780]">Terkonfirmasi</span>
          </li>;
        })}
      </ul>
      {lastPage > 1 && <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[#615d59]" role="status">{first + 1}–{Math.min(first + roster.names.length, count)} dari {count} peserta</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="min-h-11" disabled={page <= 1} onClick={() => onPage(page - 1)}>Sebelumnya</Button>
          <Button type="button" variant="outline" className="min-h-11" disabled={page >= lastPage} onClick={() => onPage(page + 1)}>Berikutnya</Button>
        </div>
      </div>}
    </>}
  </section>;
}
function State({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  return <section role="status"><h1 className="text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-4 leading-relaxed text-muted-foreground">{description}</p>{children}</section>;
}
export function EventLoading() {
  return <section role="status" aria-live="polite" className="space-y-4"><p className="text-muted-foreground">Memuat aktivitas…</p><div className="h-10 w-3/4 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" aria-hidden="true" /><div className="h-48 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" aria-hidden="true" /></section>;
}
