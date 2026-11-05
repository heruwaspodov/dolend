'use client';

import { useEffect, useState } from 'react';
import { organizerRequest, type OrganizerEvent } from '@/lib/organizer-client';
import { useOrganizerSession } from '@/lib/use-organizer-session';

export function useOrganizerEvents() {
  const { session, ready } = useOrganizerSession();
  const [result, setResult] = useState<{ userId: string; events: OrganizerEvent[]; error: string } | null>(null);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    void organizerRequest<OrganizerEvent[]>('/organizer/events', session.access_token, { signal: controller.signal })
      .then((events) => { if (!controller.signal.aborted) setResult({ userId: session.user.id, events, error: '' }); })
      .catch((reason: Error) => {
        if (!controller.signal.aborted && reason.name !== 'AbortError') setResult({ userId: session.user.id, events: [], error: reason.message });
      });
    return () => controller.abort();
  }, [session]);

  const currentResult = session && result?.userId === session.user.id ? result : null;
  return {
    session,
    ready,
    events: currentResult?.events ?? [],
    loading: !session ? !ready : !currentResult,
    error: currentResult?.error ?? '',
  };
}
