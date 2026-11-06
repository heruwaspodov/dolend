import type { Metadata } from 'next';
import { OrganizerDashboardShell } from '@/components/organizer/dashboard-shell';
import { ActivityFeed } from './activity-feed';

export const metadata: Metadata = { title: 'Aktivitas - Dolend', description: 'Aktivitas teman dan komunitasmu di Dolend.' };
export default function FeedPage() {
  return <OrganizerDashboardShell><ActivityFeed /></OrganizerDashboardShell>;
}
