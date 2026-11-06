import type { Metadata } from 'next';
import { StatsPanel } from './stats-panel';
import { OrganizerDashboardShell } from '@/components/organizer/dashboard-shell';

export const metadata: Metadata = { title: 'Statistik aktivitas | Dolend' };

export default function StatsPage() {
  return <OrganizerDashboardShell><StatsPanel /></OrganizerDashboardShell>;
}
