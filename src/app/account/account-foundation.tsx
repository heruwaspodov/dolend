'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Info, LogOut, ShieldCheck, Smartphone } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { normalizeIndonesianPhone, PhoneValidationError, type IndonesianPhone } from '@/lib/phone';

export function AccountFoundation() {
  const [phone, setPhone] = useState('');
  const [normalized, setNormalized] = useState<IndonesianPhone>();
  const [error, setError] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

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

  function validatePhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setNormalized(normalizeIndonesianPhone(phone));
      setError('');
    } catch (validationError) {
      setNormalized(undefined);
      setError(validationError instanceof PhoneValidationError ? validationError.message : 'Nomor belum dapat diperiksa.');
    }
  }

  async function logout() {
    await getSupabaseBrowserClient().auth.signOut();
  }

  return <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8" aria-labelledby="phone-title">
      <div className="mb-6 flex size-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Smartphone aria-hidden="true" /></div>
      <p className="text-xs font-bold tracking-widest text-emerald-700 uppercase">Fondasi akun</p>
      <h1 id="phone-title" className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Nomor Indonesia, satu identitas Dolend</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">Coba format nomor yang akan dipakai untuk akun. Tahap ini hanya memvalidasi di perangkatmu dan belum mengirim SMS.</p>

      <form className="mt-7 space-y-4" onSubmit={validatePhone} noValidate>
        <div className="space-y-2">
          <Label htmlFor="phone">Nomor WhatsApp Indonesia</Label>
          <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" className="min-h-12 px-4" placeholder="0812 3456 7890" value={phone} onChange={(event) => setPhone(event.target.value)} aria-describedby="phone-help phone-error" aria-invalid={Boolean(error)} />
          <p id="phone-help" className="text-xs text-slate-500">Boleh diawali 08, 62, atau +62. Hanya nomor seluler Indonesia.</p>
          {error && <p id="phone-error" role="alert" className="text-sm font-medium text-rose-700">{error}</p>}
        </div>
        <Button type="submit" className="min-h-11 bg-emerald-700 px-5 text-white hover:bg-emerald-800">Periksa format nomor</Button>
      </form>

      {normalized && <div role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
        <p className="flex items-center gap-2 font-bold"><CheckCircle2 className="size-5 text-emerald-700" aria-hidden="true" />Format nomor valid</p>
        <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <div><dt className="text-emerald-800">Tampilan</dt><dd className="mt-1 font-semibold" data-testid="phone-display">{normalized.display}</dd></div>
          <div><dt className="text-emerald-800">Identitas tersimpan</dt><dd className="mt-1 font-mono font-semibold" data-testid="phone-normalized">{normalized.normalized}</dd></div>
        </dl>
        <p className="mt-3 border-t border-emerald-200 pt-3 text-xs leading-relaxed"><strong>Belum ada OTP yang dikirim.</strong> Aktivasi akun menunggu provider SMS Indonesia dipilih dan diuji.</p>
      </div>}
    </section>

    <aside className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5" aria-labelledby="session-title">
        <ShieldCheck className="size-6 text-emerald-700" aria-hidden="true" />
        <h2 id="session-title" className="mt-4 font-bold">Status sesi Supabase</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600" aria-live="polite">{!sessionReady ? 'Memeriksa sesi…' : session ? `Masuk sebagai ${session.user.phone ?? 'akun terverifikasi'}.` : 'Belum masuk. Login OTP belum diaktifkan.'}</p>
        {session && <Button type="button" variant="outline" className="mt-4 min-h-11" onClick={logout}><LogOut aria-hidden="true" />Keluar</Button>}
      </section>
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
        <p className="flex items-center gap-2 font-bold"><Info className="size-5" aria-hidden="true" />Yang sudah aman disiapkan</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-relaxed">
          <li>Format database selalu <code>62...</code>, bukan angka dan bukan kredensial.</li>
          <li>Adapter provider kelak menerima format E.164 <code>+62...</code>.</li>
          <li>Session refresh dan logout memakai SDK Supabase di static app.</li>
          <li>Server tetap wajib mengulang validasi sebelum membuat atau mengubah profil.</li>
        </ul>
      </section>
    </aside>
  </div>;
}
