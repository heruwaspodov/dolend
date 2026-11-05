# T20 — Verifikasi hosted guest registration

Tanggal: 4 November 2026. Lingkungan: Supabase project Dolend dan Edge Function `dolend-api` yang sedang terpasang.

## Hasil

Lulus: test membuat akun organizer sintetis, bootstrap profil/workspace melalui API, dan membuat event publik fixture secara langsung pada database hosted. Guest didaftarkan melalui `POST /events/:id/guest-bookings` pada Function live; respons booking token kemudian dipakai pada `GET /events/:id/guest-bookings/me`. `participant_id` dan status booking cocok dengan hasil pendaftaran.

Seluruh event, sesi guest, rate-limit bucket fixture, profil, workspace, user bisnis dan Auth fixture dibersihkan setelah test. Tidak memakai Google OAuth sungguhan, tidak mengirim SMS/pembayaran, dan tidak menguji browser UI live.

## Migration Storage dan batas runner gabungan

Awalnya runner `scripts/database/manual-storage-hosted-test.mjs` gagal karena project hosted belum memiliki `public.private_uploads`. Migration `20261104100000_private_upload_lifecycle.sql` kini sudah diterapkan khusus ke project Dolend dan tercatat pada migration history; tabel ada, RLS aktif, dan hak service-role terverifikasi. `src/lib/database.types.ts` digenerate ulang dari schema tersebut.

Database dan Edge Function adalah resource deploy terpisah: migration tidak memperbarui Function secara otomatis. Function `dolend-api` kemudian dideploy sebagai versi 24 dari kode lokal. Probe health hosted kini mengembalikan `Cache-Control: no-store` dan `X-Content-Type-Options: nosniff`. Runner gabungan berhasil memverifikasi QRIS upload terdaftar di `private_uploads` sebelum object write dan kemudian terpasang melalui RPC.

Fixture event runner sebelumnya tidak mengirim field `visibility` yang diwajibkan kontrak API; setelah diperbaiki, runner lulus penuh pada 5 November 2026. Cleanup endpoint internal mengharuskan key `sb_secret` yang cocok dengan `SUPABASE_SERVICE_ROLE_KEY` runtime, bukan legacy key yang dipakai client database. Runner kini mengambil API key tersebut tanpa mencetak nilainya. Report mencatat `cleanup_verified: true`.

Upload orphan dan seluruh akun/profile/workspace/event/payment fixture terhapus setelah test. Jalur hosted Storage dan guest-proof kini lulus pada Function v24.
