# Dolend

Dolend adalah **social activity network untuk merencanakan aktivitas bersama**: tentukan aktivitas, tempat, jadwal, dan kapasitas, lalu ajak teman untuk ikut. Inspirasi sosialnya seperti Strava, dengan alur awal dari ajakan hingga aktivitas terlaksana.

Direktori kerja proyek: `/Users/wspdv/Works/dolend`.

## Status proyek

Brief produk T01 selesai untuk sumber yang tersedia dan **T02 kompatibilitas Elysia/Supabase sudah GO**. **T03 static Hosting juga sudah GO**: query-route serta auth/payment return shell lulus pengujian browser pada preview Firebase.

- Next.js menghasilkan static export untuk beranda, `/event/`, `/auth/callback/`, dan `/payment/`. Target Hosting: project `dolend-apps`, site `dolend`.
- Elysia sudah di-deploy ke Supabase. Enam test lokal dan smoke HTTP hosted 120 request lulus pada 27 Oktober 2026.
- Hosted user JWT, RPC/RLS dengan 20 write konkuren, private Storage, raw-signature webhook/deduplication, dan instalasi source bersih sudah lulus. Probe serta fixture sementara telah dihapus.
- T04 sudah menerapkan 22 tabel, RLS, dan RPC transaksi bisnis ke Supabase; fitur event/Auth/payment belum dihubungkan ke API/UI. Hasil test dan batasnya ada di docs/DATABASE-RESULTS.md.

Detail progres dan kriteria penerimaan ada di [PLAN.md](PLAN.md) dan [hasil POC](docs/POC-RESULTS.md).

## Landing page publik

Target live: **https://dolend.web.app/**, project Firebase `dolend-apps`, site `dolend` (target `web`). Landing mengadaptasi [HTML referensi pengguna](docs/references/dolend_landing_page_demo.html) menjadi React/Tailwind/shadcn dengan hero, kategori kegiatan, simulator patungan, FAQ dan navigasi mobile.

Kalkulator, pilihan DP, status peserta, copy link, serta tautan simulasi dapat dicoba tanpa login. Konfigurasi simulasi dibagikan lewat URL fragment; tidak membuat event atau menyimpan peserta ke database. SMS dan payment gateway **ditunda atas permintaan pengguna**. DP 50% hanya ilustrasi front-end, bukan fitur installment backend yang sudah tersedia.

```sh
npm run build
npm run test:landing
npm run hosting:deploy
```

`hosting:deploy` menerbitkan `out/` ke live site. Gunakan build normal dengan `NEXT_PUBLIC_POC_EVENT_FIXTURES=false` untuk rilis landing, bukan `build:preview`. Detail QA dan hasil deploy ada di [LANDING-PAGE.md](docs/LANDING-PAGE.md).

## Stack

| Bagian | Teknologi |
| --- | --- |
| Frontend | Next.js, React, TypeScript; static export |
| UI | Tailwind CSS v4, shadcn/ui (Radix/Nova), Lucide icons |
| Hosting frontend | Firebase Hosting |
| API | ElysiaJS melalui Deno di Supabase Edge Functions |
| Data dan layanan | Supabase PostgreSQL, Auth, Storage, Cron |
| Validasi nomor | libphonenumber-js; nomor Indonesia disimpan dalam format `62...` |

Versi dependency dipin dalam `package.json` dan `package-lock.json`. Elysia serta SDK backend dipin terpisah dalam `supabase/functions/dolend-api/deno.json` dan `deno.lock`. Commit kedua lockfile tersebut. Proyek tidak menggunakan Cloudflare.

## Persiapan

Gunakan Node.js **22.14 atau lebih baru pada seri 22**, atau **24 ke atas**, sesuai `engines` di `package.json`, beserta npm. Deno dan Supabase CLI sudah menjadi dependency lokal; keduanya tidak perlu dipasang global. Docker diperlukan hanya untuk menjalankan Supabase lokal melalui CLI, bukan untuk API Deno langsung.

```sh
cd /Users/wspdv/Works/dolend
npm ci
cp .env.example .env.local
```

Isi `.env.local` sesuai lingkungan yang digunakan. Halaman awal dan health API dapat berjalan tanpa konfigurasi Supabase. Browser hanya boleh menerima URL dan public/publishable key lewat `NEXT_PUBLIC_*`; secret layanan tetap di server. Nilai `NEXT_PUBLIC_*` masuk ke bundle saat build.

## Menjalankan aplikasi

Frontend, pada terminal pertama:

```sh
npm run dev
```

