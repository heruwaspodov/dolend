'use client';

import Link from 'next/link';
import { useState, type ComponentProps } from 'react';
import { Archive, ArrowDown, ArrowDownUp, ArrowUp, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Columns3, Eye, List, Plus, UserCheck, RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SessionGate } from '@/components/organizer/session-gate';
import { WorkspaceFormHeader, workspaceFormAction, workspaceFormControl, workspaceFormPanel } from '@/components/organizer/workspace-form';
import { organizerRequest, type OrganizerEvent } from '@/lib/organizer-client';
import { useOrganizerEvents } from '@/lib/use-organizer-events';
import { useOrganizerSession } from '@/lib/use-organizer-session';
import { JoinedEvents } from './joined-events';

const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const byName = new Intl.Collator('id-ID', { sensitivity: 'base', numeric: true });
const statusLabel: Record<string, string> = {
  draft: 'Draf', recruiting: 'Mencari peserta', confirmed: 'Terkonfirmasi',
  completed: 'Selesai', cancelled: 'Dibatalkan', published: 'Terbit',
};
const statusTone: Record<string, string> = {
  recruiting: 'bg-[#f9edcf] text-[#6f4a12]',
  published: 'bg-[#e8f3fd] text-[#005bab]',
  confirmed: 'bg-[#eaf6ed] text-[#236b34]',
  cancelled: 'bg-[#fff0ef] text-[#9a332c]',
};

function EventStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block max-w-full rounded-md px-2 py-0.5 text-xs leading-4 font-medium ${statusTone[status] ?? 'bg-[#f0efed] text-[#4e4b48]'}`}>
      {statusLabel[status] ?? status}
    </span>
  );
}

const columns = { status: 'Status', venue: 'Venue', cost: 'Perkiraan biaya' };
const cell = 'px-4 py-3 sm:px-5';

type SortField = 'title' | 'date' | keyof typeof columns;
type Direction = 'ascending' | 'descending';
const venueLabel = (event: OrganizerEvent) => event.venue_booking_status === 'booked' ? 'Sudah dipesan' : 'Belum final';
const comparators: Record<SortField, (a: OrganizerEvent, b: OrganizerEvent) => number> = {
  title: (a, b) => byName.compare(a.title, b.title),
  date: (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at),
  status: (a, b) => byName.compare(statusLabel[a.status] ?? a.status, statusLabel[b.status] ?? b.status),
  venue: (a, b) => byName.compare(venueLabel(a), venueLabel(b)),
  cost: (a, b) => a.estimated_total_cost - b.estimated_total_cost,
};

function TableSelect({ className = '', ...props }: ComponentProps<'select'>) {
  return <select {...props} className={`${workspaceFormControl} ${className}`} />;
}

function SortHeader({ label, direction, onSort, className = '' }: {
  label: string; direction?: Direction; onSort: () => void; className?: string;
}) {
  const Icon = direction === 'ascending' ? ArrowUp : direction === 'descending' ? ArrowDown : ArrowDownUp;
  return (
    <th scope="col" aria-sort={direction} className={`px-3 sm:px-4 ${className}`}>
      <button type="button" onClick={onSort} className={`inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-md px-1 font-medium hover:text-foreground focus-visible:outline-2 focus-visible:outline-[#0069c7] ${direction ? 'text-foreground' : ''}`}>
        {label}<Icon aria-hidden="true" className="size-3.5" />
      </button>
    </th>
  );
}

function schedule(event: OrganizerEvent) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: event.timezone,
  }).format(new Date(event.starts_at));
}

export function MyEvents() {
  const { session, ready } = useOrganizerSession();
  const [tab, setTab] = useState<'managed' | 'joined'>('managed');
  if (!session) return <SessionGate ready={ready} />;

  return (
    <div className={`mx-auto max-w-6xl ${workspaceFormPanel}`}>
      <WorkspaceFormHeader
        icon={CalendarDays}
        title="My Event"
        description="Cek pendaftaranmu dan kelola event yang kamu adakan."
        action={
          <Button asChild className={workspaceFormAction}>
            <Link href="/event/create/"><Plus aria-hidden="true" /> Buat event</Link>
          </Button>
        }
      />
      <nav aria-label="Peran di event" className="flex gap-2 px-5 sm:px-8">
        <Button variant="ghost" className="min-h-11 rounded-b-none aria-pressed:shadow-[inset_0_-2px_#0069c7] aria-pressed:text-[#005bab]" aria-pressed={tab === 'joined'} onClick={() => setTab('joined')}>
          <UserCheck aria-hidden="true" /> Diikuti
        </Button>
        <Button variant="ghost" className="min-h-11 rounded-b-none aria-pressed:shadow-[inset_0_-2px_#0069c7] aria-pressed:text-[#005bab]" aria-pressed={tab === 'managed'} onClick={() => setTab('managed')}>
          <List aria-hidden="true" /> Dikelola
        </Button>
      </nav>
      {tab === 'joined' ? <JoinedEvents key={session.user.id} token={session.access_token} /> : <ManagedEvents />}
    </div>
  );
}

