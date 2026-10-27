import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/page-shell';
import { AccountFoundation } from './account-foundation';

export const metadata: Metadata = {
  title: 'Fondasi Akun — Dolend',
  description: 'Validasi format nomor seluler Indonesia dan fondasi sesi akun Dolend.',
};

export default function AccountPage() {
  return <div className="min-h-dvh bg-slate-50 text-slate-900">
    <PageShell><AccountFoundation /></PageShell>
  </div>;
}
