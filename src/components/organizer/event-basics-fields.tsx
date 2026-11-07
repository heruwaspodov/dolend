import { cn } from 'cn';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import type { ActivityType, OrganizerWorkspace } from '@/lib/organizer-client';
import { workspaceFormChoice, workspaceFormControl } from './workspace-form';

const field = `mt-2 ${workspaceFormControl}`;

type SavedBasics = {
  title: string;
  description: string;
  visibility: 'public' | 'unlisted';
  workspace_name?: string | null;
  activity_type_slug?: string | null;
  activity_type_name?: string | null;
};

export function EventBasicsFields({ activities, workspaces = [], event }: {
  activities: ActivityType[];
  workspaces?: OrganizerWorkspace[];
  event?: SavedBasics;
}) {
  const savedActivity = event?.activity_type_slug;
  const activityChoices = savedActivity && event.activity_type_name && !activities.some(({ slug }) => slug === savedActivity)
    ? [...activities, { id: savedActivity, slug: savedActivity, name: event.activity_type_name }]
    : activities;

  return <div className="grid gap-4 sm:grid-cols-2">
    <div>
      <Label htmlFor="workspace">Workspace</Label>
      {event
        ? <Input id="workspace" value={event.workspace_name ?? 'Nama workspace belum tersedia'} readOnly className={`${field} bg-[#f6f5f4]`} />
        : <SearchableSelect id="workspace" name="workspace_id" required className="mt-2">{workspaces.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</SearchableSelect>}
    </div>
    <fieldset disabled={Boolean(event)} className="min-w-0 sm:col-span-2" aria-describedby="activity-hint">
      <legend className="text-sm font-medium">Pilih jenis kegiatan</legend>
      <p id="activity-hint" className="mt-1 text-sm text-[#615d59]">Jenis kegiatan menentukan tampilan header di halaman peserta.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {activityChoices.map((activity, index) => (
          <label key={activity.id} className={cn(workspaceFormChoice, 'flex items-center gap-2 px-3 py-2 text-sm font-medium', !event && 'cursor-pointer')}>
            <input type="radio" name="activity_type_id" value={activity.id} defaultChecked={event ? activity.slug === savedActivity : index === 0} required={!event} className="size-4 shrink-0 accent-[#006bc9]" />
            <span className="min-w-0 break-words">{activity.name}</span>
          </label>
        ))}
      </div>
      {activityChoices.length === 0 && <p className="mt-2 text-sm text-[#615d59]">Belum ada jenis kegiatan yang tersedia.</p>}
      {event && activityChoices.length > 0 && !activityChoices.some(({ slug }) => slug === savedActivity) && <p className="mt-2 text-sm text-[#615d59]">Jenis kegiatan event belum tersedia.</p>}
    </fieldset>
    <div className="sm:col-span-2"><Label htmlFor="title">Nama event</Label><Input id="title" name="title" defaultValue={event?.title} required maxLength={200} className={field} placeholder="Badminton Jumat malam" /></div>
    <div className="sm:col-span-2"><Label htmlFor="description">Deskripsi <span className="font-normal text-[#615d59]">(opsional)</span></Label><textarea id="description" name="description" defaultValue={event?.description} maxLength={10000} rows={4} className={`${field} h-auto resize-y py-2 placeholder:text-[#615d59]`} placeholder="Level permainan, perlengkapan, atau catatan lain" /></div>
    <div className="sm:col-span-2">
      <Label htmlFor="visibility">Akses event</Label>
      <SearchableSelect id="visibility" name="visibility" defaultValue={event?.visibility ?? 'unlisted'} disabled={Boolean(event)} className="mt-2"><option value="unlisted">Hanya lewat undangan</option><option value="public">Publik</option></SearchableSelect>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">Event undangan tidak tampil di discovery dan hanya dapat dibuka lewat tautan aktif.</p>
    </div>
  </div>;
}
