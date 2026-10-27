# ADR 0001 — Elysia pada Supabase Edge Functions

Tanggal keputusan: 27 Oktober 2026. Status: **Accepted — T02 compatibility GO**.

## Keputusan

Gunakan Elysia 1.4.30 dengan `aot: false` dan `Deno.serve(app.fetch)`, tanpa Bun listener. Pertahankan dependency function terpisah pada deno.json/deno.lock. Hosted Supabase mengumumkan edge-runtime 1.77.8, compatible Deno 2.1.4; Deno lokal 2.9.6. Perbedaan versi ini sudah diuji pada hosted, bukan diasumsikan kompatibel dari lokal.

API utama `dolend-api` tetap memakai gateway JWT verification. `/me` juga melakukan `auth.getUser(userJWT)`; anon key bukan identitas pengguna. Probe `dolend-compat-poc` sementara terpisah memakai run-token atau HMAC untuk membuktikan webhook eksternal tanpa user JWT. Probe, secret, user, tabel/RPC dan bucket uji dihapus setelah verifikasi; konfigurasi dan source probe tetap tersedia untuk reproducibility.

## Bukti GO

- Hosted deployment dari dependency dipin berhasil.
- User JWT valid dikenali API utama; invalid/anon/deleted identity ditolak pada boundary yang diuji.
- RPC security invoker + RLS: 20 write konkuren mencapai counter 20 tanpa lost update; read/insert antar-user serta RPC anon ditolak.
- Multipart/private Storage/signed download bekerja; public/cross-user download dan upload, MIME invalid, oversize, serta signed URL expired ditolak.
- HMAC SHA-256 diverifikasi atas timestamp + teks body asli. Pada Elysia dynamic handler gunakan `parse: 'text'` lalu body, bukan mencoba membaca Request lagi setelah parsing. Whitespace body dipertahankan. Signature palsu/kedaluwarsa ditolak; 20 callback duplikat hanya menyimpan satu entry; ID sama/payload berbeda ditolak.
- Hosted CORS/preflight, validasi JSON, safe error envelope, secret injection dan 100 smoke read lulus.
- Fresh source directory: npm ci, lint, build static, TypeScript, Deno check, 6 test API + 2 test probe lulus.

## Performa dan batas interpretasi

Read warm p50 289.36 ms / p95 396.80 ms; 20 RPC write konkuren p50 1182.07 ms / p95 1700.37 ms. First authorized request setelah deploy 3698.24 ms dengan worker uptime 28.52 ms dan boot ID baru. Ini pengukuran end-to-end dari komputer pengembangan, bukan SLA atau pemisahan waktu boot platform/network. Tidak ada threshold produk yang disepakati untuk no-go berdasarkan latensi; risiko cold request dibawa ke M4.

Bundle diagnostik Deno sekitar 610–612 KiB minified. Ini bukan ukuran ESZIP hosted; successful API deployment membuktikan payload diterima platform. Ukuran exact ada pada laporan JSON. Batas resmi saat pengujian: memory 256 MB, CPU 2 s/request, idle timeout 150 s, wall clock free 150 s/paid 400 s, server-side bundle 5 MB. Tier komersial dan beban produksi belum diasumsikan; jobs dirancang bounded memakai batas konservatif free.

## Batas scope

GO membuktikan kompatibilitas stack, bukan kesiapan produksi event/payment. Expired JWT asli, refresh/signout/session revocation penuh masuk T08/T20; deleted identity yang ditolak tidak diklaim membuktikan access token langsung invalid setelah logout. Signature POC adalah HMAC fixture, bukan signature gateway yang belum dipilih. Invariant kapasitas/ledger/refund akan diuji pada task bisnis terkait. Remote CI adalah T06; clean install di POC dilakukan lokal pada direktori baru.

Referensi: [hasil lengkap](../POC-RESULTS.md), [hasil mesin](../poc-hosted-results.json), [first request](../poc-first-request.json), [Elysia Deno](https://elysiajs.com/integrations/deno), [Supabase limits](https://supabase.com/docs/guides/functions/limits).
