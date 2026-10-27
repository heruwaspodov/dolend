# Hasil POC fondasi Dolend

27 Oktober 2026 • **T02 compatibility GO** • project `fpbefabsqryxmnmxufjw`.

## Pemeriksaan yang lulus

| Area | Bukti |
| --- | --- |
| Hosted runtime | Elysia 1.4.30 berjalan pada supabase-edge-runtime 1.77.8 (compatible Deno 2.1.4), V8 11.6.189.12 |
| Auth | API utama menerima user JWT valid; probe menolak invalid/anon JWT; user terhapus ditolak |
| Transaksi | 20 RPC write konkuren, 20 nilai unik, final counter 20; security invoker dengan RLS |
| Authorization | Data user A tidak terbaca user B; insert mengatasnamakan A dan RPC anonymous ditolak |
| Storage | Multipart upload private, signed download dan content round-trip; public/cross-user read, cross-user upload, oversize dan wrong MIME ditolak; signed URL expired ditolak |
| Webhook | Signature HMAC raw text valid; palsu/stale ditolak; 20 callback duplikat hanya satu row; ID sama/payload berubah mendapat 409 |
| HTTP | CORS allow/preflight/deny, JSON validation 400, error 404 aman, run-token guard dan secret injection |
| Smoke | 100 hosted read dalam run terkini tanpa error; 120 health request pada run awal juga lulus |
| Reproducibility | Direktori source baru tanpa node_modules: npm ci, lint, static build, frontend/API/probe typecheck, 6 API tests dan 2 probe tests lulus |

Baseline awal Node 22.14.0; runner dan clean-source check pada sesi lanjutan memakai Node 25.8.2. Deno lokal 2.9.6, Next.js 16.4.3, React 19.3.1, Supabase JS 2.118.0, CLI 2.122.0. Package dan Deno lock tersedia. Tidak menggunakan Bun runtime atau in-process Cron.

## Latensi dan bundle

| Pengukuran dari komputer pengembangan | Nilai |
| --- | --- |
| Warm read p50 / p95 | 289.36 / 396.80 ms |
| 20 concurrent RPC write p50 / p95 | 1182.07 / 1700.37 ms |
| First authorized request setelah redeploy | 3698.24 ms; worker uptime 28.52 ms |
| Local minified Deno bundle | Sekitar 610–612 KiB; bytes exact di JSON |

First request memakai boot ID baru; angka end-to-end mengandung network dan platform overhead. Warm read tidak menjamin worker yang sama untuk setiap request. Tidak mengklaim ukuran bundle lokal sama dengan ESZIP server atau angka latensi sebagai SLA.

Laporan: [hasil hosted](poc-hosted-results.json), [first request](poc-first-request.json), [ADR GO](decisions/0001-runtime-poc.md).

## Fixture dan cleanup

Fixture sementara memakai nama `dolend_poc_*`, bucket/function `dolend-compat-poc`, serta dua akun email acak `.example` yang dibuat melalui Admin API tanpa mengirim email/SMS. Source setup/cleanup berada di `supabase/poc/`, terpisah dari migration bisnis. Bucket dibuat/dihapus lewat Storage SDK; SQL hanya mengelola policy karena platform melarang direct deletion storage tables. State sementara berisi password/token hanya berada di `.env.poc-state.json` berizin 0600 dan diabaikan Git.

Cleanup otomatis menghapus object/bucket, user uji, tabel/RPC/policy fixture, probe hosted, secret POC, dan state lokal. Hasil cleanup diverifikasi terpisah dalam laporan JSON sebelum task ditutup. API utama tidak dihapus dan gateway JWT verification-nya tetap aktif.

## Batas dan pekerjaan lanjutan

- Expired JWT asli dan refresh/logout/revocation semantics belum diuji; menjadi acceptance tambahan T08/T20. User terhapus bukan pengganti bukti session revoke setelah logout.
- Webhook ini memakai provider fixture, bukan integrasi gateway nyata. Pemilihan provider/signature/settlement tetap T05/T16.
- Kapasitas event, billing, ledger/refund belum diimplementasikan; counter POC tidak mengklaim invariant bisnis itu sudah terbukti.
- Cold request sekitar 3.7 s menjadi risiko performa M4; tampilkan loading state dan ukur kembali setelah endpoint bisnis ada.
- Remote CI belum dibuat (T06). Docker daemon belum aktif; pengujian hosted dilakukan melalui API deployment, tanpa emulator Docker.
- Frontend Firebase belum dipublikasikan; T03 berikutnya masih membutuhkan query-route dan preview Hosting.

[Limit resmi Supabase](https://supabase.com/docs/guides/functions/limits) diperiksa 27 Oktober 2026: memory 256 MB, CPU 2 s/request, idle timeout 150 s, wall clock free 150 s/paid 400 s, server-side bundle 5 MB. Tier/budget produksi harus diverifikasi sebelum load pilot; hasil POC tidak menjanjikan kapasitas produksi.
