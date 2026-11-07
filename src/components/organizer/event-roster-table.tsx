import { Fragment, useState, type FormEvent } from 'react';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Copy, LockKeyhole } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { displayParticipantName, type EventRoster } from '@/lib/organizer-client';
import { workspaceFormControl } from './workspace-form';

const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const field = `mt-2 ${workspaceFormControl}`;
const pageSize = 10;
const cell = 'px-2 py-2.5 sm:px-4';
const participantStatus: Record<string, string> = {
  held: 'Kursi ditahan', confirmed: 'Terkonfirmasi', attended: 'Hadir',
  no_show: 'Tidak hadir', expired: 'Kedaluwarsa', cancelled: 'Dibatalkan',
};
const invoiceStatus: Record<string, string> = {
  open: 'Belum lunas', paid: 'Lunas', void: 'Dibatalkan', waived: 'Dihapus',
};
const summaryItems = [
  ['charged', 'Total tagihan'],
  ['received', 'Diterima'],
  ['outstanding', 'Sisa tagihan'],
  ['refunded', 'Pengembalian dana'],
  ['adjustments', 'Penyesuaian'],
  ['credit', 'Kelebihan bayar'],
] as const;

type RosterAction = (event: FormEvent<HTMLFormElement>, participantId: string) => Promise<void>;

