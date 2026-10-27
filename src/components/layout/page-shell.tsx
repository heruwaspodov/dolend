import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PageShell({ children }: { children: React.ReactNode }) {
  return <>
    <header className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-6 sm:px-8">
      <Link href="/" className="text-2xl font-bold tracking-tight" aria-label="Dolend, beranda">dolend.</Link>
      <Button asChild variant="ghost" className="min-h-11"><Link href="/"><ArrowLeft aria-hidden="true" /> Beranda</Link></Button>
    </header>
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8">{children}</main>
  </>;
}
