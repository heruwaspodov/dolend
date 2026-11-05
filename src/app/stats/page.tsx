import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/page-shell';
import { StatsPanel } from './stats-panel';

export const metadata: Metadata = { title: 'Statistik aktivitas | Dolend' };

export default function StatsPage() {
  return <div className="min-h-dvh bg-slate-50 text-slate-900"><PageShell><StatsPanel /></PageShell></div>;
}
