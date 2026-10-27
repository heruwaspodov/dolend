'use client';
import { useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  return <nav aria-label="Navigasi mobile" className="lg:hidden" onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); button.current?.focus(); } }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <Button ref={button} variant="ghost" size="icon" className="size-11" aria-label={open ? 'Tutup menu' : 'Buka menu'} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(value => !value)}>{open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</Button>
    {open && <div id="mobile-navigation" className="absolute inset-x-0 top-full border-b border-slate-200 bg-white px-4 py-3 shadow-lg">{[['#cara-kerja', 'Cara Kerja'], ['#kategori', 'Kategori Venue'], ['#simulasi', 'Simulasi Patungan'], ['#faq', 'FAQ']].map(([href, title]) => <a key={href} href={href} onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">{title}</a>)}</div>}
  </nav>;
}
