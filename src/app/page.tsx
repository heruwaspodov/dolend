import type { Metadata } from 'next';
import Image from 'next/image';
import { ArrowDown, ArrowRight, CalendarDays, ChevronDown, FileText, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Simulator } from '@/components/landing/simulator';
import { MobileNav } from '@/components/landing/mobile-nav';

export const metadata: Metadata = {
  other: { 'page-type': 'software', 'site-kind': 'software' },
};

const steps = [
  { title: 'Buat rencana', description: 'Isi jadwal, tempat, kuota, dan biaya kalau perlu patungan.' },
  { title: 'Kirim undangan', description: 'Bagikan satu tautan ke grup. Teman bisa ikut lewat browser tanpa bikin akun.' },
  { title: 'Cek siapa yang ikut', description: 'Lihat siapa yang sudah daftar dan catat pembayaran di halaman event.' },
];

const faqs = [
  { question: 'Apakah teman saya harus mengunduh aplikasi Dolend?', answer: 'Tidak perlu. Mereka bisa membuka undangan dari browser dan mendaftar sebagai tamu.' },
  { question: 'Metode pembayaran apa saja yang didukung?', answer: 'Penyelenggara bisa mencatat pembayaran lewat transfer, QRIS statis, atau tunai. Uang dibayarkan langsung ke penyelenggara, yang kemudian memverifikasinya di Dolend.' },
  { question: 'Bagaimana jika ada peserta yang membatalkan kedatangan?', answer: 'Peserta bisa membatalkan dari tautan booking atau akun mereka. Kalau sudah ada tagihan atau pembayaran, hubungi penyelenggara untuk menyesuaikannya.' },
  { question: 'Apa bedanya simulator dan event?', answer: 'Simulator bisa dicoba tanpa akun untuk menghitung contoh patungan. Untuk membuat undangan yang bisa dipakai teman mendaftar, pilih Buat event dan masuk dengan Google.' },
];

const contentWidth = 'mx-auto w-[calc(100%-2.5rem)] max-w-7xl sm:w-[calc(100%-4rem)]';

