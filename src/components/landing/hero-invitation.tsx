'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { CalendarDays, MapPin } from 'lucide-react';
import styles from './hero-invitation.module.css';

export function HeroInvitation() {
  const invitation = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = invitation.current;
    if (!element || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;

      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        element.dataset.arrived = '';
      }
      observer.disconnect();
    }, { threshold: 0.4 });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={invitation} className={styles.stage}>
      <Image
        src="/images/landing/invite-sender.webp"
        width={360}
        height={518}
        alt=""
        className={styles.sender}
      />
      <Image
        src="/images/landing/badminton-player.webp"
        width={360}
        height={453}
        alt=""
        className={styles.player}
      />
      <article aria-labelledby="example-event" className="relative z-10 rounded-xl border border-[#c9c2b9] bg-white px-4 py-5 text-left shadow-[0_4px_10px_#30251a14] sm:p-8">
        <p className="text-sm font-semibold text-[#514e4a]">Contoh undangan</p>
        <h2 id="example-event" className="mt-1 text-[clamp(1.4rem,4.4vw,2.25rem)] leading-tight font-extrabold tracking-tight">Badminton Sabtu pagi</h2>
        <ul className="mt-4 grid gap-2 text-sm sm:text-lg" aria-label="Jadwal dan lokasi">
          <li className="flex items-center gap-3"><CalendarDays className="size-5 shrink-0" aria-hidden="true" /> Sabtu, 08.00–10.00 WIB</li>
          <li className="flex items-center gap-3"><MapPin className="size-5 shrink-0" aria-hidden="true" /> GOR Badminton</li>
        </ul>
        <div className="mt-5 grid grid-cols-[1.25fr_1fr] border-t border-[#e6e3df] pt-4">
          <div className="pr-3">
            <p className="text-sm font-extrabold tabular-nums sm:text-xl">Rp 30.000 / orang</p>
            <p className="mt-0.5 text-xs text-[#514e4a] sm:text-sm">Jika kuota penuh</p>
          </div>
          <div className="border-l border-[#e6e3df] pl-3 sm:pl-6">
            <span className="sr-only">Kuota contoh, 5 dari 8 terisi</span>
            <div aria-hidden="true" className="text-sm font-extrabold text-primary tabular-nums sm:text-xl">
              <span className={styles.count}><span className={styles.before}>4</span><span className={styles.after}>5</span></span> / 8 terisi
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#e6e3df]">
                <div className={styles.fill} />
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
