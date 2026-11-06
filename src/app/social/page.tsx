import type { Metadata } from 'next';
import { SocialPanel } from './social-panel';
import { OrganizerDashboardShell } from '@/components/organizer/dashboard-shell';

export const metadata: Metadata = { title: 'Privasi dan relasi - Dolend', description: 'Atur privasi profil, permintaan mengikuti, dan akun yang diblokir.' };

export default function SocialPage() {
  return <OrganizerDashboardShell><SocialPanel /></OrganizerDashboardShell>;
}
