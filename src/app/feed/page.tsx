import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/page-shell';
import { ActivityFeed } from './activity-feed';

export const metadata: Metadata = { title: 'Aktivitas - Dolend', description: 'Aktivitas teman dan komunitasmu di Dolend.' };
export default function FeedPage() {
  return <div className="min-h-dvh bg-slate-50 text-slate-900"><PageShell><ActivityFeed /></PageShell></div>;
}
