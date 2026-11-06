import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EventManager } from '@/components/organizer/event-manager';
import { OrganizerDashboardShell } from '@/components/organizer/dashboard-shell';

export const metadata: Metadata = { title: 'Kelola Event - Dolend', description: 'Kelola planning, peserta, dan patungan event.' };
export default function ManageEventPage() { return <OrganizerDashboardShell><Suspense fallback={<p role="status">Menyiapkan ruang kelola…</p>}><EventManager /></Suspense></OrganizerDashboardShell>; }
