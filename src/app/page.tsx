import type { Metadata } from 'next';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Simulator } from '@/components/landing/simulator';
import { MobileNav } from '@/components/landing/mobile-nav';
import { HeroInvitation } from '@/components/landing/hero-invitation';

export const metadata: Metadata = {
  other: { 'page-type': 'software', 'site-kind': 'software' },
};

const steps = [
  { title: 'Isi detail kegiatan', description: 'Isi jadwal, tempat, kuota, dan biaya kalau perlu patungan.' },
  { title: 'Bagikan undangan', description: 'Kirim tautannya ke grup. Teman bisa daftar lewat browser tanpa akun.' },
  { title: 'Cek peserta dan pembayaran', description: 'Lihat siapa yang sudah daftar, lalu catat pembayarannya.' },
];

const faqs = [
  { question: 'Bisa ikut tanpa akun?', answer: 'Bisa. Teman cukup buka tautan undangan di browser dan daftar sebagai tamu.' },
  { question: 'Bayarnya ke siapa?', answer: 'Bayar langsung ke penyelenggara lewat transfer, QRIS statis, atau tunai, sesuai petunjuk di undangan. Penyelenggara memeriksa pembayaran di Dolend.' },
  { question: 'Bagaimana cara batal ikut?', answer: 'Batalkan lewat tautan pendaftaran atau akunmu. Kalau sudah ada tagihan atau pembayaran, hubungi penyelenggara.' },
  { question: 'Apa bedanya simulasi dan undangan?', answer: 'Simulasi bisa dicoba tanpa akun untuk menghitung patungan. Untuk mengundang teman mendaftar, pilih Buat undangan dan masuk dengan Google.' },
];

const contentWidth = 'mx-auto w-[calc(100%-2.5rem)] max-w-7xl sm:w-[calc(100%-4rem)]';

export default function Home() {
  return (
    <div id="atas" className="min-h-dvh bg-white text-[#171615] [--primary:#006bc9] [--primary-foreground:#fff] [--ring:#006bc9] [&_:is(a,button,input,summary)]:scroll-mt-20">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:p-3">Langsung ke konten</a>
      <header className="sticky top-0 z-40 border-b border-[#e6e3df] bg-[#faf7f2]">
        <div className={`${contentWidth} relative flex h-16 items-center justify-between gap-4`}>
          <a href="#atas" className="flex min-h-11 items-center text-2xl font-bold tracking-tight" aria-label="Dolend, kembali ke atas">dolend.</a>
          <nav aria-label="Navigasi utama" className="hidden items-center gap-7 text-sm text-[#514e4a] lg:flex">
            <a className="py-3 underline-offset-4 hover:text-black hover:underline" href="#cara-kerja">Cara kerja</a>
            <a className="py-3 underline-offset-4 hover:text-black hover:underline" href="#simulasi">Hitung patungan</a>
            <a className="py-3 underline-offset-4 hover:text-black hover:underline" href="#faq">FAQ</a>
          </nav>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" className="min-h-11 px-3"><a href="/account/">Masuk</a></Button>
            <MobileNav />
          </div>
        </div>
      </header>
      <main id="main" className="scroll-mt-16" tabIndex={-1}>
        <section aria-labelledby="hero-title" data-enter="" className="border-b border-[#e6e3df] bg-[#faf7f2]">
          <div className={`${contentWidth} py-8 text-center sm:py-12 lg:py-14`}>
            <h1 id="hero-title" className="mx-auto max-w-[17ch] text-[clamp(2.125rem,6vw,4.5rem)] leading-[1.04] font-extrabold tracking-[-0.04em] text-balance">Main bareng, tinggal kirim undangan.</h1>
            <p className="mx-auto mt-4 max-w-[48ch] text-base leading-relaxed text-[#514e4a] sm:text-xl">Atur jadwal, kuota, dan patungan dalam satu tautan.</p>
            <div className="mx-auto mt-6 grid max-w-sm gap-2.5 min-[400px]:flex min-[400px]:max-w-none min-[400px]:justify-center">
              <Button asChild className="min-h-12 rounded-2xl px-7 text-base font-bold hover:bg-[#005bab] motion-safe:hover:-translate-y-px">
                <a href="/event/create/">Buat undangan</a>
              </Button>
              <Button asChild variant="outline" className="min-h-12 rounded-2xl border-[#171615] bg-transparent px-7 text-base font-bold hover:bg-[#efebe4] motion-safe:hover:-translate-y-px">
                <a href="#simulasi">Hitung patungan</a>
              </Button>
            </div>
            <div className="mt-5 sm:mt-9">
              <HeroInvitation />
            </div>
          </div>
        </section>

        <section id="cara-kerja" aria-labelledby="how-title" className="scroll-mt-16 py-8 sm:py-12">
          <div className={contentWidth}>
            <h2 id="how-title" className="text-2xl font-bold tracking-tight sm:text-3xl">Cara kerja Dolend</h2>
            <ol className="mt-4 grid divide-y divide-[#e6e3df] sm:mt-6 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {steps.map((step, index) => <li key={step.title} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0 sm:px-6 sm:py-0 sm:first:pl-0 sm:last:pr-0">
                <span aria-hidden="true" className="mt-0.5 text-sm font-semibold text-[#615d59] tabular-nums">0{index + 1}</span>
                <div><h3 className="font-semibold">{step.title}</h3><p className="mt-1 max-w-[42ch] text-[0.9375rem] leading-relaxed text-[#514e4a]">{step.description}</p></div>
              </li>)}
            </ol>
          </div>
        </section>

        <Simulator contentWidth={contentWidth} />

        <section id="faq" aria-labelledby="faq-title" className="scroll-mt-16 bg-white">
          <div className={`${contentWidth} grid items-start gap-5 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-10`}>
            <h2 id="faq-title" className="text-2xl font-bold tracking-tight sm:text-3xl">Pertanyaan umum</h2>
            <div>
              <div className="divide-y divide-[#e6e3df] border-y border-[#e6e3df]">
                {faqs.map(faq => (
                  <details key={faq.question} className="group">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 text-sm font-semibold marker:hidden">
                      {faq.question}<ChevronDown className="size-4 shrink-0 motion-safe:transition-transform group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <p className="max-w-[65ch] pb-4 text-[0.9375rem] leading-relaxed text-[#514e4a]">{faq.answer}</p>
                  </details>
                ))}
              </div>
              <a href="/event/create/" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[#005bab] underline-offset-4 hover:underline">
                Buat undangan
              </a>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-[#e6e3df] bg-[#f8f7f4]">
        <div className={`${contentWidth} py-4 text-sm text-[#514e4a]`}>
          <p>© 2026 Dolend</p>
        </div>
      </footer>
    </div>
  );
}
