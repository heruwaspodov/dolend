import type { Metadata } from 'next';
import { OrganizerDashboard } from '@/components/organizer/dashboard';
import { PageShell } from '@/components/layout/page-shell';

export const metadata: Metadata = { title: 'Dashboard Organizer - Dolend', description: 'Buat dan kelola event Dolend.' };
export default function DashboardPage() { return <div className="min-h-dvh bg-slate-50 text-slate-900"><PageShell><OrganizerDashboard /></PageShell></div>; }
