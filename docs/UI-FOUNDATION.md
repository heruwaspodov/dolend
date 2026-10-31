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
npm run ui -- add dialog
```

Review perubahan source/dependencies dari CLI sebelum digunakan. Setelah menambah dependency, pertahankan versi exact dan package-lock. Pakai semantic token seperti `bg-primary` dan `text-muted-foreground`, hindari mengulang warna literal per komponen. Gunakan label form, focus-visible, dan tap target minimal 44 px untuk aksi utama.

## Status task

Ini menyelesaikan setup UI, bukan seluruh T07. Form event/join/payment, dashboard, states, responsive QA 360 px, keyboard/contrast dan alur autentikasi belum selesai. Gate kompatibilitas T02 dan static Hosting T03 sudah GO; T07 tetap belum selesai untuk alur/form/dashboard dan QA lengkap. Kebutuhan backend tidak berubah akibat instalasi UI.

Referensi resmi:

- https://tailwindcss.com/docs/installation/framework-guides/nextjs
- https://ui.shadcn.com/docs/installation/manual
- https://ui.shadcn.com/docs/cli

## Arahan 31 Oktober 2026

Pengguna memilih clean UI dengan Tailwind dan shadcn/ui. Pertahankan identitas emerald, latar terang, semantic tokens, hierarki tipografi sederhana dan form berlabel. Hindari dekorasi yang tidak membantu alur.
