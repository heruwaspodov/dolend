'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Info, LogIn, LogOut, ShieldCheck, UsersRound } from 'lucide-react';
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

  async function logout() {
    await getSupabaseBrowserClient().auth.signOut();
  }

  return <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8" aria-labelledby="account-title">
      <div className="mb-6 flex size-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><ShieldCheck aria-hidden="true" /></div>
      <p className="text-xs font-bold tracking-widest text-emerald-700 uppercase">Akun organizer</p>
      <h1 id="account-title" className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Kelola event dengan akun Google</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">Organizer wajib masuk dengan Google. Akun yang sama tetap bisa mendaftar sebagai peserta pada event mana pun.</p>

      <div className="mt-7 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <h2 className="font-bold">Status sesi</h2>
        <p className="mt-2 break-all text-sm leading-relaxed text-slate-600" aria-live="polite">{!sessionReady ? 'Memeriksa sesi…' : session ? `Masuk sebagai ${session.user.email ?? 'akun Google'}.` : 'Belum masuk.'}</p>
        {!sessionReady ? null : session
          ? <Button type="button" variant="outline" className="mt-4 min-h-11" onClick={logout}><LogOut aria-hidden="true" />Keluar</Button>
          : <Button type="button" className="mt-4 min-h-11 bg-emerald-700 px-5 text-white hover:bg-emerald-800" onClick={signInWithGoogle} disabled={signingIn}><LogIn aria-hidden="true" />{signingIn ? 'Membuka Google…' : 'Masuk dengan Google'}</Button>}
        {authError && <p className="mt-3 text-sm font-medium text-rose-700" role="alert">{authError}</p>}
      </div>
    </section>

    <aside className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5" aria-labelledby="guest-title">
        <UsersRound className="size-6 text-emerald-700" aria-hidden="true" />
        <h2 id="guest-title" className="mt-4 font-bold">Peserta tidak wajib punya akun</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">Guest dapat booking memakai nama dan WhatsApp. Tautan booking rahasia menjadi akses untuk melihat status booking tersebut.</p>
      </section>
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
        <p className="flex items-center gap-2 font-bold"><Info className="size-5" aria-hidden="true" />Batas akses</p>
        <p className="mt-3 text-xs leading-relaxed">Login Google memberi identitas akun. Hak mengelola diberikan per workspace atau event, bukan sebagai jenis akun terpisah.</p>
      </section>
    </aside>
    {session && <div className="lg:col-span-2"><ProfileEditor session={session} /><div className="mt-6"><PaymentSettings token={session.access_token} /><PaymentReviews token={session.access_token} /></div></div>}
  </div>;
}
