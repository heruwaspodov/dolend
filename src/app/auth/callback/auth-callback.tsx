'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ensureOwnProfile } from '@/lib/profile-client';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export function AuthCallback() {
  const [error, setError] = useState('');

  useEffect(() => {
    const finish = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      if (!code) throw new Error('Kode login tidak tersedia.');
      const { data, error: exchangeError } = await getSupabaseBrowserClient().auth.exchangeCodeForSession(code);
      if (exchangeError || !data.session) throw exchangeError ?? new Error('Sesi Google tidak tersedia.');
      await ensureOwnProfile(data.session.access_token);
      window.history.replaceState(window.history.state, '', '/auth/callback/');
      window.location.replace('/account/');
    };
    void finish().catch(() => {
      window.history.replaceState(window.history.state, '', '/auth/callback/');
      setError('Login Google belum dapat diselesaikan. Kembali ke halaman akun dan coba lagi.');
    });
  }, []);

  return <Card><CardHeader><CardTitle className="text-2xl">Menyelesaikan login</CardTitle></CardHeader><CardContent>
    {error
      ? <p className="leading-relaxed text-rose-700" role="alert">{error} <a className="font-semibold underline underline-offset-4" href="/account/">Kembali ke akun</a>.</p>
      : <p className="flex items-center gap-2 leading-relaxed text-muted-foreground" aria-live="polite"><LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />Menyiapkan akun Dolend…</p>}
  </CardContent></Card>;
}