function ManagedEvents() {
  const [view, setView] = useState<'active' | 'archived'>('active');
  const { session, ready, events, loading, error, reload } = useOrganizerEvents(view);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<{ field: SortField; direction: Direction }>({ field: 'date', direction: 'descending' });
  const [visible, setVisible] = useState({ status: false, venue: false, cost: false });
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);

  if (!session) return <SessionGate ready={ready} />;
  const archived = view === 'archived';
  const filtered = events.filter(event =>
    (!status || event.status === status) && event.title.toLocaleLowerCase('id-ID').includes(search.trim().toLocaleLowerCase('id-ID')),
  ).sort((a, b) => comparators[sort.field](a, b) * (sort.direction === 'ascending' ? 1 : -1));

  function sortBy(field: SortField) {
    setSort({ field, direction: sort.field === field && sort.direction === 'ascending' ? 'descending' : 'ascending' });
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const firstRow = (currentPage - 1) * pageSize;
  const pageRows = filtered.slice(firstRow, firstRow + pageSize);

  async function changeArchive(event: OrganizerEvent, token: string) {
    setPending(event.id);
    setNotice(null);
    try {
      await organizerRequest(`/organizer/events/${event.id}/archive`, token, {
        method: 'PATCH', body: JSON.stringify({ archived: !archived }),
      });
      setNotice({ text: archived ? 'Event dikembalikan ke daftar utama.' : 'Event dipindahkan ke arsip.' });
      reload();
    } catch {
      setNotice({ text: 'Arsip belum bisa diperbarui. Coba lagi.', error: true });
    } finally {
      setPending(null);
    }
  }

  return (
      <section aria-label="Daftar event" className="min-w-0">
        <div className="space-y-4 border-b px-4 py-4 sm:px-5">
          <div className="flex flex-wrap gap-2" aria-label="Tampilan daftar">
            {(['active', 'archived'] as const).map(option => (
              <Button key={option} variant="ghost" className={`min-h-11 ${view === option ? 'bg-[#e8f3fd] text-[#005bab]' : ''}`}
                aria-pressed={view === option} disabled={pending !== null}
                onClick={() => { setView(option); setPage(1); setStatus(''); setNotice(null); }}>
                {option === 'active' ? <><List aria-hidden="true" />Daftar utama</> : <><Archive aria-hidden="true" />Arsip</>}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 items-end gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
            <label className="col-span-2 grid gap-1.5 text-xs font-medium xl:col-span-1">
              Cari event
              <span className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground" />
                <Input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }}
                  placeholder="Nama event" className={`${workspaceFormControl} pl-9`} />
              </span>
            </label>
            <div className="grid min-w-0 gap-1.5 text-xs font-medium">
              <label htmlFor="events-status">Status</label>
              <TableSelect id="events-status" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>
                <option value="">Semua status</option>
                {Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </TableSelect>
            </div>
            <details className="relative">
              <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-[#0069c7]"><span className="inline-flex items-center gap-2"><Columns3 aria-hidden="true" className="size-4 text-muted-foreground" />Kolom</span><ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" /></summary>
              <fieldset className="absolute right-0 z-10 mt-1 min-w-48 rounded-lg border bg-card px-3 py-1 shadow-md">
                <legend className="sr-only">Kolom tambahan</legend>
                {(Object.keys(columns) as (keyof typeof columns)[]).map(column => (
                  <label key={column} className="flex min-h-11 items-center gap-2 whitespace-nowrap text-sm">
                    <input type="checkbox" className="size-4 accent-[#0069c7]" checked={visible[column]}
                      onChange={event => setVisible({ ...visible, [column]: event.target.checked })} />
                    {columns[column]}
                  </label>
                ))}
              </fieldset>
            </details>
          </div>
          {notice && <p role={notice.error ? 'alert' : 'status'} className={notice.error ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>{notice.text}</p>}
        </div>

        {loading ? <p className="p-6 text-sm text-muted-foreground" role="status">Memuat event…</p> : error ? (
          <div className="flex flex-wrap items-center gap-3 p-5">
            <p role="alert" className="text-sm text-destructive">{error}</p>
            <Button variant="outline" className="min-h-11" onClick={reload}>Coba lagi</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-10">
            <h2 className="font-semibold">{events.length ? 'Tidak ada event yang cocok' : archived ? 'Arsip masih kosong' : 'Daftar utama masih kosong'}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{events.length ? 'Coba nama lain atau ubah filter status.' : archived ? 'Event yang kamu arsipkan akan tampil di sini.' : 'Buat event baru atau pulihkan event dari arsip.'}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-[#0069c7]" role="region" aria-label="Tabel event" tabIndex={0}>
              <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">Daftar event yang kamu kelola</caption>
                <thead className="border-b bg-[#faf9f8] text-xs text-muted-foreground">
                  <tr>
                    {([
                      ['title', 'Event', ''],
                      ['date', 'Jadwal', ''],
                      ...Object.entries(columns).filter(([field]) => visible[field as keyof typeof columns]),
                    ] as [SortField, string, string?][]).map(([field, label, className]) => (
                      <SortHeader key={field} label={label} className={className}
                        direction={sort.field === field ? sort.direction : undefined} onSort={() => sortBy(field)} />
                    ))}
                    <th scope="col" className={cell}>Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pageRows.map(event => {
                    const manageHref = `/event/manage/?id=${event.id}`;
                    const publicHref = event.visibility === 'public' && ['published', 'recruiting', 'confirmed', 'completed'].includes(event.status)
                      ? `/event/?id=${event.id}` : manageHref;
                    return (
                      <tr key={event.id} className="align-top hover:bg-[#faf9f8] sm:align-middle">
                        <th scope="row" className={`${cell} w-full font-normal`}>
                          <p className="break-words font-semibold [overflow-wrap:anywhere]">{event.title}</p>
                          {!visible.status && <div className="mt-1"><EventStatusBadge status={event.status} /></div>}
                        </th>
                        <td className={`${cell} tabular-nums text-muted-foreground sm:whitespace-nowrap`}>{schedule(event)}</td>
                        {visible.status && <td className={cell}><EventStatusBadge status={event.status} /></td>}
                        {visible.venue && <td className={`${cell} whitespace-nowrap text-muted-foreground`}>{venueLabel(event)}</td>}
                        {visible.cost && <td className={`${cell} whitespace-nowrap tabular-nums text-muted-foreground`}>{rupiah.format(event.estimated_total_cost)}</td>}
                        <td className={cell}>
                          <div className="flex flex-col items-start gap-1 whitespace-nowrap lg:flex-row">
                            <Button asChild variant="outline" className="min-h-11"><Link href={publicHref}><Eye aria-hidden="true" />Lihat event</Link></Button>
                            {publicHref !== manageHref && <Button asChild variant="ghost" className="min-h-11"><Link href={manageHref}>Kelola</Link></Button>}
                            <Button variant="ghost" className="min-h-11 text-muted-foreground" disabled={pending !== null}
                              onClick={() => void changeArchive(event, session.access_token)}>
                              {archived ? <RotateCcw aria-hidden="true" /> : <Archive aria-hidden="true" />}
                              {pending === event.id ? 'Memproses…' : archived ? 'Pulihkan' : 'Arsipkan'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <label htmlFor="events-page-size">Event per halaman</label>
                <TableSelect id="events-page-size" className="max-w-20" value={pageSize}
                  onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>
                  {[5, 10, 15, 20].map(size => <option key={size} value={size}>{size}</option>)}
                </TableSelect>
              </div>
              <nav aria-label="Halaman daftar event" className="ml-auto flex flex-wrap items-center justify-end gap-1">
                <p className="mr-2 text-xs tabular-nums text-muted-foreground" role="status">
                  {firstRow + 1}–{firstRow + pageRows.length} dari {filtered.length} event
                </p>
                <Button variant="ghost" size="icon" className="size-11" aria-label="Sebelumnya" disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}><ChevronLeft aria-hidden="true" /></Button>
                <Button variant="ghost" size="icon" className="size-11" aria-label="Berikutnya" disabled={currentPage === pageCount}
                  onClick={() => setPage(currentPage + 1)}><ChevronRight aria-hidden="true" /></Button>
              </nav>
              {events.length === 100 && <p className="basis-full text-xs text-muted-foreground">Maksimal 100 jadwal terbaru per daftar.</p>}
            </div>
          </>
        )}
      </section>
  );
}
