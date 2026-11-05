import type { Metadata } from 'next';
import { EventCreateForm } from '@/components/organizer/event-create-form';
import { OrganizerDashboardShell } from '@/components/organizer/dashboard-shell';

export const metadata: Metadata = { title: 'Buat Event - Dolend', description: 'Buat event dan mulai mengajak peserta.' };
export default function CreateEventPage() { return <OrganizerDashboardShell><EventCreateForm /></OrganizerDashboardShell>; }
