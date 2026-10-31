import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function SessionGate({ ready }: { ready: boolean }) {
  if (!ready) return <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600" role="status">Memeriksa sesi organizer…</p>;
  return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="signin-required">
    <h1 id="signin-required" className="text-2xl font-extrabold tracking-tight">Masuk untuk mengelola event</h1>
    <p className="mt-3 text-sm leading-relaxed text-slate-600">Organizer perlu akun Google. Peserta tetap bisa ikut sebagai guest tanpa akun.</p>
    <Button asChild className="mt-5 min-h-11 bg-emerald-700 px-5 text-white hover:bg-emerald-800"><Link href="/account/">Masuk dengan Google</Link></Button>
  </section>;
}
