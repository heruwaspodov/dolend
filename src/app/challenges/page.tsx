import type { Metadata } from 'next';
import { ChallengeHub } from './challenge-hub';
import { OrganizerDashboardShell } from '@/components/organizer/dashboard-shell';

export const metadata: Metadata = { title: 'Challenges - Dolend', description: 'Ikuti tantangan aktivitas berbasis kehadiran terverifikasi.' };

export default function ChallengesPage() {
  return <OrganizerDashboardShell><ChallengeHub /></OrganizerDashboardShell>;
}