export function EventRosterTable({ roster, dynamic, eventStatus, busy, page, onPageChange, onLock, onRecover, onAssignCharge, onCancel }: {
  roster: EventRoster;
  dynamic: boolean;
  eventStatus: string;
  busy: string;
  page: number;
  onPageChange: (page: number) => void;
  onLock: () => Promise<void>;
  onRecover: (participantId: string) => Promise<string>;
  onAssignCharge: RosterAction;
  onCancel: RosterAction;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [replacement, setReplacement] = useState<{ participantId: string; url?: string; message?: string; error?: boolean } | null>(null);
  const count = roster.participants.length;
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const currentPage = Math.min(page, pages);
  const offset = (currentPage - 1) * pageSize;
  const rows = roster.participants.slice(offset, offset + pageSize);
  const estimate = roster.estimated_per_person == null ? 'belum tersedia' : `${rupiah.format(roster.estimated_per_person)} per orang`;

  async function replaceLink(participantId: string) {
    setReplacement(null);
    try {
      setReplacement({ participantId, url: await onRecover(participantId), message: 'Tautan lama sudah nonaktif. Kirim tautan baru hanya ke tamu ini.' });
    } catch (reason) {
      setReplacement({ participantId, error: true, message: reason instanceof Error ? reason.message : 'Tautan belum dapat diganti.' });
    }
  }

  async function copyLink(participantId: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setReplacement({ participantId, url, message: 'Tautan disalin. Kirim hanya ke tamu ini.' });
    } catch {
      setReplacement({ participantId, url, error: true, message: 'Tautan belum tersalin. Salin langsung dari kolom tautan.' });
    }
  }

  return <section aria-labelledby="participants-cost-title" className="min-w-0 px-5 py-6 sm:px-8 sm:py-8">
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <header>
        <h2 id="participants-cost-title" className="text-base font-semibold tracking-tight">Peserta dan biaya</h2>
        {(!dynamic || !roster.contributions_locked_at) && <p className="mt-1.5 text-sm leading-6 text-[#615d59]">{dynamic ? 'Estimasi iuran' : 'Harga tetap'} {estimate}.</p>}
      </header>
      {dynamic && (roster.contributions_locked_at
        ? <Badge><Check aria-hidden="true" />Iuran terkunci</Badge>
        : <Button type="button" variant="outline" disabled={Boolean(busy)} className="min-h-11" onClick={() => void onLock()}><LockKeyhole aria-hidden="true" />{busy === 'lock' ? 'Mengunci…' : 'Kunci iuran'}</Button>)}
    </div>
    {(!dynamic || roster.contributions_locked_at) && <section aria-labelledby="finance-summary-title" className="mt-5 border-b border-[#e6e3df] pb-5">
      <h3 id="finance-summary-title" className="text-sm font-semibold">Ringkasan iuran</h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 text-sm tabular-nums sm:grid-cols-3">
        {summaryItems.map(([key, label]) => <div key={key}>
          <dt className="text-xs leading-5 text-[#615d59]">{label}</dt>
          <dd className={`mt-0.5 font-semibold ${key === 'outstanding' && roster.summary.outstanding > 0 ? 'text-rose-800' : ''}`}>{rupiah.format(roster.summary[key])}</dd>
        </div>)}
      </dl>
      {roster.summary.outstanding === 0 && <Badge variant="secondary" className="mt-3"><Check aria-hidden="true" />Tidak ada tunggakan</Badge>}
    </section>}
    <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h3 id="roster-title" className="text-sm font-semibold">Daftar peserta</h3>
      <p className="text-xs tabular-nums text-[#615d59]">{count} peserta</p>
    </div>
    {count === 0 ? <p className="mt-4 rounded-lg bg-[#f6f5f4] px-3 py-4 text-sm text-[#615d59]">Belum ada peserta. Tambahkan tamu atau bagikan event setelah dikonfirmasi.</p> : (
      <div className="mt-4 rounded-lg border border-[#e6e3df]">
        <table aria-labelledby="roster-title" className="w-full table-fixed border-collapse text-sm">
          <thead className="border-b border-[#e6e3df] bg-[#f6f5f4] text-left text-xs text-[#615d59]">
            <tr>
              <th scope="col" className={`${cell} rounded-tl-lg font-semibold`}>Peserta</th>
              <th scope="col" className={`${cell} w-[35%] font-semibold`}>Tagihan</th>
              <th scope="col" className={`${cell} w-16 rounded-tr-lg text-right font-semibold sm:w-32`}>Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e6e3df]">
            {rows.map(participant => {
              const { id, status, chargeable, is_guest } = participant;
              const name = displayParticipantName(participant);
              const active = status === 'held' || status === 'confirmed';
              const canEdit = active && eventStatus !== 'completed' && eventStatus !== 'cancelled';
              const canRecover = is_guest && active && eventStatus !== 'cancelled';
              const charge = participant.participant_charges[0];
              const invoice = participant.invoices?.[0];
              const open = openId === id;
              const actionsId = `roster-actions-${id}`;
              const linkResult = replacement?.participantId === id ? replacement : null;
              const replacementUrl = linkResult?.url;
              return <Fragment key={id}>
                <tr>
                  <th scope="row" className={`${cell} text-left font-normal [overflow-wrap:anywhere]`}>
                    <span className="block font-semibold">{name}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-[#615d59]">{participantStatus[status] ?? status}{is_guest && ' · Tamu'}</span>
                  </th>
                  <td className={`${cell} tabular-nums [overflow-wrap:anywhere]`}>
                    {charge && <>
                      <span className="block font-medium">{rupiah.format(charge.amount)}</span>
                      <span className="block text-xs leading-5 text-[#615d59]">{charge.balance < 0 ? 'Lebih bayar' : 'Sisa'} {rupiah.format(Math.abs(charge.balance))}</span>
                    </>}
                    {invoice && <><span className="block font-medium">{rupiah.format(invoice.amount_due)}</span><span className="block text-xs leading-5 text-[#615d59]">{invoiceStatus[invoice.status] ?? invoice.status}</span></>}
                    {!charge && !invoice && <span className="text-xs leading-5 text-[#615d59]">{chargeable ? 'Belum ada tagihan' : 'Tidak ditagih'}</span>}
                  </td>
                  <td className="px-2 py-1 text-right sm:px-4">
                    {(canEdit || canRecover) && <Button type="button" variant="ghost" className="min-h-11 min-w-11"
                      aria-label={`Tindakan peserta: ${name}`} aria-expanded={open} aria-controls={open ? actionsId : undefined}
                      onClick={() => setOpenId(open ? null : id)}>
                      <span className="hidden sm:inline">Kelola</span>
                      <ChevronDown aria-hidden="true" className={open ? 'rotate-180' : undefined} />
                    </Button>}
                  </td>
                </tr>
                {open && (canEdit || canRecover) && <tr id={actionsId} className="bg-[#faf9f8]">
                  <td colSpan={3} className="px-3 py-4 sm:px-4">
                    <div className="divide-y divide-[#e6e3df]">
                      {canRecover && <div className="pb-4">
                        <h3 className="text-sm font-semibold">Tautan booking tamu</h3>
                        <p className="mt-1 text-sm leading-6 text-[#615d59]">Gunakan jika tamu kehilangan tautannya atau tautannya tersebar. Membuat pengganti langsung menonaktifkan tautan lama.</p>
                        {replacementUrl ? <div className="mt-3">
                          <Label htmlFor={`guest-link-${id}`}>Tautan booking pengganti</Label>
                          <Input id={`guest-link-${id}`} readOnly value={replacementUrl} className={field} />
                          <Button type="button" variant="outline" className="mt-3 min-h-11" onClick={() => void copyLink(id, replacementUrl)}><Copy aria-hidden="true" />Salin tautan tamu</Button>
                        </div> : <Button type="button" variant="outline" disabled={Boolean(busy)} className="mt-3 min-h-11" onClick={() => void replaceLink(id)}>
                          {busy === id ? 'Membuat…' : 'Buat tautan pengganti'}
                        </Button>}
                        {linkResult?.message && <p role={linkResult.error ? 'alert' : 'status'} className={`mt-2 text-sm ${linkResult.error ? 'text-rose-800' : 'text-[#615d59]'}`}>{linkResult.message}</p>}
                      </div>}
                      {canEdit && dynamic && roster.contributions_locked_at && !charge && <form onSubmit={event => void onAssignCharge(event, id)} className={`pb-4 ${canRecover ? 'pt-4' : ''}`}>
                        <Label htmlFor={`amount-${id}`}>Tagihan peserta tambahan (Rp)</Label>
                        <Input id={`amount-${id}`} name="amount" type="number" min={0} step={1000} required className={field} />
                        <Button type="submit" variant="outline" disabled={Boolean(busy)} className="mt-3 min-h-11">Tetapkan tagihan</Button>
                      </form>}
                      {canEdit && <form onSubmit={event => void onCancel(event, id)} className="grid gap-4 pt-4 sm:grid-cols-2">
                        <div>
                          <Label htmlFor={`policy-${id}`}>Kebijakan pembatalan</Label>
                          <SearchableSelect id={`policy-${id}`} name="policy" className="mt-2"><option value="waive">Hapus tagihan</option><option value="retain">Pertahankan tagihan</option></SearchableSelect>
                        </div>
                        <div>
                          <Label htmlFor={`reason-${id}`}>Alasan</Label>
                          <Input id={`reason-${id}`} name="reason" required maxLength={1000} className={field} />
                        </div>
                        <div className="sm:col-span-2"><Button type="submit" variant="destructive" disabled={Boolean(busy)} className="min-h-11">Batalkan peserta</Button></div>
                      </form>}
                    </div>
                  </td>
                </tr>}
              </Fragment>;
            })}
          </tbody>
        </table>
        {pages > 1 && <nav aria-label="Halaman daftar peserta" className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e6e3df] px-2 py-1.5 sm:px-4">
          <p className="text-xs tabular-nums text-[#615d59]">Peserta {offset + 1}–{Math.min(offset + pageSize, count)} dari {count}</p>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Halaman peserta sebelumnya" disabled={currentPage === 1} onClick={() => { setOpenId(null); onPageChange(currentPage - 1); }}><ChevronLeft aria-hidden="true" /></Button>
            <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Halaman peserta berikutnya" disabled={currentPage === pages} onClick={() => { setOpenId(null); onPageChange(currentPage + 1); }}><ChevronRight aria-hidden="true" /></Button>
          </div>
        </nav>}
      </div>
    )}
  </section>;
}
