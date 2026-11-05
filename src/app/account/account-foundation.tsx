'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { LogIn } from 'lucide-react';
import { workspaceFormPanel, workspaceFormWidth } from '@/components/organizer/workspace-form';
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

  if (!session) return <section className="max-w-xl space-y-4">
    <div><h1 className="text-2xl font-semibold tracking-[-0.04em] text-[#171615]">Akun</h1><p className="mt-2 text-sm leading-relaxed text-[#615d59]">Masuk dengan Google untuk mengelola profil dan event.</p></div>
    <Button type="button" className="min-h-11 rounded-full bg-[#0075de] px-5 text-white hover:bg-[#005bab]" onClick={signInWithGoogle} disabled={signingIn}><LogIn aria-hidden="true" />{signingIn ? 'Membuka Google…' : 'Masuk dengan Google'}</Button>
    {authError && <p className="text-sm font-medium text-[#9a332c]" role="alert">{authError}</p>}
  </section>;

  return (
    <div className={workspaceFormWidth}>
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Akun</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Kelola profil dan pembayaran untuk event yang kamu adakan.</p>
      </header>
      <div className={workspaceFormPanel}>
        <ProfileEditor session={session} />
        <PaymentSettings token={session.access_token} />
        <PaymentReviews token={session.access_token} />
      </div>
    </div>
  );
}
