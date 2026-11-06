import { Suspense } from 'react';
import { CommunityHub } from '@/components/community/community-hub';
import { OrganizerDashboardShell } from '@/components/organizer/dashboard-shell';

export default function CommunitiesPage() {
  return <OrganizerDashboardShell><Suspense fallback={<p role="status">Memuat komunitas…</p>}><CommunityHub /></Suspense></OrganizerDashboardShell>;
}
