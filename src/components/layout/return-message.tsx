'use client';
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ReturnMessage({ kind }: { kind: 'auth' | 'payment' }) {
  useEffect(() => {
    // Callback shells never expose codes/tokens or treat a return URL as proof of success.
    window.history.replaceState(window.history.state, '', window.location.pathname);
  }, []);
  return <Card><CardHeader><CardTitle className="text-2xl">{kind === 'auth' ? 'Kembali ke Dolend' : 'Konfirmasi pembayaran'}</CardTitle></CardHeader><CardContent>
    <p className="leading-relaxed text-muted-foreground">{kind === 'auth' ? 'Layanan akun sedang disiapkan. Proses masuk belum dapat diselesaikan di halaman ini.' : 'Status pembayaran belum tersedia. Tautan kembali ini belum mengonfirmasi pembayaran Anda.'}</p>
  </CardContent></Card>;
}
