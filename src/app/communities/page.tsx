import { Suspense } from 'react';
import { PageShell } from '@/components/layout/page-shell';
import { CommunityHub } from '@/components/community/community-hub';

export default function CommunitiesPage() {
  return <PageShell><Suspense fallback={<p role="status">Memuat komunitas…</p>}><CommunityHub /></Suspense></PageShell>;
}
