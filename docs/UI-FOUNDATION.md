# Fondasi UI Dolend

Keputusan pengguna, 27 Oktober 2026: React + Tailwind CSS + shadcn/ui. Next.js App Router tetap digunakan dengan static export ke Firebase Hosting.

## Konfigurasi

- Tailwind CSS v4 melalui `@tailwindcss/postcss` pada `postcss.config.mjs`.
- shadcn/ui: preset Nova, primitive Radix, TypeScript/TSX, alias `@/`, icon Lucide. Konfigurasi CLI: `components.json`.
- Komponen source dimiliki proyek pada `src/components/ui/`: Button, Card, Badge, Input, Label.
- Utility `cn` tersedia melalui `src/lib/utils.ts`; generator saat ini juga mengimpor package `cn` langsung.
- Token CSS di `src/app/globals.css`: warna primary emerald, background slate-50, teks navy sesuai landing referensi pengguna, semantic foreground/border/focus; Plus Jakarta Sans Variable dari dependency lokal, tanpa download font runtime dari Google. Class `.dark` bawaan generator tersedia, tetapi belum ada toggle atau verifikasi dark mode.
- Homepage mengadaptasi HTML pengguna ke React, Tailwind, Button/Card/Input/Label shadcn. CTA membuka simulator. Perhitungan patungan, DP ilustratif, perubahan status peserta, share link yang memulihkan konfigurasi, FAQ dan menu mobile tersedia; SMS/payment nyata belum aktif.

## Menambah komponen

```sh
pnpm run ui -- add dialog
```

Review perubahan source/dependencies dari CLI sebelum digunakan. Setelah menambah dependency, pertahankan versi exact dan `pnpm-lock.yaml`. Pakai semantic token seperti `bg-primary` dan `text-muted-foreground`, hindari mengulang warna literal per komponen. Gunakan label form, focus-visible, dan tap target minimal 44 px untuk aksi utama.

## Status task

Ini menyelesaikan setup UI, bukan seluruh T07. Form event/join/payment, dashboard, states, responsive QA 360 px, keyboard/contrast dan alur autentikasi belum selesai. Gate kompatibilitas T02 dan static Hosting T03 sudah GO; T07 tetap belum selesai untuk alur/form/dashboard dan QA lengkap. Kebutuhan backend tidak berubah akibat instalasi UI.

Referensi resmi:

- https://tailwindcss.com/docs/installation/framework-guides/nextjs
- https://ui.shadcn.com/docs/installation/manual
- https://ui.shadcn.com/docs/cli

## Arahan 31 Oktober 2026

Pengguna memilih clean UI dengan Tailwind dan shadcn/ui. Pertahankan identitas emerald, latar terang, semantic tokens, hierarki tipografi sederhana dan form berlabel. Hindari dekorasi yang tidak membantu alur.

## Arah dashboard terbaru

Pengguna memilih `docs/design/DESIGN-notion.md` sebagai referensi visual untuk dashboard/workspace: kanvas warm-paper, panel putih, hairline, ruang lapang, radius sekitar 12px, hierarki Inter-like yang rapat, dan aksen biru Notion untuk aksi/tautan utama. Arahan ini menggantikan aksen emerald lama hanya pada dashboard/workspace; permukaan lain tetap memakai fondasi sebelumnya sampai diminta. Dokumen desain adalah referensi visual, bukan sumber scope produk atau keamanan. Navigasi workspace harus konsisten di seluruh menu, responsif dengan tombol menu pada layar kecil, dan mempertahankan kontrak rute serta sesi.

Menu navigasi yang belum masuk MVP dikendalikan oleh tabel `public.client_navigation_flags` dan dibaca lewat `src/lib/workspace-navigation-flags.ts`. Baris hanya boleh memakai kunci yang diizinkan migration; akses browser read-only dan publik karena nilainya tidak sensitif. Mengubah `enabled` di database berlaku setelah workspace dimuat ulang tanpa build/deploy. Flag hanya mengatur visibilitas menu, bukan otorisasi; route/API tetap wajib memeriksa sesi dan akses. Menu MVP tetap Ringkasan, My Event, dan Akun; pembuatan event tersedia dari halaman My Event.

### Form

- **Form halaman penuh.** Gunakan `workspaceFormWidth` dari `src/components/organizer/workspace-form.tsx` pada pembungkus halaman. Lebarnya 100% dari area yang tersedia, dengan batas 896 px (56 rem). Pasang batas di pembungkus supaya judul, panel, dan seluruh bagian memakai garis tepi yang sama. Akun dan Buat Event adalah acuan.
- **Form dalam kartu, dialog, sidebar, atau tabel.** Ikuti lebar wadah dengan kontrol yang bisa menyusut. Terapkan tinggi kontrol, label, jarak, dan fokus yang sama. Pembatas lebar halaman penuh dipakai di level halaman.
- **Susunan.** Untuk form workspace dengan beberapa bagian, gunakan `workspaceFormPanel` dan `WorkspaceFormSection`. Judul dan penjelasan ada di kiri pada desktop, field di kanan. Di layar sempit, susun menjadi satu kolom. Letakkan label di atas field serta bantuan dan pesan kesalahan dekat field terkait.
- **Kontrol dan aksi.** Pakai kontrol bersama untuk tinggi, border, dan fokus. Aksi utama workspace memakai aksen biru. Pertahankan target sentuh minimal 44 px untuk aksi utama dan cek tampilan serta urutan fokus di lebar 360 px dan desktop.
- **Header panel.** Letakkan judul, deskripsi, dan aksi utama di dalam panel yang sama dengan isi form atau daftar. Gunakan `WorkspaceFormHeader` untuk halaman workspace. Pakai satu ikon biru yang relevan di samping judul. Garis pemisah di bawah header membentang selebar panel, dengan teks tetap mengikuti jarak dalam panel. Di HP, aksi boleh turun ke bawah judul.
- **Permukaan.** Gunakan panel putih pada kanvas abu hangat di workspace. Simulator memakai panel abu hangat pada halaman putih. Bedakan panel dari kanvas dengan warna permukaan dan garis tipis.
- **Dropdown.** Gunakan `SearchableSelect` dari `src/components/ui/searchable-select.tsx` untuk memilih nilai. Komponen ini memakai React Select dengan pencarian, panah berjarak 12 px dari tepi, fokus biru, dan pilihan aktif yang terlihat.
- **Perilaku dropdown.** Beri label yang terlihat, dukung keyboard, tampilkan pesan saat hasil kosong, dan pertahankan nilai opsi yang sah saat form dikirim. Gunakan tombol atau menu aksi untuk perintah seperti mengarsipkan atau menampilkan kolom.
