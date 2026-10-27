# T07 — UI dasar dan alur mobile

27 Oktober 2026 • **Selesai untuk UI baseline** • Route live: **https://dolend.web.app/demo/**.

## Cakupan

Playground React/Tailwind/shadcn menyediakan alur membuat aktivitas, detail jadwal WIB dan biaya, venue dengan Google Maps, join tamu, roster guest/member, dashboard host, simulasi transfer manual, dan share WhatsApp. Semua interaksi diberi label demo; state hanya berada di memori browser dan hilang saat refresh.

State yang tersedia: empty, ready, loading, error dengan retry, kapasitas penuh, aktivitas berakhir, gratis, belum dibayar, dan lunas simulasi. Payment gateway, QRIS, OTP, token undangan, upload bukti, serta transaksi nyata tetap berada di task integrasi berikutnya.

## Verifikasi

- Static export, TypeScript, dan ESLint lulus.
- Empat browser checks berjalan pada desktop dan viewport 360 px: alur create/join/full/payment/dashboard/error/expired/refresh serta audit aksesibilitas.
- Axe menemukan masalah kontras pada warna primer lama; token utama diperbaiki dari emerald 600 menjadi emerald 700 dan audit WCAG AA kemudian lulus tanpa violation terdeteksi.
- Form memiliki label/fieldset; status memakai live region; loading memakai `aria-busy`; error memakai alert; elemen interaktif dapat menerima fokus keyboard.
- Tidak ada horizontal overflow pada 360 px.
- Link WhatsApp hanya membuka composer setelah klik dan menyatakan bahwa undangan adalah demo.

## Batas

T07 menyelesaikan desain dan perilaku UI baseline. Integrasi Supabase Auth/API, persistensi event, invite token, provider SMS, pembayaran nyata, serta error jaringan dari backend mengikuti T08–T19. Provider SMS dan payment gateway tetap ditunda atas permintaan pengguna.
