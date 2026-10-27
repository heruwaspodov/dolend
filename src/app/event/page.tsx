import { Suspense } from 'react';
import { EventDetail, EventLoading } from '@/components/event/event-detail';
import { PageShell } from '@/components/layout/page-shell';
export default function EventPage() {
  return <PageShell><Suspense fallback={<EventLoading />}><EventDetail /></Suspense></PageShell>;
}
