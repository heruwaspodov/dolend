import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/page-shell';
import { RecommendationsPanel } from './recommendations-panel';

export const metadata: Metadata = { title: 'Rekomendasi acara | Dolend', description: 'Temukan acara publik berdasarkan minat yang kamu pilih.' };

export default function RecommendationsPage() {
  return <div className="min-h-dvh bg-slate-50 text-slate-900"><PageShell><RecommendationsPanel /></PageShell></div>;
}
