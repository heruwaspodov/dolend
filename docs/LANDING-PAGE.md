# Landing page Dolend — initial public release

Tanggal: 27 Oktober 2026. Target live: **https://dolend.web.app/**. Firebase project `dolend-apps`, site `dolend`, target `web`.

## Referensi dan implementasi

Sumber visual pengguna: `dolend_landing_page_demo.html`, disalin utuh ke [references/dolend_landing_page_demo.html](references/dolend_landing_page_demo.html). File tersebut diperlakukan sebagai referensi desain, copy, dan perilaku demo; script inline aslinya tidak dieksekusi atau disisipkan ke aplikasi live.

Implementasi memakai React pada Next.js static export, Tailwind CSS v4, komponen shadcn/ui, serta Lucide React. Bagian yang diadaptasi: banner/header sticky, hero dua kolom, kartu event, perbandingan cara lama/baru, kategori kegiatan, simulator, tiga langkah, skenario penggunaan, FAQ, CTA dan footer. Navigasi mobile mendukung buka/tutup, Escape dan perpindahan fokus.

Plus Jakarta Sans Variable di-host bersama bundle dari dependency lokal; lisensi ikut dipublikasikan di `/fonts/plus-jakarta-sans-LICENSE.txt`. Lima foto dari URL yang sudah ada pada HTML disimpan di `public/images/landing/`; sumber/ukuran tercatat pada [references/landing-assets.json](references/landing-assets.json). Runtime tidak memuat Tailwind CDN, skrip Lucide CDN, atau Google Fonts eksternal.

## Simulator yang tersedia

- Pilihan kegiatan mengubah banner dan kategori preview.
- Nama venue/jadwal, biaya integer IDR dan kuota 2–30 memperbarui kartu secara langsung.
- Patungan per orang dibulatkan ke atas. Mode DP memperlihatkan 50% uang muka dan sisa pelunasan dengan jumlah tetap konsisten.
- Status peserta contoh mempengaruhi kuota sesuai skema; jumlah peserta contoh tidak pernah melampaui kapasitas. Mode bayar di lokasi mengisi kuota tanpa menunggu simulasi lunas; biaya nol mengonfirmasi semua contoh.
- Angka kosong/negatif/desimal/tidak valid tidak menghasilkan NaN/Infinity; tautan tidak bisa disalin sampai konfigurasi valid.
- Salin link memakai Clipboard API dengan feedback sukses hanya setelah promise selesai. Bila ditolak, field dipilih untuk penyalinan manual.
- Tautan berbagi memakai domain `dolend.web.app` dan JSON ter-encode dalam fragment `#simulasi?demo=...`. Penerima membuka konfigurasi pada tab baru, dan konfigurasi bertahan setelah refresh. Parser menerima field/type/ukuran yang dibatasi, bukan arbitrary markup/URL.
- Link WhatsApp membuka composer hanya atas klik pengunjung. Tidak ada pesan yang dikirim otomatis.
- FAQ memakai details/summary native, dapat dipakai dengan keyboard.

Semua ini berjalan di browser: tidak membuat event database, menyimpan peserta, memverifikasi nomor, atau menerima uang. DP 50% adalah ilustrasi landing; schema/backend MVP tidak ditambah fitur cicilan pada rilis ini.

## Penyesuaian copy untuk status produk

Banner, simulator, FAQ, dan CTA menjelaskan bahwa ini demo. Klaim jumlah pengguna “400+ komunitas”, “+2k”, dan testimoni yang belum dapat diverifikasi diganti dengan skenario penggunaan. Venue, peserta, harga, serta status di kartu adalah ilustrasi, bukan booking/pembayaran aktif. Link placeholder privacy/terms diganti navigasi ke bagian yang benar-benar tersedia.

Sesuai arahan pengguna, **provider SMS dan payment gateway ditunda**. Tidak ada signup/payment nyata di landing ini. Positioning jangka panjang tetap social activity network untuk merencanakan aktivitas bersama; landing memperkenalkan use case main dan patungan.

## Verifikasi dan release

- Lint, TypeScript dan normal static build lulus.
- Browser suite landing mencakup sembilan skenario pada desktop dan mobile: section/assets, perhitungan/DP, status/kuota, input invalid, kategori/FAQ, salin dan pemulihan link, fallback clipboard, shared payload invalid, serta navigasi.
- Desktop/mobile/tablet diperiksa pada lebar 1440/360/768 px; tidak ada horizontal overflow. Screenshot hero dan simulator diperiksa visual.
- Build live memakai adapter POC event nonaktif dan tidak mengandung `out/__poc`.
- Deploy dilakukan ke live channel site `dolend`, kemudian respons HTTPS, aset lokal, header, shell auth/payment dan browser interaktif diuji kembali.
- Bukti mesin dan jumlah test terakhir: [landing-results.json](landing-results.json).

## Menjalankan dan menerbitkan

```sh
npm ci
npm run build
npm run test:landing
npm run hosting:deploy
HOSTING_BASE_URL=https://dolend.web.app npm run test:landing
```

Firebase CLI harus terautentikasi. Jangan menggunakan `build:preview`/fixture event untuk rilis live. `test:hosting` tetap untuk suite POC T03 dengan fixture khusus; `test:landing` tidak membutuhkan fixture tersebut. Browser default adalah Chrome lokal; Chromium Playwright dapat dipakai melalui `PLAYWRIGHT_CHANNEL=chromium` setelah instalasinya.

Rilis landing pertama dilakukan manual. T06 kemudian mengaktifkan dan membuktikan auto-deploy GitHub Actions melalui OIDC; detail pada [CI-CD.md](CI-CD.md). T07 UI baseline dilengkapi melalui playground `/demo/`; hasilnya pada [UI-RESULTS.md](UI-RESULTS.md). Auth, persistensi event, token undangan dan transaksi nyata tetap task integrasi lanjutan.
