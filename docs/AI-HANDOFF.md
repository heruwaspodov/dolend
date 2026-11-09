# AI handoff aktif

Terakhir diperbarui: 5 November 2026. Sumber scope: `PLAN.md` T20–T29 dan §9.

## Fokus sekarang

- **Task aktif:** implementasi lokal T25–T29 selesai; T20/T21 masih menjadi gate MVP.
- **Tujuan:** tutup gap lokal yang masih bisa ditindaklanjuti, lalu selesaikan blocker T20/T21 sebelum hosted rollout atau pilot.
- **Gate:** T20 masih belum memenuhi semua acceptance criteria; T21 pilot/release belum bisa lulus.
- **Keputusan scope:** gateway/SMS tetap ditunda; revisi MVP memakai manual QRIS/transfer/tunai. Acceptance T21 tentang gateway non-QRIS bertentangan dengan keputusan MVP dan tetap terbuka untuk rekonsiliasi; kriterianya tidak diubah.
- **Implementasi Phase 2/3:** T22–T28 lulus checks lokal; T29 implementasi dan evaluasi fixture relevance/privacy lokal tersedia. Hosted deployment/job dan evaluasi rollout belum dilakukan.

## Status yang sudah terbukti

| Bukti | Level | Sumber |
| --- | --- | --- |
| API negative suite 23 test, lint, typecheck, production build, local DB 77 assertion | Local test | Status T20 di `PLAN.md` |
| Audit dependency runtime baseline tanpa vulnerability | Local test | Status T20 di `PLAN.md` |
| Concurrency 20 join/5 seat, ownership/RLS, duplicate payment/refund, invite revoke, expiry | Hosted scoped test | `database-hosted-results.json` |
| Guest/member browser flow 4/4 memakai API mock | Local test | Status T20 di `PLAN.md` |
| Preview desktop/mobile 72/76; empat gagal karena fixture menonaktifkan registration | Local preview | Status T20 di `PLAN.md` |
| Prosedur awal retensi/penghapusan tersedia | Documentation | `DATA-RETENTION.md` |
| Migration `private_uploads` diterapkan; Function v24 upload/attach QRIS mencatat row staging; health live `no-store`/`nosniff` | Hosted migration/deploy/probe | `T20-HOSTED-REGISTRATION.md` |
| Hosted Storage runner penuh lulus; orphan/proof fixture cleanup terverifikasi | Hosted scoped test | `manual-storage-hosted-results.json` |
| Full dependency scan 37 low/moderate dev/build, 0 high/critical; runtime 0 | Dependency scan | `T20-SECURITY-REVIEW.md` |
| T22–T24 migration replay 90 assertions, API 30/30, lint/typecheck/build lulus | Local test | `PLAN.md` T22–T24 |
| T22 browser social desktop/mobile 4/4 | Local browser test | `tests/social.spec.ts` |
| T25–T29 migration replay 95 assertions, SQL rollback regressions, API suite 41/41, lint/typecheck/build lulus sebelum follow-up DTO | Local test | `PLAN.md` T25–T29 |
| T25–T29 browser suite 16/16 desktop/mobile | Local browser test | `tests/activity-photos.spec.ts`, `tests/challenges.spec.ts`, `tests/stats.spec.ts`, `tests/recommendations.spec.ts` |
| T29 synthetic fixture check: personalized hit@1 1/1 vs chronological baseline 0/1; 3/3 invalid candidates filtered; privacy assertions pass | Local SQL regression | `T29-RECOMMENDATIONS.md`, `supabase/tests/recommendations.sql` |
| Supabase local Docker stack started; fresh local migration replay succeeded and generated DB types were regenerated from local schema | Local environment | `DATABASE.md`; `DATA-DICTIONARY.md` remains hosted snapshot |
| Function `dolend-api` lokal health merespons HTTP 200 dengan header no-store/nosniff | Local API probe | Local Supabase stack on port 54321 |
| T18 attendance guard: future start and non-organizer rejected, retry keeps one audit row, no-show preserves invoice; DB suite now 99 assertions | Local database test | `PLAN.md` T18; migration `20261105180000_attendance_start_guard.sql` |
| Preview build + fixture: hosting/browser checks 14/14; normal build guest booking/member participation 4/4 | Local browser test | Preview build/fixture dan hosting checks; normal build + targeted Playwright |

## Gap T20 yang masih terbuka

| Gap | Kenapa belum selesai | Kebutuhan berikutnya |
| --- | --- | --- |
| Seluruh matriks §9 belum memiliki bukti terpadu | Bukti tersebar dan beberapa flow belum E2E hosted | Petakan setiap baris §9 ke test/result atau tandai missing |
| Public DTO serta log bebas nomor/bukti/secret/token belum punya audit terpadu | Follow-up scan menemukan DTO payment kini allowlisted dan tidak ada `select('*')`/console logger di API; inventaris role per route belum lengkap | Audit route output + logging untuk seluruh route dan tambah negative test yang hilang |
| E2E hosted mobile/desktop belum lengkap | Browser flow saat ini memakai mock/preview fixture | Siapkan skenario staging dengan fixture sintetis dan cleanup |
| Retensi final dan legal hold belum diputuskan | Membutuhkan keputusan product/ops/legal | Setujui kategori, periode, hold, SLA, dan owner |
| Managed-backup restore terisolasi belum terbukti | PGlite round-trip bukan managed restore | Rancang dan jalankan drill pada environment uji terisolasi dengan otorisasi |
| T21 pilot prerequisites belum tersedia | T05 ditunda; OAuth production, merchant readiness, T20 exit gate belum lulus | Siapkan release readiness list; tidak mengirim pembayaran atau memulai pilot |
| Risk register final dan temuan critical/high belum ditutup eksplisit | Belum ada satu daftar risiko aktif dengan owner/status | Konsolidasikan risiko T20, severity, owner, evidence, disposition |

## Next action aman

T21 readiness checklist tersedia di `T21-READINESS.md`. T20 masih tertahan pada restore backup hosted yang tidak tersedia, keputusan final retensi/legal hold, audit role/DTO lengkap dan hosted browser matrix. T21 juga mencatat konflik gateway non-QRIS vs revisi MVP. T29 sudah memiliki evaluasi fixture sintetis lokal; evaluasi opt-in/rollout hosted tetap perlu sebelum aktivasi. Schema T22–T29 belum hosted. Jangan mengklaim T20/T21 lulus atau membuat data/payment pilot sintetis seolah transaksi nyata.

## Kondisi workspace

Selalu cek ulang `git status`. Workspace memiliki banyak perubahan implementasi T20–T29 dan dokumentasi yang belum commit. Perlakukan sebagai pekerjaan aktif pengguna: review dan pertahankan, jangan reset atau timpa.

## Handoff berikutnya

Saat bukti berubah, ganti snapshot ini. Catat hanya hasil, level bukti, gap tersisa, dan satu next action. Riwayat lengkap tetap di Git dan dokumen hasil terkait.
