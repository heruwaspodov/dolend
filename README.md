# Dolend

Dolend adalah **social activity network untuk merencanakan aktivitas bersama**: tentukan aktivitas, tempat, jadwal, dan kapasitas, lalu ajak teman untuk ikut. Inspirasi sosialnya seperti Strava, dengan alur awal dari ajakan hingga aktivitas terlaksana.

Direktori kerja proyek: `/Users/wspdv/Works/dolend`.

## Status proyek

Untuk melanjutkan pekerjaan tanpa membaca seluruh repository, mulai dari [AI handoff aktif](docs/AI-HANDOFF.md). [AI start map](docs/AI-START.md) menjelaskan sumber kebenaran dan routing konteks. `README.md` adalah overview; scope dan acceptance criteria tetap dimiliki `PLAN.md`.

Brief produk T01 selesai untuk sumber yang tersedia dan **T02 kompatibilitas Elysia/Supabase sudah GO**. **T03 static Hosting juga sudah GO**: query-route serta auth/payment return shell lulus pengujian browser pada preview Firebase.

- Next.js menghasilkan static export untuk beranda, `/account/`, `/event/`, `/auth/callback/`, dan `/payment/`. Target Hosting: project `dolend-apps`, site `dolend`.
- Elysia sudah di-deploy ke Supabase. Sepuluh test lokal serta smoke HTTP hosted 120 request lulus pada 27 Oktober 2026.
- Hosted user JWT, RPC/RLS dengan 20 write konkuren, private Storage, raw-signature webhook/deduplication, dan instalasi source bersih sudah lulus. Probe serta fixture sementara telah dihapus.
- Migration hybrid auth, dynamic manual contributions, venue validation, optimistic event update, event invitation, dan self-participation telah diterapkan manual ke hosted sampai 3 November 2026 tanpa menjatuhkan data lama. Tipe database sudah digenerate ulang dari schema hosted.
- T08 memakai Google OAuth untuk organizer, callback PKCE, bootstrap profile/workspace, role organizer per workspace/event, serta guest booking nama+WhatsApp dengan token hash-only. Login Google asli dari localhost dan Firebase Hosting sudah berhasil masuk dashboard; OAuth masih berstatus testing sampai branding/publishing diselesaikan.
- T11 live menambahkan event public/unlisted, tautan undangan hash-only dengan expiry/revoke, copy link, dan tombol WhatsApp eksplisit. Token invite berada di fragment URL dan aplikasi tidak mengirim WhatsApp otomatis.
- T12 backend live menghubungkan join/status/cancel member Google dan cancel guest dari tautan booking. Akun organizer tetap akun biasa yang dapat ikut event; pembatalan mandiri setelah lock mempertahankan tagihan sampai organizer memutuskan penyesuaian.
- T13 private-upload lifecycle selesai lokal dan menunggu rilis backend: staging registry 24 jam, attachment atomik QRIS/bukti, serta cleanup lintas Supabase/S3. Batas final file PNG/JPEG 2 MiB dan signed URL 120 detik.
- T14 invoice selesai lokal dan menunggu rilis backend: event gratis/prepay/postpay, snapshot harga/rekening, hold atau due date, invoice scoped guest/member, overdue projection, dan roster invoice organizer. Submit bukti invoice tetap scope T15; gateway tetap ditunda.

Detail progres dan kriteria penerimaan ada di [PLAN.md](PLAN.md) dan [hasil POC](docs/POC-RESULTS.md).

## Landing page publik

Target live: **https://dolend.web.app/**, project Firebase `dolend-apps`, site `dolend` (target `web`). Landing mengadaptasi [HTML referensi pengguna](docs/references/dolend_landing_page_demo.html) menjadi React/Tailwind/shadcn dengan hero, kategori kegiatan, simulator patungan, FAQ dan navigasi mobile.

Kalkulator, pilihan DP, status peserta, copy link, serta tautan simulasi dapat dicoba tanpa login. Konfigurasi simulasi dibagikan lewat URL fragment; tidak membuat event atau menyimpan peserta ke database. Login organizer kini dirancang memakai Google, bukan SMS. Payment gateway tetap **ditunda atas permintaan pengguna**. DP 50% hanya ilustrasi front-end, bukan fitur installment backend yang sudah tersedia.

