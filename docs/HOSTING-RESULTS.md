# T03 — Static export dan Firebase Hosting

27 Oktober 2026 • **GO**.

## Target yang diverifikasi

- Firebase project: `dolend-apps`.
- Hosting site: `dolend` (berbeda dari default site `dolend-apps`).
- Target lokal: `web`, tersimpan di `.firebaserc`; folder publish `out/` pada `firebase.json`.
- Channel: `t03`, expiry 7 hari.
- [Preview](https://dolend--t03-pnd1m1mh.web.app).
- [Contoh event](https://dolend--t03-pnd1m1mh.web.app/event/?id=ee6eb97c-3327-42b7-901f-dac995e7a726).
- Kedaluwarsa: **3 November 2026 sekitar 11.48 WIB**; deploy ulang channel dapat memperpanjang expiry.

Deployment hanya dilakukan ke preview channel. Live channel site tidak dideploy pada task ini. Preview adalah URL publik; fixture tidak memuat data pribadi atau kredensial.

## Bukti penerimaan

| Syarat T03 | Hasil |
| --- | --- |
| Clean export | `.next/` dan `out/` dibersihkan, normal build/typecheck lulus; route HTML tersedia tanpa Next runtime |
| Event setelah build | Build preview selesai sebelum UUID/JSON fixture dibuat. Event ID dan judul tidak ada dalam HTML export; browser memuat JSON saat runtime |
| Direct open dan refresh | `/event/?id=...`, `/auth/callback/`, `/payment/` memberi HTTP 200 dan tetap bekerja setelah refresh |
| Event tidak dikenal | JSON 404 dipetakan ke pesan “Aktivitas tidak ditemukan”, bukan hosting 404 untuk shell |
| Loading/error/retry | Request tertunda/503 disimulasikan di browser; loading, error, lalu retry sukses |
| ID invalid | Missing/malformed UUID ditolak tanpa request event |
| Auth callback | Shell tampil, callback query/hash dibersihkan; belum melakukan exchange sesi |
| Payment return | Query `status=paid&success=true` tidak pernah menetapkan pembayaran terkonfirmasi |
| Responsive/hydration | Desktop 1280×800 dan mobile 360×800; event tidak overflow; tidak ada pageerror pada load/refresh event |
| Header | `Referrer-Policy: strict-origin`, `X-Content-Type-Options: nosniff`; asset Next fingerprinted memakai cache immutable |
| Browser tests | 12 lokal + 12 hosted lulus, tanpa failure/flaky; screenshot hosted mobile/desktop diperiksa visual |

Hasil mesin: [hosting-results.json](hosting-results.json). Browser suite: `tests/hosting.spec.ts`. Hasil build berupa beranda, `/event/`, `/auth/callback/`, `/payment/`, dan halaman not found.

## Perbedaan POC dan fitur bisnis

Adapter POC hanya aktif ketika `NEXT_PUBLIC_POC_EVENT_FIXTURES=true`. Script `preview:fixture` menambahkan JSON sintetis pada output setelah build; ini membuktikan static shell tidak tergantung daftar event saat compile. Script tidak menciptakan event bisnis dalam PostgreSQL dan belum membuktikan API create event (T10).

Build normal menghapus output fixture dan memakai `NEXT_PUBLIC_API_URL/events/:id` jika dikonfigurasi. Public key dapat dikirim ke gateway; service-role key tidak pernah digunakan client. API event belum tersedia, sehingga mode normal menampilkan error yang dapat dicoba ulang sampai T10 selesai. Adapter memvalidasi bentuk data sebelum render dan hanya menampilkan tautan Maps HTTPS yang diizinkan.

Auth callback dan payment return adalah shell navigasi yang disyaratkan T03. Login nyata, OTP, PKCE exchange, refresh/session semantics (T08), invoice/status payment (T14/T16), serta callback provider nyata belum diimplementasikan. Jangan menggunakan preview ini untuk login atau transaksi sungguhan.

Preview WhatsApp/metadata event masih umum Dolend. Detail diambil client-side; tidak menjanjikan SSR, per-event OG image, atau SEO dinamis. Tidak ada catch-all rewrite, Next API server, Cloud Function Hosting backend, atau Cloudflare.

## Menjalankan ulang

Diperlukan npm dependencies dan Firebase CLI terautentikasi (sesi ini 14.27.0).

```sh
npm ci
npm run build:preview
npm run preview:fixture
npm run test:hosting
npm run hosting:preview
HOSTING_BASE_URL=https://dolend--t03-pnd1m1mh.web.app npm run test:hosting
```

Gunakan URL baru bila hasil deploy channel berubah. Playwright memakai Chrome lokal secara default; `PLAYWRIGHT_CHANNEL=chromium` dapat dipakai setelah `npx playwright install chromium`. Fixture metadata lokal diabaikan Git; jangan mengubah contoh menjadi data pribadi. Untuk build normal, biarkan `NEXT_PUBLIC_POC_EVENT_FIXTURES=false` lalu jalankan `npm run build`.

Berikutnya: T04 schema/transaksi/RLS dan T05 provider readiness. CI/CD remote tetap T06, UI alur lengkap tetap T07.

Referensi: [Firebase preview channels](https://firebase.google.com/docs/hosting/test-preview-deploy), [deploy targets](https://firebase.google.com/docs/cli/targets), [Next static exports](https://nextjs.org/docs/app/guides/static-exports).
