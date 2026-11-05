import type { Metadata } from 'next';
import { OrganizerDashboardShell } from '@/components/organizer/dashboard-shell';
import { AccountFoundation } from './account-foundation';

export const metadata: Metadata = {
  title: 'Akun Organizer - Dolend',
  description: 'Masuk dengan Google untuk membuat dan mengelola event Dolend.',
};

export default function AccountPage() {
  return <OrganizerDashboardShell><AccountFoundation /></OrganizerDashboardShell>;
}
