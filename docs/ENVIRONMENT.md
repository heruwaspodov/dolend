# Environment dan koneksi layanan Dolend

## File lokal

Gunakan `.env.local` untuk frontend Next.js dan API Deno lokal. File ini sudah dibuat pada workspace, berizin `0600`, dan diabaikan Git. `.env.example` adalah kontrak konfigurasi tanpa nilai key.

Next.js membacanya otomatis melalui `npm run dev`; `npm run api:dev` meneruskannya ke Deno dengan `--env-file=.env.local`.

Validasi konfigurasi tanpa mencetak key:

```sh
npm run env:check
```

| Variable | Pemakai | Sifat |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser/static bundle | Public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser/static bundle | Public, RLS tetap wajib |
| `NEXT_PUBLIC_API_URL` | Browser → Elysia Edge Function | Public |
| `NEXT_PUBLIC_POC_EVENT_FIXTURES` | Build preview lama | Harus `false` untuk normal/live |
| `SUPABASE_URL` | Elysia lokal | Server env, URL bukan secret |
| `SUPABASE_PUBLISHABLE_KEY` | Validasi JWT Elysia lokal | Public key di server env |
| `ALLOWED_ORIGINS` | CORS Elysia | Public config |
| `POC_MODE` | Route eksperimen | Harus `false` |
| `PORT` | Elysia lokal | Local config |
| `DATABASE_TEST_PROJECT_REF` | Hosted database test guard | Public project identifier |

Jangan menaruh service-role key, database password, SMS token, payment secret, atau webhook secret pada variable `NEXT_PUBLIC_*`. Nilai dengan prefix itu masuk ke JavaScript hasil build.

## Mengapa database tidak memakai .env

Schema database tidak dipilih oleh aplikasi melalui `.env.local`. Supabase CLI sudah di-link ke project `fpbefabsqryxmnmxufjw`; project ref lokal disimpan dalam `supabase/.temp/` yang gitignored. Login CLI menyediakan otorisasi untuk migration:

```sh
npx supabase migration list --linked
npx supabase db push --linked --dry-run
npx supabase db push --linked
```

Migration SQL pada `supabase/migrations/` adalah source of truth schema. Ini menghindari penyimpanan password PostgreSQL atau service-role key di repository.

## Hosted Edge Function

Supabase menyediakan reserved secrets seperti `SUPABASE_URL`, anon/publishable compatibility key, dan service-role key kepada Edge Function hosted. Secret aplikasi tambahan nantinya dikelola dengan `supabase secrets set`, bukan file yang di-commit. SMS dan payment secrets tetap belum dibuat karena provider ditunda.

## Firebase dan CI

Firebase Hosting memakai `.firebaserc` dan `firebase.json`, bukan Firebase client SDK sehingga tidak memerlukan Firebase web env. GitHub Actions memakai OIDC untuk deploy. Konfigurasi Supabase yang public disimpan sebagai repository Actions variables dan dimasukkan saat static build; tidak ada database password atau service-role key di GitHub Actions.
