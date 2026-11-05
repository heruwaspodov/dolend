import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/page-shell';
import { ChallengeHub } from './challenge-hub';

export const metadata: Metadata = { title: 'Challenges - Dolend', description: 'Ikuti tantangan aktivitas berbasis kehadiran terverifikasi.' };

export default function ChallengesPage() {
  return <div className="min-h-dvh bg-slate-50 text-slate-900"><PageShell><ChallengeHub /></PageShell></div>;
}