Buka [localhost:3000](http://localhost:3000).

API Deno, pada terminal kedua dari direktori proyek:

```sh
npm run api:dev
```

Health API: [localhost:8000/dolend-api/v1/health](http://localhost:8000/dolend-api/v1/health). Watch mode aktif. `/me` membutuhkan user JWT Supabase dan konfigurasi server; anon key bukan identitas pengguna.

`api:dev` tidak membaca `.env.local` secara otomatis. Untuk menjalankan API dengan konfigurasi file dan watch mode:

```sh
npx deno run --env-file=.env.local \
  --config supabase/functions/dolend-api/deno.json \
  --allow-env --allow-net --watch \
  supabase/functions/dolend-api/index.ts
```

Untuk `/me` lokal, set `SUPABASE_URL` dan `SUPABASE_PUBLISHABLE_KEY` (atau `SUPABASE_ANON_KEY`) pada environment API. Hosted Functions menyediakan konfigurasi platformnya sendiri. `ALLOWED_ORIGINS` menerima daftar origin dipisahkan koma, default `http://localhost:3000`; `PORT` default `8000`. Route eksperimen `/poc/echo` hanya tersedia jika `POC_MODE=true`; biarkan nonaktif pada hosted production.

## Perintah pengembangan

| Perintah | Kegunaan |
| --- | --- |
| `npm run dev` | Frontend dengan live reload |
| `npm run build` | Build frontend menjadi folder `out/` |
| `npm run lint` | ESLint frontend dan script Node; API diperiksa lewat Deno |
| `npm run typecheck` | Pemeriksaan TypeScript frontend |
| `npm run api:dev` | API Deno dengan watch mode |
| `npm run api:check` | Pemeriksaan tipe API |
| `npm run api:test` | Test handler API lokal, tanpa layanan Supabase |
| `npm run api:smoke` | Smoke HTTP ke `API_BASE_URL` yang ditentukan |
| `npm run supabase -- <command>` | Supabase CLI lokal |
| `npm run ui -- add <component>` | Menambah komponen shadcn/ui |
| `npm run poc:check` / `npm run poc:test` | Pemeriksaan probe kompatibilitas tanpa hosted fixture |
| `npm run build:preview` | Static build dengan adapter fixture publik khusus pratinjau |
| `npm run preview:fixture` | Buat data contoh baru setelah build selesai |
| `npm run db:test` | Replay migration, invariant/RLS tests dan snapshot restore lokal |
| `npm run db:test:hosted` | Scoped fixture test hosted; memerlukan DATABASE_TEST_PROJECT_REF eksplisit |
| `npm run db:catalog` | Verifikasi RLS/grants/FK indexes dan generate dictionary |
| `npm run db:types` | Generate ulang TypeScript contracts dari schema hosted |
| `npm run test:landing` | Browser tests landing dan simulator pada build normal |
| `npm run hosting:deploy` | Deploy langsung output build ke https://dolend.web.app/ |
| `npm run test:hosting` | Uji browser desktop dan mobile terhadap static export |
| `npm run hosting:preview` | Deploy channel `t03` ke site `dolend`, expiry 7 hari |

Pemeriksaan sebelum mengirim perubahan:

```sh
npm run lint
npm run build
npm run typecheck
npm run api:check
npm run api:test
```

Dengan API lokal tetap berjalan, jalankan smoke HTTP:

```sh
API_BASE_URL=http://localhost:8000/dolend-api/v1 npm run api:smoke
```

Smoke mengirim 100 health request berurutan dan 20 bersamaan. Hasil ini tidak membuktikan transaksi database, concurrency write, atau cold start. `api:smoke` juga mendukung environment `SUPABASE_PUBLISHABLE_KEY`; untuk legacy anon JWT, script mengirimkannya sebagai bearer ke gateway. Endpoint `/me` tetap membutuhkan user JWT tersendiri.

## Supabase dan deployment

Project POC yang dipilih: [`fpbefabsqryxmnmxufjw`](https://supabase.com/dashboard/project/fpbefabsqryxmnmxufjw). Fungsi: `dolend-api`. Base URL API hosted:

```text
https://fpbefabsqryxmnmxufjw.supabase.co/functions/v1/dolend-api/v1
```

Jika CLI belum terautentikasi, login terlebih dahulu. Deploy function menggunakan project ref eksplisit; perintah ini tidak melakukan database linking atau migration:

```sh
npm run supabase -- login
npm run supabase -- functions deploy dolend-api \
  --project-ref fpbefabsqryxmnmxufjw --use-api
```

Gateway JWT verification tetap aktif; health hosted tanpa kredensial ditolak. Origin frontend staging/production harus dimasukkan ke `ALLOWED_ORIGINS` function setelah domain Hosting ditentukan. Jangan menyimpan access token, service-role key, atau secret provider di Git.

Frontend memakai `output: 'export'` dan konfigurasi `firebase.json` yang menunjuk `out/`. Project Firebase `dolend-apps` dan site `dolend` sudah dipilih melalui target `web` di `.firebaserc`; default site `dolend-apps` bukan target deploy aplikasi ini. Tidak ada backend Next.js, Server Actions, atau runtime API route dalam rancangan ini. Link event memakai `/event/?id=<uuid>` dan client fetch, sehingga HTML shell tidak perlu dibangun ulang untuk setiap event. API event nyata belum tersedia (T10). Callback login dan payment saat ini hanya shell; callback belum menyelesaikan login atau mengonfirmasi pembayaran.

## Preview Firebase dan uji static hosting

Firebase CLI yang terautentikasi diperlukan (`firebase --version`; versi sesi pengujian 14.27.0). Script Hosting menggunakan CLI tersebut. Untuk preview T03:

```sh
npm run build:preview
npm run preview:fixture
npm run test:hosting
npm run hosting:preview
```

Fixture JSON dibuat di `out/__poc/events/` setelah build. Metadata ID lokal di `.firebase-preview-fixture.json` diabaikan Git. Data contoh hanya berisi informasi publik sintetis dan diberi label pratinjau; bukan event yang dapat didaftarkan. API nyata memakai `NEXT_PUBLIC_API_URL` dan format `{ data: PublicEvent }`. Build normal (`npm run build`) membersihkan output fixture dan tidak mengaktifkan adapter POC jika flag tidak diaktifkan.

Uji browser memakai Chrome lokal secara default. Jika memakai Chromium Playwright, jalankan `npx playwright install chromium` lalu set `PLAYWRIGHT_CHANNEL=chromium`. Uji preview dengan URL hasil deploy:

```sh
HOSTING_BASE_URL=https://dolend--t03-pnd1m1mh.web.app npm run test:hosting
```

Preview channel bersifat publik dan berumur terbatas; jangan memasukkan data pribadi ke fixture. Deployment ini ditujukan ke preview, bukan live channel. Metadata/preview WhatsApp tetap umum Dolend; SEO event dinamis terbatas karena konten diambil setelah halaman dibuka.

GitHub Actions untuk **https://dolend.web.app/** disiapkan pada T06: checks → verified static artifact → OIDC deploy ke live saat push main. Hasil run pertama masih diverifikasi. Lihat [CI-CD.md](docs/CI-CD.md). Preview manual tetap terpisah dari live deployment.

## Struktur proyek

```text
src/app/                          Halaman React dan token tema Tailwind
src/components/ui/                Komponen shadcn/ui milik proyek
src/lib/utils.ts                  Utility penggabungan class
components.json                   Konfigurasi shadcn CLI
postcss.config.mjs                Integrasi Tailwind CSS v4
playwright.config.ts              Uji browser static export lokal/preview
tests/hosting.spec.ts              Direct link, refresh, states, dan return shells
supabase/config.toml              Konfigurasi Supabase lokal
supabase/functions/dolend-api/     Handler Elysia, entrypoint, test, dependency Deno
scripts/smoke-api.mjs              Pemeriksaan HTTP lokal/hosted
scripts/poc-hosted.mjs             Lifecycle fixture dan pemeriksaan hosted T02
supabase/poc/                     SQL fixture sementara dan petunjuk cleanup
firebase.json                     Konfigurasi static hosting
.env.example                      Template konfigurasi tanpa secret
PLAN.md                           Scope, task, dependencies, acceptance criteria
docs/                            Brief produk, ADR, dan hasil POC
```

Folder dependency, hasil build, file environment lokal, log, dan cache layanan tidak masuk Git. Source, konfigurasi, template environment, dokumentasi, serta lockfile tetap disimpan.

## Dokumen proyek

- [Rencana implementasi](PLAN.md): MVP, schema, API, milestones, dan risks.
- [Product brief](docs/PRODUCT.md): persona, istilah, dan keputusan produk.
- [Fondasi UI](docs/UI-FOUNDATION.md): React/Tailwind/shadcn, tokens, komponen, dan cara menambah komponen.
- [ADR runtime POC](docs/decisions/0001-runtime-poc.md): gate kompatibilitas Elysia/Supabase.
- [Hasil POC](docs/POC-RESULTS.md): bukti GO, pengukuran, dan batas verifikasi.
- [Hasil Hosting T03](docs/HOSTING-RESULTS.md): URL preview, browser checks, dan batas shell auth/payment.
- [CI/CD](docs/CI-CD.md): workflow, identitas OIDC, urutan deployment dan rollback.
- [Landing page live](docs/LANDING-PAGE.md): referensi, simulator, status demo dan hasil rilis.
- [Fondasi database](docs/DATABASE.md) dan [hasil T04](docs/DATABASE-RESULTS.md): ERD, akses, migrations, tests, serta prosedur pemulihan.
- [Menjalankan ulang POC](supabase/poc/README.md): setup, prepare, test, dan cleanup resource sementara.

MVP mencakup event oleh registered user, WhatsApp share, venue/Google Maps, jadwal/kapasitas, guest/member, serta pembayaran sebelum/sesudah event melalui transfer manual, QRIS, dan metode gateway. Phase 2 menambahkan follow, communities, feed, dan photos; Phase 3 menambahkan challenges, achievements, stats, dan recommendations.
