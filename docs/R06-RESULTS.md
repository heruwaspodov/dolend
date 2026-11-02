# Hasil verifikasi R06

Tanggal: 3 November 2026.

Runner lokal `npm run test:r06` memisahkan build normal dari build fixture agar adapter pratinjau tidak menyamarkan alur API nyata. Urutannya adalah replay database, build normal, browser checks guest/payment/organizer, build fixture, pembuatan fixture publik, lalu browser checks static hosting.

## Hasil lokal

| Area | Hasil |
| --- | --- |
| Database | 17 migration direplay; 64 pemeriksaan transaksi, integritas, dan otorisasi lulus |
| Pembatalan dynamic | Before/after lock, retain/waive, retry, organizer lain ditolak, completed ditolak, receipt tetap tersimpan |
| Build normal | 11 halaman static export berhasil dibuat |
| Browser build normal | 22 checks desktop/mobile lulus |
| Guest payment | Token fragment dikirim hanya sebagai header scoped; upload PNG menghasilkan storage path; laporan tetap pending verification |
| Organizer | Create, roster, guest link rotation, pembatalan peserta/event, outstanding completed, review, dan tunai lulus |
| Build fixture | 11 halaman static export dan fixture publik berhasil dibuat |
| Static hosting | 14 checks desktop/mobile lulus; direct open dan refresh untuk event, dashboard, create, manage, auth callback, dan payment shell |

Callback OAuth palsu harus gagal dengan pesan aman dan URL yang sudah dibersihkan. Parameter return pembayaran tidak pernah diperlakukan sebagai konfirmasi pembayaran.

## Gate hosted yang tersisa

- Migration sampai `20261103100000_harden_event_updates.sql` sudah diterapkan ke project hosted pada 3 November 2026.
- Edge Function `dolend-api` versi 19 aktif dengan `STORAGE_PROVIDER=supabase` dan rate-limit pepper server-only.
- E2E Supabase Storage lulus untuk upload QRIS authenticated serta alur guest-token → upload bukti → laporan pending → signed review organizer. Object QRIS/bukti tetap private; token guest lain dan organizer lain ditolak.
- E2E venue dan versioned event edit hosted lulus untuk create/read snapshot, pembuatan Maps URL, penolakan host asing, optimistic conflict 409, audit field/version tanpa isi privat, penolakan organizer lain, serta cleanup fixture. API `dolend-api` v19 aktif dan migration local/remote sejajar sampai `20261103100000`.
- Regression database hosted lulus untuk concurrency join/callback/refund, RLS, expiry, late payment, dan cleanup fixture.
- Concurrency dynamic manual lintas koneksi lulus melalui masing-masing 10 request paralel untuk lock, report dengan idempotency key sama, dan review; hasilnya satu payment serta satu receipt ledger.
- Seluruh fixture Auth, event, guest, rate-limit, payment, ledger, workspace, dan object Storage dari runner hosted berhasil dibersihkan.
- Adapter Storage lokal mendukung Supabase dan S3-compatible dengan referensi campuran; konfigurasi S3 belum diuji terhadap bucket hosted nyata.
- Workflow Firebase untuk commit `f6e7bf6` selesai sukses sampai deploy dan verifikasi live.
- Login Google nyata dari `https://dolend.web.app/account/` berhasil kembali ke callback Firebase, menukar code PKCE, menjalankan bootstrap idempotent, membersihkan URL sensitif lewat navigasi, dan masuk ke `/dashboard/`.
- OAuth masih berstatus testing; publishing/branding Google dan pilot manual dengan event nyata tetap perlu diselesaikan terpisah.

Semua fixture Auth, database, dan Storage dari verifikasi hosted dibersihkan setelah pengujian.
