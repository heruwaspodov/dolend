# T04 — Database foundation results

27 Oktober 2026 • **Selesai** • Supabase project `fpbefabsqryxmnmxufjw`.

## Artefak

- Enam migration versioned pada `supabase/migrations/`, diterapkan melalui Supabase CLI `db push` dan dicatat dalam migration history resmi.
- 22 tabel dengan UUID primary keys, RLS, constraints, indeks, dan trigger; public safe projection `public_events`.
- 11 service-only domain RPC serta helper di schema non-exposed `dolend_private`.
- [Schema, ERD, akses, transaksi dan prosedur pemulihan](DATABASE.md).
- [Data dictionary generated](DATA-DICTIONARY.md), TypeScript contracts `src/lib/database.types.ts`.
- [Laporan lokal](database-local-results.json), [laporan hosted](database-hosted-results.json), [catalog/index/grants](database-catalog-results.json).

## Verifikasi

| Pemeriksaan | Hasil |
| --- | --- |
| Fresh migration replay | Lulus pada PostgreSQL WASM/PGlite dengan Auth stubs minimal; hosted awal tidak memiliki tabel bisnis |
| Local invariant tests | 38 kelompok pemeriksaan lulus; join idempotent, actor mismatch, capacity, pre/postpay, invoice snapshot, evidence review, refund limits/idempotency, late payment, guest claim, phone uniqueness, RLS dan RPC grants |
| Local snapshot export/import | Lulus; invoice/ledger count dan RLS bertahan setelah load snapshot ke instance baru |
| Hosted contention | 20 join untuk 5 kursi → 5 confirmed, 15 EVENT_FULL; 10 retry join tidak menambah peserta |
| Hosted cancellation/replacement | Kursi dilepas dan diisi ulang; total tetap 5; capacity turun di bawah occupancy ditolak |
| Hosted payment | Status succeeded tanpa receipt ditolak; wrong amount ditolak; 20 callback bersamaan menghasilkan 1 receipt dan 1 kursi confirmed |
| Hosted refund | 10 konfirmasi bersamaan menghasilkan 1 refund entry; refund melebihi receipt ditolak |
| Hosted expiry | Hold satu menit dibiarkan benar-benar expired; expire_holds replay aman; pembayaran terlambat saat slot terisi disimpan sebagai exception tanpa overbooking |
| Hosted authorization | Member/organizer dapat membaca invoice sesuai scope; identitas lintas-user, ledger write dan browser privileged RPC ditolak; public projection menyembunyikan unlisted |
| Hosted cancellation regression | Transaksi rollback membuktikan peserta attended tetap tercatat dan penerimaan yang belum dikembalikan masuk refund review saat event dibatalkan |
| Catalog | Semua 22 tabel RLS; 0 foreign key tanpa leading index; 11 domain RPC tidak executable oleh anon/authenticated |
| Cleanup | Event, person, Auth user, guest session, participant, invoice, attempt, receipt/refund, audit dan outbox fixture dihapus secara scoped; hanya 7 kategori referensi tersisa |
| Frontend regression | ESLint, TypeScript, normal static build lulus setelah generated database contracts ditambahkan |

Hosted suite berisi 12 kelompok pemeriksaan, ditambah 1 regresi SQL rollback. Semua provider/receipt/refund adalah fixture database; tidak ada email/SMS atau transaksi uang sungguhan. Runtime ledger/audit/history append-only lewat grants; cleanup dilakukan sebagai operator database terprivilegiasi khusus fixture yang dilacak, bukan melalui role aplikasi.

## Keputusan dan batas

- Event row lock menyatukan alokasi slot, capacity edit, expiry, payment confirmation dan cancellation. Semua API baru wajib mengikuti convention RPC; jangan membuat count-then-insert di client.
- Snapshot harga invoice tidak berubah ketika harga event berubah. Payment mode terkunci setelah pernah ada partisipasi; perubahan harga untuk peserta baru tidak menulis ulang tagihan lama.
- Receipt dan refund tidak dihapus/dimodifikasi oleh runtime; koreksi finansial memakai entry kompensasi. Status pembayaran dan status keikutsertaan tetap terpisah.
- Claim guest memerlukan challenge/account/phone proof yang cocok, belum kedaluwarsa, dan belum dipakai. Kebijakan recovery nomor recycled dan issuance proof masih wajib dirancang/diuji di T08; nomor yang diketik bukan kredensial.
- Full managed-backup/production restore belum dijalankan. T04 membuktikan migration replay, local snapshot round-trip dan menyediakan prosedur; release drill tetap T20/T21.
- RPC payment tidak menggantikan validasi signature gateway; provider nyata, pembayaran, refund entitlement, Storage file checks dan Cron scheduling tetap task T05/T13–T19.
- Belum ada alur event/Auth/payment baru yang diaktifkan di UI atau API Elysia pada T04; task berikutnya menghubungkannya secara bertahap.

## Berikutnya

T05 provider SMS/payment ditunda atas instruksi pengguna setelah T04; T06 CI/CD dan landing publik dapat dilanjutkan. Permintaan pengguna sudah dimasukkan ke T06: GitHub Actions pada `heruwaspodov/dolend` melakukan build normal dan auto-deploy live Hosting ke **https://dolend.web.app/** (project `dolend-apps`, site `dolend`, target `web`) setelah checks lulus. Workflow belum dibuat pada T04; setelahnya T06 mengaktifkan auto-deploy frontend berbasis OIDC, tanpa menyimpan credential database di CI.
