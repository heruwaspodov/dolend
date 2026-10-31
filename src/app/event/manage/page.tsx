import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EventManager } from '@/components/organizer/event-manager';
import { PageShell } from '@/components/layout/page-shell';

export const metadata: Metadata = { title: 'Kelola Event - Dolend', description: 'Kelola planning, peserta, dan patungan event.' };
export default function ManageEventPage() { return <div className="min-h-dvh bg-slate-50 text-slate-900"><PageShell><Suspense fallback={<p role="status">Menyiapkan ruang kelola…</p>}><EventManager /></Suspense></PageShell></div>; }
