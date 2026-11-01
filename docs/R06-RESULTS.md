# Hasil verifikasi R06

Tanggal: 1 November 2026.

Runner lokal `npm run test:r06` memisahkan build normal dari build fixture agar adapter pratinjau tidak menyamarkan alur API nyata. Urutannya adalah replay database, build normal, browser checks guest/payment/organizer, build fixture, pembuatan fixture publik, lalu browser checks static hosting.

## Hasil lokal

| Area | Hasil |
| --- | --- |
| Database | 14 migration direplay; 53 pemeriksaan transaksi, integritas, dan otorisasi lulus |
| Pembatalan dynamic | Before/after lock, retain/waive, retry, organizer lain ditolak, completed ditolak, receipt tetap tersimpan |
| Build normal | 11 halaman static export berhasil dibuat |
| Browser build normal | 16 checks desktop/mobile lulus |
| Guest payment | Token fragment dikirim hanya sebagai header scoped; upload PNG menghasilkan storage path; laporan tetap pending verification |
| Organizer | Create, roster, guest link rotation, pembatalan peserta/event, outstanding completed, review, dan tunai lulus |
| Build fixture | 11 halaman static export dan fixture publik berhasil dibuat |
| Static hosting | 14 checks desktop/mobile lulus; direct open dan refresh untuk event, dashboard, create, manage, auth callback, dan payment shell |

Callback OAuth palsu harus gagal dengan pesan aman dan URL yang sudah dibersihkan. Parameter return pembayaran tidak pernah diperlakukan sebagai konfirmasi pembayaran.

## Gate hosted yang tersisa

- Migration sampai `20261031150000_dynamic_event_cancellation.sql` sudah diterapkan ke project hosted pada 1 November 2026.
- Edge Function `dolend-api` versi 16 aktif dengan `STORAGE_PROVIDER=supabase` dan rate-limit pepper server-only.
- E2E Supabase Storage lulus untuk upload QRIS authenticated, private object, cross-owner denial, disable method, dan cleanup fixture.
- Regression database hosted lulus untuk concurrency join/callback/refund, RLS, expiry, late payment, dan cleanup fixture.
- Concurrency khusus RPC dynamic manual masih perlu runner lintas koneksi tersendiri.
- Upload bukti guest pada browser lokal memakai kontrak HTTP terkontrol; penyimpanan file guest nyata dan signed URL lintas owner masih perlu E2E hosted.
- Adapter Storage lokal mendukung Supabase dan S3-compatible dengan referensi campuran; konfigurasi S3 belum diuji terhadap bucket hosted nyata.
- Workflow Firebase untuk commit R05 `3179385` selesai sukses; redirect Google pada domain Firebase dan pilot manual dengan event nyata tetap perlu diperiksa terpisah.

Semua fixture Auth, database, dan Storage dari verifikasi hosted dibersihkan setelah pengujian.