```sh
pnpm run build
pnpm run test:landing
pnpm run hosting:deploy
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

Versi dependency dipin dalam `package.json` dan `pnpm-lock.yaml`; versi pnpm dipin melalui field `packageManager`. Elysia serta SDK backend dipin terpisah dalam `supabase/functions/dolend-api/deno.json` dan `deno.lock`. Commit lockfile pnpm dan Deno tersebut. Proyek tidak menggunakan Cloudflare.

## Persiapan

Gunakan **Node.js 24 LTS** seperti `.node-version` dan pnpm versi yang dipin di `package.json`. Seri Node 22 mulai 22.14 juga didukung aplikasi; CI memakai Node 24. Aktifkan Corepack agar versi pnpm yang dipin digunakan. Deno, Supabase CLI, dan Firebase CLI sudah menjadi dependency lokal; keduanya tidak perlu dipasang global. Docker diperlukan hanya untuk menjalankan Supabase lokal melalui CLI, bukan untuk API Deno langsung.

```sh
cd /Users/wspdv/Works/dolend
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
```

`.env.local` workspace sudah berisi URL project, URL API, dan publishable key Dolend. File ini gitignored dan dipakai otomatis oleh Next.js; Deno membacanya melalui perintah `--env-file` di bawah. Periksa tanpa menampilkan key dengan `pnpm run env:check`. Browser hanya boleh menerima URL dan public/publishable key lewat `NEXT_PUBLIC_*`; secret layanan tetap di server. Nilai `NEXT_PUBLIC_*` masuk ke bundle saat build. Penjelasan koneksi database, hosted Function, Firebase, dan CI ada di [ENVIRONMENT.md](docs/ENVIRONMENT.md).

## Menjalankan aplikasi

Frontend dan API sekaligus (disarankan):

```sh
pnpm run dev:all
```

Log diberi awalan `[web]` dan `[api]`. Menekan `Ctrl+C` menghentikan keduanya. Jika ingin menjalankannya terpisah, frontend pada terminal pertama:

```sh
pnpm run dev
```

Buka [localhost:3000](http://localhost:3000).

API Deno, pada terminal kedua dari direktori proyek:

```sh
pnpm run api:dev
```

Health API: [localhost:8000/dolend-api/v1/health](http://localhost:8000/dolend-api/v1/health). Watch mode aktif. `/me`, `/profile/bootstrap`, dan `/profile` membutuhkan user JWT Google melalui Supabase; anon key bukan identitas pengguna. Guest booking memakai `POST /events/:id/guest-bookings` dan service-role hanya di backend.

`api:dev` membaca `.env.local` dan menjalankan API dengan watch mode. Event unlisted dibuka melalui `/event/?id=<uuid>#invite=<token>`; fragment diteruskan client sebagai header API dan dipertahankan saat guest mendapat token booking. Perintah ekuivalennya:

```sh
pnpm exec deno run --env-file=.env.local \
  --config supabase/functions/dolend-api/deno.json \
  --allow-env --allow-net --watch \
  supabase/functions/dolend-api/index.ts
```

Untuk `/me` lokal, set `SUPABASE_URL` dan `SUPABASE_PUBLISHABLE_KEY` (atau `SUPABASE_ANON_KEY`) pada environment API. Hosted Functions menyediakan konfigurasi platformnya sendiri. `ALLOWED_ORIGINS` menerima daftar origin dipisahkan koma, default `http://localhost:3000`; `PORT` default `8000`. Route eksperimen `/poc/echo` hanya tersedia jika `POC_MODE=true`; biarkan nonaktif pada hosted production.

## Perintah pengembangan

