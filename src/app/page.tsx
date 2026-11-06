import Image from 'next/image';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Simulator } from '@/components/landing/simulator';
import { MobileNav } from '@/components/landing/mobile-nav';
import { categories } from '@/components/landing/content';

const faqs = [
  { question: 'Apakah teman saya harus mengunduh aplikasi Dolend?', answer: 'Tidak perlu. Dolend dirancang sebagai web app yang dibuka melalui browser. Saat ini kamu bisa mencoba simulatornya langsung, tanpa login atau mengunduh aplikasi.' },
  { question: 'Metode pembayaran apa saja yang didukung?', answer: 'Belum ada pembayaran sungguhan pada versi ini. Di simulator, kamu bisa membandingkan skema lunas, DP 50%, dan bayar di lokasi.' },
  { question: 'Bagaimana jika ada peserta yang membatalkan kedatangan?', answer: 'Dalam rencana produknya, pembatalan akan mengikuti aturan penyelenggara dan dapat memerlukan peninjauan pengembalian dana. Simulator ini hanya membantu memahami kuota dan patungan; tidak mengelola pembatalan atau refund sungguhan.' },
  { question: 'Apakah Dolend gratis digunakan?', answer: 'Simulator landing page ini dapat dicoba gratis. Ketentuan layanan dan biaya fitur transaksi akan ditentukan sebelum fitur tersebut tersedia. Saat ini tidak ada biaya yang dipungut di halaman ini.' },
];

const contentWidth = 'mx-auto w-full max-w-6xl px-5 sm:px-8';
const primary = 'min-h-11 rounded-md bg-[#006bc9] px-4 text-white hover:bg-[#005bab]';

export default function Home() {
  return (
    <div id="atas" className="min-h-dvh bg-[#f6f5f4] text-[#171615]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:p-3">Langsung ke konten</a>
      <header className="sticky top-0 z-40 border-b border-[#e6e3df] bg-white">
        <div className={`${contentWidth} relative flex h-16 items-center justify-between gap-4`}>
          <a href="#atas" className="flex min-h-11 items-center text-2xl font-bold tracking-tight" aria-label="Dolend, kembali ke atas">dolend.</a>
          <nav aria-label="Navigasi utama" className="hidden items-center gap-6 text-sm text-[#615d59] lg:flex">
            <a className="py-3 hover:text-black" href="#cara-kerja">Cara kerja</a>
            <a className="py-3 hover:text-black" href="#kategori">Kegiatan</a>
            <a className="py-3 hover:text-black" href="#simulasi">Simulator</a>
            <a className="py-3 hover:text-black" href="#faq">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild className={primary}><a href="/account/">Masuk</a></Button>
            <MobileNav />
          </div>
        </div>
      </header>
      <main id="main" className="scroll-mt-16" tabIndex={-1}>
        <section aria-labelledby="hero-title" className={`${contentWidth} grid items-center gap-8 py-12 sm:py-20 lg:grid-cols-[1fr_1fr] lg:gap-16 lg:py-24`}>
          <div>
            <h1 id="hero-title" className="max-w-[15ch] text-4xl leading-[1.05] font-bold tracking-[-0.035em] sm:text-5xl xl:text-6xl">Atur jadwal main bareng.</h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-[#615d59] sm:text-lg">Sepakati tempat, waktu, dan patungan sebelum mengajak teman. Dari sewa lapangan sampai latihan band, bagikan rencananya lewat satu tautan.</p>
            <Button asChild variant="outline" className="mt-6 min-h-11 rounded-md border-[#d5d0cb] bg-white px-4 text-[#171615] hover:bg-[#eeece9]"><a href="#simulasi">Coba simulator patungan</a></Button>
            <p className="mt-3 text-sm text-[#615d59]">Simulator bisa dicoba tanpa akun.</p>
          </div>
          <figure className="overflow-hidden rounded-xl border border-[#e6e3df] bg-white">
            <div className="relative aspect-[16/8]">
              <Image src="/images/landing/soccer-hero.jpg" alt="Bola di lapangan sepak bola" fill preload sizes="(min-width: 1024px) 520px, 100vw" className="object-cover" />
            </div>
            <figcaption className="px-5 pt-4 text-sm text-[#615d59]">Contoh rencana</figcaption>
            <div className="px-5 pt-1 pb-5">
              <p className="text-xl font-semibold tracking-tight">Mini soccer Sabtu sore</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[#e6e3df] pt-3 text-sm">
                <div><dt className="text-[#615d59]">Peserta</dt><dd className="mt-1 font-medium">12 orang</dd></div>
                <div><dt className="text-[#615d59]">Patungan per orang</dt><dd className="mt-1 font-medium tabular-nums">Rp 50.000</dd></div>
              </dl>
            </div>
          </figure>
        </section>
        <section id="cara-kerja" aria-labelledby="how-title" className="scroll-mt-16 border-y border-[#e6e3df] bg-white">
          <div className={`${contentWidth} grid gap-5 py-10 sm:py-14 md:grid-cols-[1fr_1.5fr]`}>
            <h2 id="how-title" className="max-w-xs text-3xl font-semibold tracking-tight">Dari chat grup ke satu rencana</h2>
            <ol className="divide-y divide-[#e6e3df] text-sm">
              <li className="pb-4"><strong className="block">Tentukan jadwal dan tempat</strong><p className="mt-1 leading-relaxed text-[#615d59]">Catat kapan main, di mana lokasinya, dan berapa orang yang bisa ikut.</p></li>
              <li className="pt-4"><strong className="block">Hitung patungan dan bagikan</strong><p className="mt-1 leading-relaxed text-[#615d59]">Coba bagi biaya di simulator, lalu kirim tautan simulasinya ke grup WhatsApp.</p></li>
            </ol>
          </div>
        </section>
        <Simulator />
        <section id="kategori" aria-labelledby="categories-title" className={`${contentWidth} scroll-mt-16 py-12 sm:py-16`}>
          <h2 id="categories-title" className="text-3xl font-semibold tracking-tight">Mau main apa?</h2>
          <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 sm:gap-6 lg:grid-cols-4">
            {categories.map(category => (
              <li key={category.id}>
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg">
                  <Image src={category.image} alt="" fill sizes="(min-width: 1024px) 260px, 50vw" className="object-cover" />
                </div>
                <p className="mt-2 text-sm font-medium">{category.name}</p>
              </li>
            ))}
          </ul>
        </section>
        <section id="faq" aria-labelledby="faq-title" className="scroll-mt-16 border-t border-[#e6e3df] bg-white">
          <div className={`${contentWidth} grid gap-5 py-12 sm:py-16 md:grid-cols-[1fr_1.5fr]`}>
            <h2 id="faq-title" className="text-3xl font-semibold tracking-tight">Pertanyaan umum</h2>
            <div className="divide-y divide-[#e6e3df] border-y border-[#e6e3df]">
              {faqs.map(faq => (
                <details key={faq.question} className="group">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 text-sm font-semibold marker:hidden">
                    {faq.question}<ChevronDown className="size-4 shrink-0 group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <p className="pb-4 text-sm leading-relaxed text-[#615d59]">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-[#e6e3df]">
        <div className={`${contentWidth} flex flex-wrap items-center justify-between gap-x-6 py-4 text-sm text-[#615d59]`}>
          <p>© 2026 Dolend</p>
          <a href="/demo/" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">Demo aktivitas</a>
        </div>
      </footer>
    </div>
  );
}
