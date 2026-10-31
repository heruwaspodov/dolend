# Dolend product brief

Dolend adalah social activity network untuk merencanakan, mengikuti, dan membagikan aktivitas bersama. Inspirasi Strava diterapkan pada hubungan sosial dan progres; alur awal Dolend adalah ajakan → rencana → peserta → aktivitas terlaksana.

## Persona dan kebutuhan

- Organizer: menyepakati venue, jadwal, kapasitas, peserta, serta pembayaran tanpa rekap chat manual.
- Member: pengguna berakun yang membuat/mengikuti event dan membawa riwayat aktivitasnya.
- Guest: peserta dengan nomor terverifikasi yang dapat ikut tanpa akun permanen dan mengklaim riwayat setelah verifikasi.

## Terminologi

Event adalah rencana aktivitas. Activity adalah catatan aktivitas pada fase sosial. User adalah identitas bisnis dengan UUID dan nomor Indonesia unique berbentuk 62..., sedangkan profile menghubungkan user tersebut dengan akun Supabase Auth. Member bukan berarti anggota komunitas. Organizer dihitung sebagai peserta hanya jika ikut mendaftar. Status peserta dan status pembayaran dipisahkan.

## Scope

MVP: registered user membuat event; venue/Google Maps, waktu/zona, kapasitas; share WhatsApp; guest/member; prepay/postpay/free; manual transfer, QRIS dinamis dan satu gateway non-QRIS; attendance, refund review, dashboard.

Phase 2: follow friends, communities, feed, photos, privacy/moderation. Phase 3: challenges, achievements, stats, recommendations. GPS tracking, wallet, venue booking, WhatsApp bot, dan split settlement otomatis di luar scope.

## Keputusan

Nama produk, package, UI, dan konfigurasi adalah Dolend. Multi-activity: football, badminton, lari, cycling, hiking, dan aktivitas sosial. Next.js static export di Firebase Hosting; Elysia di Supabase Edge Functions setelah hosted POC; PostgreSQL/Auth/Storage/Cron Supabase. Tidak menggunakan Cloudflare.

## Traceability

PLAN.md adalah sumber kebutuhan yang tersedia. Dokumen rencana terdahulu belum tersedia; isi jawaban chat sumber hanya content reference. Rekonsiliasi task lama tetap terbuka; tidak ada klaim preservasi verbatim. Domain, provider SMS/payment, merchant/settlement, fee, refund, dan retensi perlu keputusan di gate terkait.

## Keputusan revisi MVP — 31 Oktober 2026

Alur baru mengikuti PLAN.md bagian Revisi scope MVP: recruiting dapat dimulai sebelum venue dipesan; status booking terpisah; estimasi iuran mengikuti peserta aktif chargeable sampai organizer mengunci snapshot. Peserta baru setelah lock mendapat tagihan eksplisit tanpa mengubah tagihan lama. MVP menerima QRIS statis, transfer dan tunai langsung ke organizer dengan verifikasi manual, pembayaran parsial dan outstanding setelah event selesai. Gateway/dynamic QRIS/escrow/settlement/refund otomatis keluar scope MVP. Ketentuan gateway dalam catatan lama tidak lagi menjadi release gate MVP manual.