| Perintah | Kegunaan |
| --- | --- |
| `pnpm run dev:all` | Frontend dan API paralel dalam satu terminal |
| `pnpm run dev` | Frontend dengan live reload |
| `pnpm run env:check` | Validasi `.env.local` tanpa mencetak key |
| `pnpm run build` | Build frontend menjadi folder `out/` |
| `pnpm run lint` | ESLint frontend dan script Node; API diperiksa lewat Deno |
| `pnpm run typecheck` | Pemeriksaan TypeScript frontend |
| `pnpm run api:dev` | API Deno dengan watch mode |
| `pnpm run api:check` | Pemeriksaan tipe API |
| `pnpm run api:test` | Test handler API lokal, tanpa layanan Supabase |
| `pnpm run api:test:hosted-profile` | Test profil/JWT/RLS hosted dengan fixture sementara |
| `pnpm run test:phone` | Unit test normalisasi nomor Indonesia |
| `pnpm run test:account` | Browser test fondasi akun pada desktop dan mobile |
| `pnpm run test:organizer` | Browser test dashboard, create/manage event, dan roster |
| `pnpm run test:participation` | Browser test booking/cancel guest serta join/cancel akun Google |
| `pnpm run api:smoke` | Smoke HTTP ke `API_BASE_URL` yang ditentukan |
| `pnpm run supabase -- <command>` | Supabase CLI lokal |
| `pnpm run ui -- add <component>` | Menambah komponen shadcn/ui |
| `pnpm run poc:check` / `pnpm run poc:test` | Pemeriksaan probe kompatibilitas tanpa hosted fixture |
| `pnpm run build:preview` | Static build dengan adapter fixture publik khusus pratinjau |
| `pnpm run preview:fixture` | Buat data contoh baru setelah build selesai |
| `pnpm run db:test` | Replay migration, invariant/RLS tests dan snapshot restore lokal |
| `pnpm run db:test:hosted` | Scoped fixture test hosted; memerlukan DATABASE_TEST_PROJECT_REF eksplisit |
| `pnpm run storage:test:hosted:supabase` | E2E private upload Supabase; membuat dan membersihkan fixture hosted |
| `pnpm run db:catalog` | Verifikasi RLS/grants/FK indexes dan generate dictionary |
| `pnpm run db:types` | Generate ulang TypeScript contracts dari schema hosted |
| `pnpm run test:landing` | Browser tests landing dan simulator pada build normal |
| `pnpm run hosting:deploy` | Deploy langsung output build ke https://dolend.web.app/ |
| `pnpm run test:hosting` | Uji browser desktop dan mobile terhadap static export |
| `pnpm run test:r06` | Verifikasi lokal R06: database, build normal, alur guest/organizer, build fixture, dan static-hosting refresh |
| `pnpm run hosting:preview` | Deploy channel `t03` ke site `dolend`, expiry 7 hari |

Pemeriksaan sebelum mengirim perubahan:

```sh
pnpm run lint
pnpm run build
pnpm run typecheck
pnpm run api:check
pnpm run api:test
```

Dengan API lokal tetap berjalan, jalankan smoke HTTP:

```sh
API_BASE_URL=http://localhost:8000/dolend-api/v1 pnpm run api:smoke
```

Smoke mengirim 100 health request berurutan dan 20 bersamaan. Hasil ini tidak membuktikan transaksi database, concurrency write, atau cold start. `api:smoke` juga mendukung environment `SUPABASE_PUBLISHABLE_KEY`; untuk legacy anon JWT, script mengirimkannya sebagai bearer ke gateway. Endpoint `/me` tetap membutuhkan user JWT tersendiri.

## Supabase dan deployment

