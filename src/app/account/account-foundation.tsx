'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { LogIn, UserRound } from 'lucide-react';
import { WorkspaceFormHeader, workspaceFormAction, workspaceFormPanel, workspaceFormWidth } from '@/components/organizer/workspace-form';
import { Button } from '@/components/ui/button';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { ProfileEditor } from './profile-editor';
import { PaymentReviews } from './payment-reviews';
import { PaymentSettings } from './payment-settings';

export function AccountFoundation() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    setSigningIn(true);
    setAuthError('');
    const { error } = await getSupabaseBrowserClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback/` },
    });
    if (error) {
      setAuthError('Google belum dapat dibuka. Coba lagi.');
      setSigningIn(false);
    }
  }

  if (!sessionReady) return <p className="text-sm text-[#615d59]" role="status">Memeriksa sesi…</p>;

  if (!session) return <section className={`${workspaceFormWidth} ${workspaceFormPanel}`}>
    <WorkspaceFormHeader icon={UserRound} title="Akun" description="Masuk dengan Google untuk mengelola profil dan event." />
    <div className="space-y-4 px-5 py-6 sm:px-8">
      <Button type="button" className={workspaceFormAction} onClick={signInWithGoogle} disabled={signingIn}><LogIn aria-hidden="true" />{signingIn ? 'Membuka Google…' : 'Masuk dengan Google'}</Button>
      {authError && <p className="text-sm font-medium text-[#9a332c]" role="alert">{authError}</p>}
    </div>
  </section>;

  return (
    <div className={`${workspaceFormWidth} ${workspaceFormPanel}`}>
      <WorkspaceFormHeader icon={UserRound} title="Akun" description="Kelola profil dan pembayaran untuk event yang kamu adakan." />
      <ProfileEditor session={session} />
      <PaymentSettings token={session.access_token} />
      <PaymentReviews token={session.access_token} />
    </div>
  );
}
