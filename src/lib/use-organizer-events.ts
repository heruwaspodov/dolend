'use client';

import { useEffect, useState } from 'react';
import { organizerRequest, type OrganizerEvent } from '@/lib/organizer-client';
import { useOrganizerSession } from '@/lib/use-organizer-session';

export function useOrganizerEvents(view?: 'active' | 'archived') {
  const { session, ready } = useOrganizerSession();
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ userId: string; view: typeof view; revision: number; events: OrganizerEvent[]; error: string } | null>(null);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    void organizerRequest<OrganizerEvent[]>(view ? `/organizer/events?view=${view}` : '/organizer/events', session.access_token, { signal: controller.signal })
      .then((events) => {
        if (controller.signal.aborted) return;
        const visible = view === 'archived' ? events.filter(event => event.archived_at) : events;
        setResult({ userId: session.user.id, view, revision, events: visible, error: '' });
      })
      .catch((reason: Error) => {
        if (!controller.signal.aborted && reason.name !== 'AbortError') setResult({ userId: session.user.id, view, revision, events: [], error: reason.message });
      });
    return () => controller.abort();
  }, [session, view, revision]);

  const currentResult = session && result?.userId === session.user.id && result.view === view && result.revision === revision ? result : null;
  return {
    session,
    ready,
    reload: () => setRevision(value => value + 1),
    events: currentResult?.events ?? [],
    loading: !session ? !ready : !currentResult,
    error: currentResult?.error ?? '',
  };
}
