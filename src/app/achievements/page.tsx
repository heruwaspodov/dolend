import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/page-shell';
import { AchievementShelf } from './achievement-shelf';

export const metadata: Metadata = { title: 'Pencapaian - Dolend', description: 'Lihat pencapaian dari kehadiran event terverifikasi.' };

export default function AchievementsPage() {
  return <div className="min-h-dvh bg-slate-50 text-slate-900"><PageShell><AchievementShelf /></PageShell></div>;
}
