# T20 — Security, privacy, dan cakupan verifikasi

Tanggal audit: 5 November 2026. Status: audit sumber dan bukti uji; bukan sertifikasi atau audit legal eksternal.

## Bukti terverifikasi

- API check/tests (23), database tests (77 assertions), lint, typecheck, production build, dan static export verification lulus.
- Hosted DB suite lulus 13 pemeriksaan; kapasitas 20 join/5 kursi, retry, ownership/RLS, invite revoke, callback/payment, refund, late expiry, dan cleanup fixture teruji. Hasil terbaru: [database-hosted-results.json](database-hosted-results.json).
- Hosted Storage runner lulus: staging/attachment QRIS, venue/event edit, private proof, signed URL expiry, akses lintas owner/token, 10 review serentak menghasilkan satu receipt, orphan cleanup, dan fixture cleanup. Hasil: [manual-storage-hosted-results.json](manual-storage-hosted-results.json).
- Migration `private_uploads` terdaftar dan diterapkan di project Dolend; RLS aktif, hanya service-role memiliki grants. Function `dolend-api` v24 live; health mengirim `no-store`/`nosniff`.
- Guest booking aktual melalui Function hosted dan token-scoped status lookup lulus; akun/event fixture dihapus. Detail: [T20-HOSTED-REGISTRATION.md](T20-HOSTED-REGISTRATION.md).
- Pemindaian dependency baseline menemukan 0 runtime vulnerability. Audit seluruh graph menemukan 37 advisory low/moderate pada development/build tooling, 0 high/critical. Build/export verification lulus; perubahan mayor untuk perbaikan beberapa advisory tidak diterapkan.
- Pemeriksaan source API tidak menemukan pemanggilan console/logging yang dapat mencetak request atau credential. Pemeriksaan route/DTO tidak menemukan kebocoran konkret pada akses yang ditinjau: profile owner-scoped, guest token no-store dan header-scoped, event projection menghapus snapshot mentah, serta bukti dan signed URL organizer-scoped.
- Follow-up source audit lokal 5 November: tidak ada `select('*')` atau console/logger call di API Elysia. Organizer payment settings memakai kolom eksplisit; payment review DTO hanya berisi ID, nominal, status, dan signed URL pendek, tanpa path bukti, idempotency key, nested participant ID, atau provider payload. Regression test allowlist ditambahkan (`api:test` 41/41). Ini menutup satu temuan konkret, bukan audit lengkap route-by-role.
- Supabase local Docker berhasil dijalankan; `supabase db reset --local --no-seed` mereplay seluruh migration dan generated `database.types.ts` diregenerasi dari schema lokal. Ini bukan hosted migration atau bukti restore backup.
- Local Function health probe pada `/functions/v1/dolend-api/v1/health` merespons HTTP 200 dengan `no-store`/`nosniff`; stack lokal berjalan.
- Build preview + fixture menjalankan suite khusus hosting desktop/mobile 14/14. Build normal menjalankan guest booking dan member participation 4/4; kedua suite harus memakai mode build masing-masing karena preview fixture sengaja menonaktifkan pendaftaran.

## Pemetaan §9

| Area | Status bukti | Catatan |
| --- | --- | --- |
| Static hosting | Lulus pada suite khusus lokal | Direct shell, refresh, unknown ID, callback/payment shell. Build preview + fixture: hosting 14/14; flow pendaftaran dijalankan terpisah pada build normal. |
| Identity | Parsial | Hosted login Google pernah diuji; callback replay/provider mismatch, seluruh phone normalization/collision, dan claim guest belum satu suite terpadu. |
| Authorization | Lulus pada skenario hosted yang dijalankan; audit DTO belum menyeluruh | RLS/cross-user/ledger denial serta proof/token scope diuji. Source DTO payment kini memakai allowlist dan regression test; matriks route-by-role lain belum exhaustif. |
| Concurrency | Lulus untuk skenario utama | 20 join/5 kursi, duplicate join, 20 callback/1 receipt, 10 refund/1 entry, dan 10 review/1 receipt. |
| Time | Belum lengkap | Belum ada bukti terpadu WIB/WITA/WIT, UTC boundary, deadline, dan end-before-start. |
| Sharing | Parsial/lulus terpisah | Invite hash/revoke hosted; copy/WhatsApp desktop/mobile diuji lokal, bukan satu E2E staging. |
| Prepay/postpay | Parsial | Hold expiry/late payment hosted; review expiry, completed unpaid, overdue, dan payment-later evidence tersebar. |
| Gateway/provider timeout | Tidak berlaku pada revisi MVP; kriteria historis konflik | Gateway/SMS ditunda; signature/timeout/reconciliation provider tidak boleh diklaim lulus. |
| Late payment/refund | Lulus untuk batas yang diuji | Late receipt tanpa overbooking, duplicate refund, over-refund rejection. Failed refund/cancel-paid edge case belum lengkap. |
| Cron | Parsial | Worker bounded/retry-safe lokal; crash-mid-batch dan hosted callback race belum dibuktikan. |
| Storage | Lulus runner hosted 5 Nov 2026 | URL expiry, MIME/size, orphan, cross-token/owner dan proof flow tercakup. |
| Deployment/restore | Parsial | Function v24 dan static export diverifikasi; physical backups tidak tersedia dan PITR nonaktif, jadi backup restore belum dapat diuji. |

## Risk register aktif

| Risiko | Severity | Status | Owner/evidence |
| --- | --- | --- | --- |
| Tidak ada physical backup/PITR pada project; kehilangan data belum dapat diuji pulih | Tinggi / release blocker | Terbuka | Owner belum ditetapkan; `supabase backups list` menunjukkan `backups: null`, `pitr_enabled: false`. |
| Jadwal retensi/legal hold/SLA penghapusan belum diputuskan | Tinggi / policy blocker | Terbuka | Product/ops/legal owner belum ditetapkan; prosedur teknis awal: [DATA-RETENTION.md](DATA-RETENTION.md). |
| Audit route-by-role dan deny-list DTO belum exhaustif | Sedang | Terbuka, satu temuan payment DTO sudah ditutup lokal | Engineering; lanjutkan inventaris seluruh route dan tes role negatif. |
| Beberapa skenario waktu/status dan crash recovery belum memiliki bukti terpadu | Sedang | Terbuka | Engineering/QA owner belum ditetapkan; lihat pemetaan §9 di atas. |
| Advisory dependency development/build | Rendah/sedang | Ditinjau, tidak diubah | 37 low/moderate, nol high/critical; runtime audit 0. Beberapa fix memerlukan major upgrade toolchain. |
| T21 gateway requirement vs keputusan MVP manual | Scope conflict | Terbuka untuk rekonsiliasi | Gateway tetap ditunda; jangan menyalakan provider diam-diam. Lihat [T21-READINESS.md](T21-READINESS.md). |

## Restore dan batas bukti

Project hosted masih tidak menyediakan physical backup dan PITR nonaktif (`supabase backups list`: `backups: null`). Docker lokal sekarang berjalan dan semua migration telah direplay, tetapi tidak ada backup hosted yang dapat diuji dan local migration replay bukan restore backup. Restore managed/hosted tetap belum terbukti. Jangan menyalin backup berisi data hosted ke mesin lokal tanpa target/retensi/akses yang disetujui.

Kesimpulan: tidak ada temuan kode critical/high yang terbukti dari pemeriksaan ini, tetapi dua risiko high release/policy masih terbuka dan backup restore belum dibuktikan. T20 belum lulus acceptance criteria.
