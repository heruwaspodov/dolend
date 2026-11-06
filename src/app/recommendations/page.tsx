import type { Metadata } from 'next';
import { RecommendationsPanel } from './recommendations-panel';
import { OrganizerDashboardShell } from '@/components/organizer/dashboard-shell';

export const metadata: Metadata = { title: 'Rekomendasi acara | Dolend', description: 'Temukan acara publik berdasarkan minat yang kamu pilih.' };

export default function RecommendationsPage() {
  return <OrganizerDashboardShell><RecommendationsPanel /></OrganizerDashboardShell>;
}
