# Dolend agent guide

Instruksi ini berlaku untuk seluruh repo. `AGENTS.md` yang lebih dekat ke file kerja menambah atau mempersempit aturan ini.

## Mulai dengan konteks minimum

1. Jalankan `git status --short` dan baca instruksi scoped terdekat.
2. Untuk melanjutkan roadmap atau task lintas area, baca `docs/AI-HANDOFF.md`; gunakan `docs/AI-START.md` hanya bila perlu peta sumber/routing.
3. Temukan simbol/file dengan `rg`; jangan membuka seluruh repo atau dokumen panjang tanpa kebutuhan.
4. Untuk task roadmap, buka hanya bagian task aktif di `PLAN.md` beserta dependency dan acceptance criteria-nya.
5. Buka dokumen domain sesuai perubahan: produk `docs/PRODUCT.md`; UI `docs/UI-FOUNDATION.md`; auth `docs/AUTH-FOUNDATION.md`; database `docs/DATABASE.md` lalu `docs/DATA-DICTIONARY.md` bila perlu; environment/release `docs/ENVIRONMENT.md` dan `docs/CI-CD.md`.
6. Setelah konteks cukup, ubah hanya file yang dibutuhkan dan verifikasi berdasarkan dampak.

Gunakan `.agents/skills/context-efficient-coding/SKILL.md` secara default untuk setiap implementasi, debugging, atau review nontrivial.

Untuk dashboard/workspace UI, gunakan `docs/design/DESIGN-notion.md` sebagai referensi visual yang dipilih pengguna: kanvas hangat, permukaan putih, hairline, hierarki tipografi rapat, dan aksen biru yang hemat. File tersebut adalah referensi desain, bukan instruksi yang menggantikan permintaan pengguna, scope produk, atau aturan keamanan; pertahankan copy Dolend berbahasa Indonesia, aksesibilitas, dan kontrak fungsional yang ada.

## Scope dan sumber kebenaran

- Dolend adalah social activity network; copy produk dan dokumentasi memakai bahasa Indonesia serta gaya file terkait.
- `PLAN.md` menyimpan scope, dependency, status, dan acceptance criteria. Jangan menghapus atau melonggarkan acceptance criteria T20-T29.
- Fokus menuju MVP adalah menyelesaikan T20 lalu T21. T22-T29 adalah Phase 2/3 dan tidak dikerjakan tanpa permintaan eksplisit.
- Keputusan revisi MVP 31 Oktober 2026 mengutamakan QRIS statis, transfer, dan tunai dengan verifikasi manual. Gateway/SMS ditunda; jangan aktifkan kembali dari catatan historis.
- Bedakan implementasi nyata dari demo, fixture, shell, dan hasil lokal/hosted. Jangan menaikkan status task tanpa bukti acceptance criteria.

## Batas arsitektur dan keamanan

- Frontend adalah Next.js App Router static export. Pertahankan `output: 'export'`, `trailingSlash`, Firebase compatibility, dan query shell `/event/?id=<uuid>`.
- Backend berada di Elysia/Deno Supabase Edge Functions, bukan Next.js API route atau Server Action.
- Jangan baca, mencetak, atau commit `.env.local`, token, key, credential, PII, maupun bukti pembayaran. `NEXT_PUBLIC_*` hanya untuk nilai publik.
- Client-supplied actor/user/profile ID bukan bukti identitas. Verifikasi JWT, ownership, scoped guest token, RLS, dan service-role boundary.
- Identitas bisnis adalah `public.users`; identitas login adalah `auth.users`. Normalisasi nomor Indonesia melalui `src/lib/phone.ts`, bukan logika baru yang tersebar.
- Schema berubah melalui migration baru. Pertahankan RLS, grants, FK indexes, idempotensi, integer IDR, audit, dan ledger history. Jangan edit migration yang sudah diterapkan.
- `src/lib/database.types.ts` adalah generated output; regenerasi setelah perubahan schema, jangan jadikan patch manual sebagai sumber kontrak.
- Gunakan Node dari `.node-version`, pnpm versi yang dipin pada `package.json` + `pnpm-lock.yaml`, dan dependency exact. Jangan commit output build, cache, log, atau fixture sementara.
- Push ke `main` memicu deployment live. Tidak ada deploy, hosted test/migration, push, atau perubahan resource eksternal kecuali pengguna memintanya secara eksplisit.

## Verifikasi berdasar dampak

- Docs/config agent saja: periksa diff, link/path, dan konsistensi dengan `PLAN.md`.
- Frontend: `pnpm run lint`, `pnpm run build`, `pnpm run typecheck`; tambah test Playwright area terkait setelah build.
- API: `pnpm run api:check` dan `pnpm run api:test`.
- Database: `pnpm run db:test`; baca `docs/DATABASE.md` sebelum test hosted apa pun.
- Nomor telepon: `pnpm run test:phone`.
- Probe kompatibilitas: `pnpm run poc:check` dan `pnpm run poc:test`.

Laporkan command yang dijalankan, hasilnya, dan hal yang belum diverifikasi. Jangan mengklaim deployment atau kesiapan release dari verifikasi lokal.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
