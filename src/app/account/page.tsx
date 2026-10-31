import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/page-shell';
import { AccountFoundation } from './account-foundation';

export const metadata: Metadata = {
  title: 'Akun Organizer - Dolend',
  description: 'Masuk dengan Google untuk membuat dan mengelola event Dolend.',
};

export default function AccountPage() {
  return <div className="min-h-dvh bg-slate-50 text-slate-900">
    <PageShell><AccountFoundation /></PageShell>
  </div>;
}
