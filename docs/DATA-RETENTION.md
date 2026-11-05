# Prosedur retensi dan penghapusan data

Status: prosedur operasional awal untuk T20; jadwal retensi final menunggu validasi kebutuhan bisnis dan kewajiban yang berlaku.

## Prinsip

- Jangan menghapus receipt, refund, atau ledger finansial dari runtime. Koreksi dilakukan dengan entry kompensasi; audit/history yang append-only dipertahankan.
- Data guest dan sesi/token hanya dipakai untuk booking yang diminta. Token mentah tidak disimpan; sesi yang kedaluwarsa atau dicabut dapat dibersihkan setelah kebutuhan recovery/insiden berakhir.
- Bukti pembayaran dan object privat mengikuti lifecycle staging/attachment. Hapus staging/orphan yang kedaluwarsa melalui worker cleanup terkontrol; bukti terpasang jangan dihapus sebelum keputusan retensi dan kebutuhan sengketa ditinjau.
- Foto aktivitas aktif mengikuti visibility activity dan dipertahankan sampai pemilik menghapusnya atau moderator menghapusnya. Penghapusan activity/foto segera mencabut penerbitan URL baru; signed URL yang sudah diterbitkan berakhir paling lambat 120 detik. Object yang dihapus masuk cleanup worker; laporan dan catatan moderasi dipertahankan sampai jadwal retensi final/legal hold disetujui.
- Log operasional tidak boleh memuat nomor penuh, OAuth code, token booking, credential, atau isi bukti. Batasi akses log dan gunakan request/event ID untuk investigasi.

## Permintaan penghapusan akun

1. Verifikasi pemohon melalui sesi Google yang valid; jangan menerima ID akun dari klien sebagai bukti kepemilikan.
2. Inventarisasi relasi bisnis, event, partisipasi, invoice, ledger, audit, bukti, serta object Storage terkait.
3. Hentikan sesi guest/token aktif dan akses yang tidak lagi diperlukan. Hapus atau anonimisasi data profil/non-finansial yang tidak wajib dipertahankan menggunakan prosedur operator yang ditinjau; jangan mengubah riwayat finansial/audit.
4. Untuk data yang ditahan karena ledger, audit, sengketa, atau kewajiban lain, catat kategori dan alasan penahanan tanpa menyalin PII ke tiket/log. Batasi akses dan tinjau ulang sesuai jadwal yang disetujui.
5. Hapus object privat hanya setelah referensi database dan hold operasional diperiksa; catat hasil secara agregat tanpa path/token sensitif.
6. Verifikasi ulang RLS, pencarian profil publik, sesi/token, dan akses object setelah penghapusan. Simpan bukti penyelesaian yang tidak memuat data pribadi.

## Operasi dan batas

- Cleanup worker lokal menangani orphan staging dan object foto yang dihapus melalui endpoint internal; scheduler hosted belum aktif. Jalankan hanya oleh operator backend terotorisasi setelah versi migration/function cocok.
- Retensi numerik, dasar hukum, dan SLA pemenuhan belum ditetapkan. Product/ops harus menyetujui matriks kategori-data, periode, legal hold, dan proses eskalasi sebelum release MVP.
- Restore backup dapat mengembalikan data yang sebelumnya dihapus. Setelah restore, ulangi penanganan permintaan penghapusan yang masih berlaku sebelum membuka akses aplikasi.
- Jangan gunakan skrip fixture hosted untuk menghapus data pengguna nyata. Fixture cleanup hanya boleh menghapus ID yang tercatat eksplisit pada state pengujian.
