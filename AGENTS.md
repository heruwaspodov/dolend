# Panduan agent — Dolend

Panduan ini berlaku untuk seluruh repository. Ikuti instruksi tambahan pada `AGENTS.md` di subdirektori bila tersedia.

## Konteks dan sumber acuan

Dolend adalah social activity network untuk merencanakan aktivitas bersama. Gunakan bahasa Indonesia untuk copy produk dan dokumentasi, mengikuti gaya file yang sedang diubah.

- Baca `README.md` untuk setup, perintah, dan status implementasi; `PLAN.md` untuk scope, dependensi task, dan acceptance criteria.
- Keputusan produk: `docs/PRODUCT.md`. UI: `docs/UI-FOUNDATION.md`. Auth: `docs/AUTH-FOUNDATION.md`.
- Database: `docs/DATABASE.md` dan `docs/DATA-DICTIONARY.md`. Environment dan rilis: `docs/ENVIRONMENT.md` dan `docs/CI-CD.md`.
- Bedakan fitur yang sudah terhubung dengan demo, fixture, dan shell. Jangan menyatakan alur auth/payment/event selesai hanya karena tampilannya tersedia.
- SMS dan payment gateway ditunda atas permintaan pengguna; jangan mengaktifkannya tanpa perubahan scope dari pengguna. DP pada simulator adalah ilustrasi frontend.

## Arsitektur dan lokasi perubahan

- Frontend: Next.js App Router, React, TypeScript strict; halaman di `src/app/`, komponen fitur di `src/components/`, helper di `src/lib/`. Alias import `@/` menunjuk `src/`.
- Pertahankan static export (`output: 'export'`), `trailingSlash`, dan kompatibilitas Firebase Hosting. Backend berjalan di Elysia melalui Deno pada Supabase Edge Functions, bukan runtime Next.js. Jangan menambahkan Server Actions atau API route yang memerlukan server Next.js.
- Event memakai shell `/event/?id=<uuid>` dan client fetch. Pertahankan direct link, refresh, serta loading/error/empty states.
- API utama: `supabase/functions/dolend-api/`; probe kompatibilitas terpisah di `supabase/functions/dolend-compat-poc/`. Ikuti konfigurasi Deno dan lockfile masing-masing.
- Schema dan transaksi: `supabase/migrations/`; pengujian SQL: `supabase/tests/`; tooling database: `scripts/database/`.
- UI menggunakan Tailwind CSS v4, shadcn/ui, dan Lucide. Gunakan komponen `src/components/ui/` serta semantic token di `src/app/globals.css`. Pertahankan label form, navigasi keyboard, focus yang terlihat, dan tampilan mobile 360 px.

## Data, keamanan, dan konfigurasi

- Jangan mencetak atau memasukkan `.env.local`, token, service-role key, maupun secret provider ke Git. Gunakan `.env.example` untuk nama variabel dan `npm run env:check` untuk validasi tanpa menampilkan key.
- `NEXT_PUBLIC_*` masuk ke bundle browser saat build; hanya URL dan public/publishable key yang boleh tersedia di sana. Secret tetap pada server.
- Perubahan schema dibuat sebagai migration baru; pertahankan RLS, grants, indeks FK, dan invariant transaksi. Jangan mengubah migration yang sudah diterapkan untuk memperbaiki schema hosted.
- Otorisasi API harus memverifikasi identitas dan kepemilikan; service-role melewati RLS. Jangan mempercayai actor/user/profile ID dari input klien sebagai bukti identitas.
- Identitas bisnis adalah `public.users`; identitas login adalah `auth.users`. Gunakan normalisasi `src/lib/phone.ts` untuk nomor Indonesia canonical `62...`.
- Nilai uang disimpan sebagai integer IDR. Gunakan RPC transaksi yang tersedia untuk operasi bisnis yang memerlukan konsistensi, serta pertahankan idempotensi dan riwayat finansial.
- `src/lib/database.types.ts` adalah hasil generate: gunakan `npm run db:types` setelah perubahan schema yang relevan; jangan memperbaiki kontrak hanya dengan mengedit file hasil generate.

## Workflow pengembangan

- Gunakan Node sesuai `.node-version` dan npm dengan `package-lock.json`. Setup: `npm ci`; frontend dan API: `npm run dev:all`.
- Pertahankan versi dependency exact dan lockfile terkait. Gunakan CLI lokal melalui script npm atau `npx`.
- Ikuti pola kode yang ada dan batasi diff pada kebutuhan task. Jangan menyertakan output `out/`, `.next/`, cache, log, atau fixture sementara.
- Perbarui dokumentasi terkait bila perilaku, konfigurasi, kontrak, atau status task berubah. Laporkan hasil verifikasi dan batas yang belum diuji secara konkret.

## Verifikasi

Pilih pemeriksaan sesuai dampak perubahan; perubahan dokumentasi saja cukup diperiksa diff dan referensinya.

| Area | Pemeriksaan |
| --- | --- |
| Frontend | `npm run lint`, `npm run build`, lalu `npm run typecheck` |
| Landing/demo/akun | Setelah build normal: `npm run test:landing`, `npm run test:demo`, atau `npm run test:account` sesuai area |
| Normalisasi nomor | `npm run test:phone` |
| API | `npm run api:check` dan `npm run api:test` |
| Probe kompatibilitas | `npm run poc:check` dan `npm run poc:test` |
| Database | `npm run db:test`; baca petunjuk database sebelum menjalankan pemeriksaan hosted |
| Static hosting dengan fixture | `npm run build:preview`, `npm run preview:fixture`, lalu `npm run test:hosting` |

Playwright melayani folder `out/`, sehingga perlu build terlebih dahulu. Default memakai Chrome lokal; gunakan `PLAYWRIGHT_CHANNEL=chromium` jika browser Chromium Playwright sudah dipasang. Build fixture khusus preview; build rilis normal harus memakai `NEXT_PUBLIC_POC_EVENT_FIXTURES=false`.

## Deployment

- Target frontend: Firebase project `dolend-apps`, Hosting site `dolend`, target `web`. Jangan tertukar dengan default site project.
- Push ke `main` memicu checks dan deployment live melalui GitHub Actions. Perlakukan push tersebut sebagai tindakan rilis.
- Deploy manual, migration hosted, dan test hosted dapat mengubah resource eksternal; jalankan hanya dalam scope yang diminta pengguna dan dengan target eksplisit. Ikuti `docs/CI-CD.md` serta prosedur database terkait.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
