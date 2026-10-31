import type { Metadata } from 'next';
import { EventCreateForm } from '@/components/organizer/event-create-form';
import { PageShell } from '@/components/layout/page-shell';

export const metadata: Metadata = { title: 'Buat Event - Dolend', description: 'Buat event dan mulai mengajak peserta.' };
export default function CreateEventPage() { return <div className="min-h-dvh bg-slate-50 text-slate-900"><PageShell><EventCreateForm /></PageShell></div>; }
