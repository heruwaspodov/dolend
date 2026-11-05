# T29 — Catatan evaluasi rekomendasi

## Aturan ranking v1

- Sumber hanya event publik berstatus `published`, belum dimulai, pendaftaran masih terbuka, dan memiliki kapasitas.
- Akun yang telah bergabung, organizer yang diblokir, event selesai/batal, serta event penuh dikeluarkan sebelum ranking.
- Tanpa personalisasi, fallback mengurutkan event tersedia menurut waktu mulai.
- Personalisasi memerlukan pilihan eksplisit pengguna. Skor v1 memakai kategori (+100), area umum yang sama (+20), hari pilihan (+10), dan event yang juga diikuti akun yang diikuti (+15). Label alasan ikut ditampilkan; identitas peserta tidak dikirim.
- Area hanya berupa kode umum pilihan pengguna yang dicocokkan dengan `venue_snapshot.coarse_region_code`. Ranking tidak meminta atau menyimpan koordinat pengguna, histori lokasi, ataupun lokasi latar belakang.
- Pengguna dapat menonaktifkan semua rekomendasi; operasi itu menghapus pilihan personalisasi dari tabel preferensi.

## Evaluasi fixture lokal sebelum rollout

Evaluasi ranking sintetis lokal dijalankan melalui `supabase/tests/recommendations.sql` pada replay DB lokal. Lima fixture kandidat mencakup satu target yang cocok dengan preferensi, satu kontrol untuk fallback waktu, dan tiga event yang wajib tersaring (penuh, organizer diblokir, batal). Personalisasi menempatkan target di urutan pertama; baseline urutan waktu menempatkan kontrol lebih awal. Hasil fixture: hit@1 1/1 (personalisasi) dibanding 0/1 (baseline), precision@2 1/2, serta 3/3 kandidat terlarang tidak tampil. Ini menguji perilaku ranking pada fixture kecil, bukan kualitas rekomendasi pengguna nyata.

Pemeriksaan privasi lokal memastikan opt-out menghasilkan daftar kosong dan menghapus preferensi, feedback ditolak setelah opt-out, event penuh/batal tidak dapat menerima feedback, serta DTO hanya memuat event dan label alasan tanpa identitas teman, daftar peserta, alamat venue, koordinat, atau preferensi milik akun lain. Ini belum menggantikan evaluasi rollout hosted. Sebelum mengaktifkan rekomendasi hosted, jalankan evaluasi dengan fixture sintetis terisolasi dan uji opt-in yang disetujui memakai metrik berikut:

1. Relevance@10 berdasarkan klik/simpan/join yang dikumpulkan dengan persetujuan, dibanding fallback waktu mulai.
2. Coverage event dan proporsi rekomendasi yang tersedia saat ditampilkan; event penuh, selesai, privat, terlarang, dan organizer terblokir harus selalu nol.
3. Uji opt-out: setelah dimatikan, hasil rekomendasi kosong dan preferensi sensitif terhapus.
4. Audit alasan ranking agar setiap label cocok dengan sinyal yang benar-benar digunakan; jangan menyimpan identitas teman yang menjadi sinyal.
5. Uji API/DTO untuk memastikan tidak ada nomor telepon, alamat venue, koordinat, daftar peserta, atau nilai preferensi milik akun lain yang keluar.

Evaluasi kualitas hosted dan opt-in belum dilakukan; T29 tetap terbuka untuk rollout sampai hasilnya ditinjau. Ranking version harus dinaikkan saat definisi skor berubah.