export default function Home() {
  return (
    <div id="atas" className="min-h-dvh bg-white text-[#171615] [--primary:#006bc9] [--primary-foreground:#fff] [--ring:#006bc9] [&_:is(a,button,input,summary)]:scroll-mt-20">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:p-3">Langsung ke konten</a>
      <header className="sticky top-0 z-40 border-b border-[#e6e3df] bg-white">
        <div className={`${contentWidth} relative flex h-16 items-center justify-between gap-4`}>
          <a href="#atas" className="flex min-h-11 items-center text-2xl font-bold tracking-tight" aria-label="Dolend, kembali ke atas">dolend.</a>
          <nav aria-label="Navigasi utama" className="hidden items-center gap-7 text-sm text-[#514e4a] lg:flex">
            <a className="py-3 underline-offset-4 hover:text-black hover:underline" href="#cara-kerja">Cara kerja</a>
            <a className="py-3 underline-offset-4 hover:text-black hover:underline" href="#simulasi">Simulator</a>
            <a className="py-3 underline-offset-4 hover:text-black hover:underline" href="#faq">FAQ</a>
          </nav>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" className="min-h-11 px-3"><a href="/account/">Masuk</a></Button>
            <MobileNav />
          </div>
        </div>
      </header>
      <main id="main" className="scroll-mt-16" tabIndex={-1}>
        <section aria-labelledby="hero-title" data-enter="" className="border-b border-[#e6e3df] bg-[#f8f7f4]">
          <div className={`${contentWidth} grid items-center gap-6 py-7 sm:gap-10 sm:pt-12 sm:pb-10 lg:grid-cols-[0.9fr_1fr] lg:gap-12 lg:py-14 xl:gap-20`}>
            <div>
              <h1 id="hero-title" className="max-w-[16ch] text-[2.5rem] leading-[1.04] font-bold tracking-[-0.04em] text-balance sm:text-5xl xl:text-[4.25rem]">Bikin undangan main bareng.</h1>
              <p className="mt-4 max-w-md text-base leading-relaxed text-[#514e4a] sm:mt-5 sm:text-lg">Atur jadwal, kuota, dan patungan di satu tautan. Bagikan ke grup WhatsApp dan lihat siapa yang ikut.</p>
              <div className="mt-6 grid gap-2 sm:flex sm:flex-wrap">
                <Button asChild className="min-h-12 px-5 hover:bg-[#005bab] motion-safe:hover:-translate-y-px">
                  <a href="/event/create/">Buat event <ArrowRight aria-hidden="true" /></a>
                </Button>
                <Button asChild variant="outline" className="min-h-12 border-[#d5d0cb] bg-white px-5 hover:bg-[#eeece9] motion-safe:hover:-translate-y-px">
                  <a href="#simulasi">Coba simulator <ArrowDown aria-hidden="true" /></a>
                </Button>
              </div>
              <p className="mt-3 text-sm text-[#514e4a]">Simulator bisa dicoba tanpa akun.</p>
            </div>
            <div className="rounded-2xl bg-[#e9f1f7] p-2.5 sm:p-5 xl:p-6">
              <article aria-labelledby="example-event" className="overflow-hidden rounded-xl border border-[#d5dee5] bg-white shadow-[0_3px_12px_#253e5610] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300">
                <div className="flex items-center gap-2 border-b border-[#e6e3df] px-4 py-2.5 text-xs font-medium text-[#514e4a] sm:px-5 sm:text-sm">
                  <FileText className="size-4 shrink-0" aria-hidden="true" />
                  Contoh undangan
                </div>
                <div className="relative h-28 overflow-hidden bg-[#263b43] sm:h-40">
                  <Image src="/images/landing/badminton.jpg" alt="" fill preload sizes="(min-width: 1024px) 585px, 100vw" className="object-cover object-[center_26%]" />
                </div>
                <div className="space-y-3.5 p-4 sm:px-5 sm:py-4">
                  <div>
                    <p id="example-event" className="text-xl font-bold tracking-tight sm:text-2xl">Badminton Sabtu pagi</p>
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[#514e4a] sm:text-sm" aria-label="Jadwal dan lokasi">
                      <li className="flex items-center gap-1.5"><CalendarDays className="size-4 shrink-0" aria-hidden="true" /> Sabtu, 08.00–10.00 WIB</li>
                      <li className="flex items-center gap-1.5"><MapPin className="size-4 shrink-0" aria-hidden="true" /> GOR Badminton</li>
                    </ul>
                  </div>
                  <dl className="grid grid-cols-2 rounded-lg bg-[#f6f5f4] px-3 py-2.5">
                    <div className="flex flex-col justify-between pr-2"><dt className="text-xs text-[#514e4a]">Total biaya</dt><dd className="mt-1 text-base font-bold tabular-nums sm:text-lg">Rp 240.000</dd></div>
                    <div className="flex flex-col justify-between border-l border-[#e6e3df] pl-2 text-right"><dt className="text-xs text-[#514e4a]">Per orang jika kuota penuh</dt><dd className="mt-1 text-base font-bold text-[#005bab] tabular-nums sm:text-lg">Rp 30.000</dd></div>
                  </dl>
                  <div>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs font-semibold sm:text-sm">
                      <span>Kuota terkonfirmasi</span><span className="text-[#005bab] tabular-nums">5 / 8 terisi</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e8edf1]" aria-hidden="true"><div className="h-full w-[62.5%] rounded-full bg-[#006bc9]" /></div>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="cara-kerja" aria-labelledby="how-title" className="scroll-mt-16 py-8 sm:py-10">
          <div className={contentWidth}>
            <h2 id="how-title" className="text-2xl font-bold tracking-tight sm:text-3xl">Cara kerja Dolend</h2>
            <ol className="mt-4 grid divide-y divide-[#e6e3df] sm:mt-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {steps.map((step, index) => <li key={step.title} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 sm:px-6 sm:py-0 sm:first:pl-0 sm:last:pr-0">
                <span aria-hidden="true" className="mt-0.5 text-sm font-semibold text-[#005bab] tabular-nums">0{index + 1}</span>
                <div><h3 className="font-semibold">{step.title}</h3><p className="mt-1 text-sm leading-relaxed text-[#514e4a]">{step.description}</p></div>
              </li>)}
            </ol>
          </div>
        </section>

        <Simulator />

        <section id="faq" aria-labelledby="faq-title" className="scroll-mt-16 bg-white">
          <div className={`${contentWidth} grid gap-5 py-12 sm:py-16 lg:grid-cols-2 lg:gap-6`}>
            <h2 id="faq-title" className="text-2xl font-bold tracking-tight sm:text-3xl">Pertanyaan umum</h2>
            <div>
              <div className="divide-y divide-[#e6e3df] border-y border-[#e6e3df]">
                {faqs.map(faq => (
                  <details key={faq.question} className="group">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 text-sm font-semibold marker:hidden">
                      {faq.question}<ChevronDown className="size-4 shrink-0 motion-safe:transition-transform group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <p className="pb-4 text-sm leading-relaxed text-[#514e4a]">{faq.answer}</p>
                  </details>
                ))}
              </div>
              <a href="/event/create/" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#005bab] underline-offset-4 hover:underline">
                Mulai buat event <ArrowRight className="size-4" aria-hidden="true" />
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
