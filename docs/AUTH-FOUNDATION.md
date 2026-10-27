# Fondasi Auth dan identitas nomor

Status 27 Oktober 2026: bagian T08 yang tidak memerlukan provider SMS sudah tersedia. Halaman `/account/` memvalidasi nomor dan membaca sesi Supabase, tetapi sengaja tidak menawarkan atau mengirim OTP.

## Kontrak nomor

- Input yang diterima: nomor seluler Indonesia dengan awalan `08`, `62`, atau `+62`; spasi, tanda kurung, titik, dan tanda hubung boleh dipakai sebagai pemisah.
- Database: `phone_normalized` berupa teks `62...` dan memiliki unique constraint. Nilai ini business identifier, bukan primary key atau kredensial.
- Provider: adapter kelak memakai nilai E.164 `+62...`.
- UUID user tetap stabil ketika nomor berubah melalui flow terverifikasi yang belum diimplementasikan.
- Nomor asing, fixed-line, invalid, extension, dan karakter lain ditolak. Validasi yang sama tetap wajib dijalankan server-side sebelum write.

## Session client

Browser client memakai publishable key, PKCE, persisted session, automatic token refresh, dan callback detection dari SDK Supabase. Service-role key tidak pernah masuk bundle. Logout tersedia jika browser sudah memiliki sesi valid. Halaman ini tidak membuktikan delivery OTP dan belum membuat row `public.users`/`profiles`.

## Verifikasi

```sh
npm run test:phone
npm run build
npm run test:account
```

Browser test menjalankan desktop dan viewport 360 px, memastikan tiga variasi format menghasilkan identitas sama, nomor asing ditolak, tidak ada request `/auth/v1/otp`, tidak overflow, dan audit Axe tidak menemukan violation otomatis.
