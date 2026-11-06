import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function SessionGate({ ready }: { ready: boolean }) {
  if (!ready) return <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600" role="status">Memeriksa sesi organizer…</p>;
  return <section className="rounded-xl border border-[#e6e6e6] bg-white p-6" aria-labelledby="signin-required">
    <h1 id="signin-required" className="text-2xl font-semibold tracking-[-0.04em] text-[#171615]">Masuk untuk mengelola event</h1>
    <p className="mt-3 text-sm leading-relaxed text-[#615d59]">Organizer perlu akun Google. Peserta tetap bisa ikut sebagai guest tanpa akun.</p>
    <Button asChild className="mt-5 min-h-11 rounded-full bg-[#0075de] px-5 text-white hover:bg-[#005bab]"><Link href="/account/">Masuk dengan Google</Link></Button>
  </section>;
}
