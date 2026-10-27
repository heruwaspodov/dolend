import type { Metadata } from 'next';
import '@fontsource-variable/plus-jakarta-sans';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://dolend.web.app'),
  title: 'Dolend — Main & Patungan Tanpa Ribet',
  description: 'Rencanakan aktivitas bareng, coba hitung patungan, dan bagikan simulasi ke teman lewat Dolend. Tanpa install aplikasi.',
  openGraph: { title: 'Dolend — Main & Patungan Tanpa Ribet', description: 'Satu rencana untuk waktu, tempat, dan patungan bersama. Coba simulasi Dolend.', url: '/', siteName: 'Dolend', locale: 'id_ID', type: 'website', images: [{ url: '/images/landing/soccer-hero.jpg', alt: 'Main bareng bersama Dolend' }] },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body className="min-h-dvh antialiased">{children}</body></html>;
}
