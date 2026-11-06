import type { Metadata } from 'next';
import { OrganizerDashboard } from '@/components/organizer/dashboard';
import { OrganizerDashboardShell } from '@/components/organizer/dashboard-shell';

export const metadata: Metadata = { title: 'Dashboard Organizer - Dolend', description: 'Buat dan kelola event Dolend.' };
export default function DashboardPage() { return <OrganizerDashboardShell><OrganizerDashboard /></OrganizerDashboardShell>; }