Project POC yang dipilih: [`fpbefabsqryxmnmxufjw`](https://supabase.com/dashboard/project/fpbefabsqryxmnmxufjw). Fungsi: `dolend-api`. Base URL API hosted:

```text
https://fpbefabsqryxmnmxufjw.supabase.co/functions/v1/dolend-api/v1
```

Jika CLI belum terautentikasi, login terlebih dahulu. Deploy function menggunakan project ref eksplisit; perintah ini tidak melakukan database linking atau migration:

```sh
pnpm run supabase -- login
pnpm run supabase -- functions deploy dolend-api \
  --project-ref fpbefabsqryxmnmxufjw --use-api
```

Gateway JWT verification tetap aktif; health hosted tanpa kredensial ditolak. Origin frontend staging/production harus dimasukkan ke `ALLOWED_ORIGINS` function setelah domain Hosting ditentukan. Jangan menyimpan access token, service-role key, atau secret provider di Git.

Frontend memakai `output: 'export'` dan konfigurasi `firebase.json` yang menunjuk `out/`. Project Firebase `dolend-apps` dan site `dolend` sudah dipilih melalui target `web` di `.firebaserc`; default site `dolend-apps` bukan target deploy aplikasi ini. Tidak ada backend Next.js, Server Actions, atau runtime API route dalam rancangan ini. Link event memakai `/event/?id=<uuid>` dan client fetch, sehingga HTML shell tidak perlu dibangun ulang untuk setiap event. API event read/create/manage dan callback Google hosted sudah aktif melalui Supabase Edge Function; callback payment tetap shell dan tidak mengonfirmasi pembayaran.

## Preview Firebase dan uji static hosting

Firebase CLI yang dipin dipasang oleh `pnpm install --frozen-lockfile`. Untuk deploy manual, login melalui `pnpm exec firebase login`; CI menggunakan OIDC tanpa login browser. Untuk preview T03:

```sh
pnpm run build:preview
pnpm run preview:fixture
pnpm run test:hosting
pnpm run hosting:preview
```

Fixture JSON dibuat di `out/__poc/events/` setelah build. Metadata ID lokal di `.firebase-preview-fixture.json` diabaikan Git. Data contoh hanya berisi informasi publik sintetis dan diberi label pratinjau; bukan event yang dapat didaftarkan. API nyata memakai `NEXT_PUBLIC_API_URL` dan format `{ data: PublicEvent }`. Build normal (`pnpm run build`) membersihkan output fixture dan tidak mengaktifkan adapter POC jika flag tidak diaktifkan.

Uji browser memakai Chrome lokal secara default. Jika memakai Chromium Playwright, jalankan `pnpm exec playwright install chromium` lalu set `PLAYWRIGHT_CHANNEL=chromium`. Uji preview dengan URL hasil deploy:

```sh
HOSTING_BASE_URL=https://dolend--t03-pnd1m1mh.web.app pnpm run test:hosting
```

Preview channel bersifat publik dan berumur terbatas; jangan memasukkan data pribadi ke fixture. Deployment ini ditujukan ke preview, bukan live channel. Metadata/preview WhatsApp tetap umum Dolend; SEO event dinamis terbatas karena konten diambil setelah halaman dibuka.

GitHub Actions untuk **https://dolend.web.app/** sudah aktif dan terbukti: checks → verified static artifact → OIDC deploy ke live saat push main. PR hanya menjalankan checks; build gagal tidak mencapai job deploy. Lihat [CI-CD.md](docs/CI-CD.md). Preview manual tetap terpisah dari live deployment.

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

- [AI handoff aktif](docs/AI-HANDOFF.md): task sekarang, bukti, gap, dan next action.
- [AI start map](docs/AI-START.md): urutan baca, source-of-truth, routing, dan level bukti.
- [Rencana implementasi](PLAN.md): MVP, schema, API, milestones, dan risks.
- [Product brief](docs/PRODUCT.md): persona, istilah, dan keputusan produk.
- [Fondasi UI](docs/UI-FOUNDATION.md): React/Tailwind/shadcn, tokens, komponen, dan cara menambah komponen.
- [Environment](docs/ENVIRONMENT.md): `.env.local`, koneksi database, Edge Function, Firebase dan CI.
- [ADR runtime POC](docs/decisions/0001-runtime-poc.md): gate kompatibilitas Elysia/Supabase.
- [Hasil POC](docs/POC-RESULTS.md): bukti GO, pengukuran, dan batas verifikasi.
- [Hasil Hosting T03](docs/HOSTING-RESULTS.md): URL preview, browser checks, dan batas shell auth/payment.
- [CI/CD](docs/CI-CD.md): workflow, identitas OIDC, urutan deployment dan rollback.
- [Landing page live](docs/LANDING-PAGE.md): referensi, simulator, status demo dan hasil rilis.
- [Fondasi database](docs/DATABASE.md) dan [hasil T04](docs/DATABASE-RESULTS.md): ERD, akses, migrations, tests, serta prosedur pemulihan.
- [Menjalankan ulang POC](supabase/poc/README.md): setup, prepare, test, dan cleanup resource sementara.

MVP mencakup event oleh organizer berakun Google, WhatsApp share, venue/Google Maps, jadwal/kapasitas, guest/member, serta pembayaran sebelum/sesudah event melalui transfer manual, QRIS, dan metode gateway. Role organizer adalah izin workspace/event; akun yang sama boleh menjadi peserta. Phase 2 menambahkan follow, communities, feed, dan photos; Phase 3 menambahkan challenges, achievements, stats, dan recommendations.

## Iuran manual dinamis

Kontrak dan batas implementasi terbaru: [API iuran manual](docs/MANUAL-PAYMENT-API.md). QRIS statis, transfer, dan tunai langsung ke organizer; gateway tetap ditunda. Tagihan dynamic berbeda dari invoice legacy.
