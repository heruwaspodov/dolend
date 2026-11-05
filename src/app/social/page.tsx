import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/page-shell';
import { SocialPanel } from './social-panel';

export const metadata: Metadata = { title: 'Privasi dan relasi - Dolend', description: 'Atur privasi profil, permintaan mengikuti, dan akun yang diblokir.' };

export default function SocialPage() {
  return <div className="min-h-dvh bg-slate-50 text-slate-900"><PageShell><SocialPanel /></PageShell></div>;
}
