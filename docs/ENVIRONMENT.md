# Environment dan koneksi layanan Dolend

## File lokal

Gunakan `.env.local` untuk frontend Next.js dan API Deno lokal. File ini sudah dibuat pada workspace, berizin `0600`, dan diabaikan Git. `.env.example` adalah kontrak konfigurasi tanpa nilai key.

Next.js membacanya otomatis melalui `pnpm run dev`; `pnpm run api:dev` meneruskannya ke Deno dengan `--env-file=.env.local`.

Validasi konfigurasi tanpa mencetak key:

```sh
pnpm run env:check
```

| Variable | Pemakai | Sifat |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser/static bundle | Public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser/static bundle | Public, RLS tetap wajib |
| `NEXT_PUBLIC_API_URL` | Browser → Elysia Edge Function | Public |
| `NEXT_PUBLIC_POC_EVENT_FIXTURES` | Build preview lama | Harus `false` untuk normal/live |
| `SUPABASE_URL` | Elysia lokal | Server env, URL bukan secret |
| `SUPABASE_PUBLISHABLE_KEY` | Validasi JWT Elysia lokal | Public key di server env |
| `SUPABASE_SERVICE_ROLE_KEY` | RPC guest/payment Elysia | Secret server-only; tidak boleh memakai prefix `NEXT_PUBLIC_` |
| `STORAGE_PROVIDER` | Adapter file privat Elysia | `supabase` (default) atau `s3` |
| `SUPABASE_STORAGE_BUCKET` | Adapter Supabase Storage | Default `dolend-payments` |
| `S3_BUCKET`, `S3_REGION` | Adapter Amazon/S3-compatible | Wajib saat provider `s3` |
| `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE` | Adapter S3-compatible | Opsional untuk AWS; endpoint diperlukan untuk MinIO/R2/provider kompatibel |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_SESSION_TOKEN` | Adapter S3 | Secret server-only; session token opsional |
| `GEOAPIFY_API_KEY` | Pencarian venue eksternal Elysia | Secret server-only opsional, konfigurasi lokal dan Edge Function hosted |
| `RATE_LIMIT_PEPPER` | HMAC bucket throttle guest | Secret server-only minimal 32 karakter, berbeda per environment |
| `ALLOWED_ORIGINS` | CORS Elysia | Public config |
| `POC_MODE` | Route eksperimen | Harus `false` |
| `PORT` | Elysia lokal | Local config |
| `DATABASE_TEST_PROJECT_REF` | Hosted database test guard | Public project identifier |

Jangan menaruh service-role key, database password, SMS token, payment secret, atau webhook secret pada variable `NEXT_PUBLIC_*`. Nilai dengan prefix itu masuk ke JavaScript hasil build.

## Mengapa database tidak memakai .env

Schema database tidak dipilih oleh aplikasi melalui `.env.local`. Supabase CLI sudah di-link ke project `fpbefabsqryxmnmxufjw`; project ref lokal disimpan dalam `supabase/.temp/` yang gitignored. Login CLI menyediakan otorisasi untuk migration:

```sh
pnpm exec supabase migration list --linked
pnpm exec supabase db push --linked --dry-run
pnpm exec supabase db push --linked
```

Migration SQL pada `supabase/migrations/` adalah source of truth schema. Ini menghindari penyimpanan password PostgreSQL atau service-role key di repository.

## Hosted Edge Function

Supabase menyediakan reserved secrets seperti `SUPABASE_URL`, anon/publishable compatibility key, dan service-role key kepada Edge Function hosted. `RATE_LIMIT_PEPPER` dan `INTERNAL_JOB_KEY` harus acak, minimal 32 karakter per environment, dan dikelola melalui `supabase secrets set`, bukan file yang di-commit. `STORAGE_PROVIDER=supabase` memakai bucket private bawaan dan tidak memerlukan secret tambahan. Provider `s3` memakai secret server-only yang juga harus dikelola melalui secret manager, bukan Git. SMS dan payment secrets tetap belum dibuat karena provider ditunda.

Referensi file lama tanpa prefix selalu dibaca dari Supabase. Objek baru pada provider S3 disimpan sebagai referensi `s3:<key>`, sehingga kedua backend dapat aktif bersamaan selama migrasi. Mengganti provider tidak memindahkan objek otomatis; salin objek secara terverifikasi sebelum mencabut kredensial Supabase lama.

Lifecycle upload tidak bergantung pada provider. Row staging dibuat sebelum object, berlaku 24 jam, dan dipasang atomik ke metode QRIS atau laporan pembayaran. `POST /internal/storage/orphans/cleanup` memakai `SUPABASE_SERVICE_ROLE_KEY` sebagai Bearer credential. Sweep pembayaran memakai `POST /internal/jobs/payment-maintenance` dan `INTERNAL_JOB_KEY` terpisah. Jangan panggil endpoint internal dari browser atau menaruh key di URL/log. Scheduler hosted belum diaktifkan; sampai itu aktif, jalankan worker hanya sebagai prosedur backend terkontrol setelah migration dan Function versinya cocok.

## Firebase dan CI

Firebase Hosting memakai `.firebaserc` dan `firebase.json` dengan OIDC untuk deploy. Konfigurasi publik Supabase disimpan sebagai repository Actions variables dan dimasukkan saat static build. URI database untuk migrasi dan token deploy API disimpan sebagai environment secrets di `production`. Service-role key tetap dikelola di Supabase. Lihat [alur rilis](CI-CD.md#backend-dan-migration-ordering).

## Origin API live (31 Oktober 2026)

ALLOWED_ORIGINS pada Edge Functions mencakup http://localhost:3000, http://127.0.0.1:3000, https://dolend.web.app dan https://dolend.firebaseapp.com. Preview domain tambahan harus dimasukkan eksplisit; wildcard tidak dipakai. Secret ini konfigurasi server, bukan NEXT_PUBLIC.
