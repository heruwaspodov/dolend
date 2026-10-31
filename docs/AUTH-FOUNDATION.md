# Fondasi hybrid auth

Status 31 Oktober 2026: Google OAuth menjadi login wajib untuk organizer dan opsional untuk peserta. Guest dapat booking tanpa akun memakai nama, WhatsApp, dan token booking scoped. Migration, Edge Function, dan frontend snapshot 31 Oktober sudah diterapkan manual. Verifikasi hosted memakai fixture metadata Google sintetis, sehingga login Google asli dan redirect production belum dinyatakan lulus.

## Batas identitas

- `auth.users` adalah identitas login Supabase. Organizer harus memiliki email terkonfirmasi dan provider Google pada metadata Auth.
- `public.users` adalah identitas bisnis/partisipasi. Akun Google dapat memiliki `phone_normalized = NULL`; guest memiliki WhatsApp canonical `62...`.
- `profiles` mengikat satu Auth UUID ke satu business user. `bootstrap_google_profile()` membaca `auth.uid()` dan metadata server-side, bukan ID dari body klien.
- Role organizer berada pada `workspace_members` atau `event_organizers`. Role ini bukan tipe akun dan tidak menghalangi business user yang sama masuk ke `event_participants`.

## Login organizer

Browser client memakai publishable key, PKCE, persisted session, dan automatic token refresh. `/account/` memulai `signInWithOAuth({ provider: 'google' })`; `/auth/callback/` menukar code melalui SDK, menghapus query dari address bar, lalu memanggil `POST /profile/bootstrap`.

Bootstrap bersifat idempotent:

1. API memverifikasi access token ke Supabase Auth.
2. Database memastikan provider Google dan email confirmed.
3. RPC membuat `public.users`, `profiles`, workspace pribadi, serta membership owner bila belum ada.
4. Profile lama dipertahankan dan ditandai `auth_provider = 'google'` setelah akun yang sama memiliki Google identity.

Redirect berikut harus masuk allowlist Supabase sebelum pengujian hosted:

- `http://localhost:3000/auth/callback/`
- `https://dolend.web.app/auth/callback/`

## Guest booking

`POST /events/:eventId/guest-bookings` menerima `display_name` dan `whatsapp`. Server memvalidasi nomor seluler Indonesia dengan `libphonenumber-js`, lalu membuat token acak 256-bit. Hanya SHA-256 token yang disimpan di `guest_sessions`; token mentah dikembalikan sekali. UI menaruh token pada URL fragment `#booking=...`, bukan query, lalu `GET /events/:eventId/guest-bookings/me` mengirimnya melalui header untuk membaca proyeksi status sendiri. Respons token/status memakai `Cache-Control: no-store`.

RPC `create_guest_booking()` mengunci event dan business user, menolak event tertutup serta duplicate booking, membuat guest session scoped, lalu memakai transaksi `join_event()`. WhatsApp adalah kontak, bukan bukti bahwa guest menguasai nomor tersebut. Duplicate booking tidak menerbitkan token baru. Claim riwayat tetap memerlukan proof kepemilikan tersendiri.

Migration hardening `20261031120000_harden_guest_booking_identity.sql` menolak jalur guest bila nomor tersebut sudah terhubung ke `profiles`. Dengan demikian input nomor saja tidak dapat mengikat partisipasi baru ke business user milik akun Google. Migration ini lulus replay lokal dan belum diterapkan ke hosted.

Migration `20261031130000_guest_booking_rate_limit.sql` memakai `rate_limit_counters` yang sudah ada untuk membatasi satu event/contact sebanyak 5 percobaan dan satu event/IP sebanyak 30 percobaan per 15 menit. API menyimpan bucket HMAC-SHA256, bukan WhatsApp atau IP mentah, dan mengembalikan `429` serta `Retry-After`. Secret `RATE_LIMIT_PEPPER` minimal 32 karakter wajib tersedia sebelum endpoint guest diaktifkan. Migration dan secret ini belum diterapkan ke hosted.

Recovery token tidak menerima pencarian nomor. Organizer Google yang berhak dapat memanggil `POST /participants/:id/guest-token`; RPC mengunci partisipasi, mencabut seluruh sesi aktif guest tersebut pada event yang sama, lalu mengembalikan token baru sekali dengan `Cache-Control: no-store`. UI distribusi ulang tautan dari roster masih task dashboard.

Endpoint belum siap produksi sampai throttle dan rotasi token dibuktikan pada PostgreSQL hosted. Gateway Function tetap memerlukan project public key pada request guest; service-role dan rate-limit pepper tidak pernah dikirim ke browser.

## API profil

- `GET /dolend-api/v1/me` mengembalikan Auth UUID, email sendiri, dan status Google verified.
- `POST /dolend-api/v1/profile/bootstrap` membuat profil/workspace dari JWT secara idempotent.
- `GET /dolend-api/v1/profile` mengembalikan proyeksi profil milik JWT.
- `PATCH /dolend-api/v1/profile` hanya menerima `bio`, `avatar_path`, dan `default_timezone`.
- Query profil memakai bearer user dan RLS. Service-role hanya dipakai pada endpoint guest booking untuk RPC yang melakukan authorization domain eksplisit.

## Verifikasi lokal

```sh
npm run test:phone
npm run db:test
npm run api:check
npm run api:test
npm run lint
npm run build
npm run typecheck
npm run test:account
```

Hosted profile test 27 Oktober berbasis phone identity tidak mewakili kontrak baru. Verifikasi storage 31 Oktober memakai fixture metadata Google sintetis dan juga bukan bukti login OAuth asli. Jangan melakukan deploy lanjutan atau mengubah konfigurasi provider production tanpa persetujuan eksplisit.
