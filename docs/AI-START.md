# AI start map

Dokumen ini adalah peta stabil untuk agent baru. Status kerja terbaru ada di [AI-HANDOFF.md](AI-HANDOFF.md); acceptance criteria tetap di [PLAN.md](../PLAN.md).

## Fast start

1. Jalankan `git status --short --branch`. Jangan menimpa perubahan yang belum dipahami.
2. Baca root `AGENTS.md`, scoped `AGENTS.md` terdekat, lalu [AI-HANDOFF.md](AI-HANDOFF.md).
3. Buka hanya task aktif di `PLAN.md`: description, deliverables, dependencies, acceptance criteria, dan bagian §9 yang dirujuk.
4. Gunakan `rg -n` untuk menemukan kontrak, implementasi, dan test terdekat. Hindari inventaris repo atau membaca dokumen panjang penuh.
5. Kerjakan satu unit reviewable, jalankan verifikasi sesuai dampak, lalu perbarui handoff bila status/bukti berubah.

## Urutan sumber kebenaran

Jika dokumen berbeda, gunakan urutan berikut:

1. Permintaan pengguna saat ini.
2. Root dan scoped `AGENTS.md` untuk batas kerja.
3. Bagian **Revisi scope MVP — 31 Oktober 2026** di `PLAN.md` untuk keputusan yang menggantikan scope lama.
4. Task aktif dan acceptance criteria di `PLAN.md`.
5. Dokumen domain untuk kontrak rinci.
6. Dokumen hasil/JSON untuk bukti spesifik.
7. `README.md` untuk overview saja; statusnya dapat tertinggal.

Jangan menggabungkan dua klaim konflik secara diam-diam. Ikuti pernyataan yang eksplisit menggantikan aturan lama, pertahankan acceptance criteria, lalu catat konflik sebagai blocker/keputusan terbuka.

## Routing konteks minimum

| Perubahan | Baca | Verifikasi awal |
| --- | --- | --- |
| Scope/status task | task aktif `PLAN.md`, `AI-HANDOFF.md` | diff + konsistensi sumber |
| Frontend/event/account | `src/AGENTS.md`, file fitur, test terdekat; `UI-FOUNDATION.md` bila visual | lint, build, typecheck, suite area |
| Auth/guest token | `AUTH-FOUNDATION.md`, route/helper/test terkait | API negative tests + test flow terkait |
| API/payment/job | `supabase/AGENTS.md`, `MANUAL-PAYMENT-API.md`, handler/test terkait | `api:check`, `api:test` |
| Schema/RLS/RPC | `supabase/AGENTS.md`, `DATABASE.md`, migration/test terkait | `db:test`; hosted hanya bila diminta |
| Retensi/penghapusan | `DATA-RETENTION.md`, bagian T20 | review privacy + bukti yang tersedia |
| Release/pilot | T20/T21, `CI-CD.md`, `ENVIRONMENT.md` | hanya persiapan lokal tanpa otorisasi deploy |

## Arti level bukti

Gunakan label ini agar status tidak dibesar-besarkan:

- **Code inspection:** kontrak terlihat di source, belum dijalankan.
- **Local test:** lulus di mesin lokal/mock/emulator; bukan bukti hosted.
- **Hosted scoped test:** fixture sintetis pada service hosted; bukan production E2E penuh.
- **Pilot:** pengguna nyata/operasional terbatas dengan hasil tercatat.
- **Production:** deployment dan observasi live pada versi/commit yang teridentifikasi.

Status selesai hanya boleh memakai bukti yang diminta acceptance criteria. Hasil lokal tidak boleh dipromosikan menjadi hosted, pilot, atau production.

## Konflik scope yang wajib diketahui

- Revisi MVP memakai QRIS statis, transfer, dan tunai dengan verifikasi manual; gateway/dynamic QRIS/escrow ditunda.
- Bagian historis T21, §9, release gate, dan beberapa overview masih menyebut gateway/merchant. Jangan mengaktifkan gateway atau menghapus kriterianya tanpa keputusan pengguna; tandai konflik ketika menilai readiness.
- T20 adalah gate aktif. T21 belum dimulai. T22-T29 adalah Phase 2/3 dan tetap di luar scope sampai diminta.

## Kontrak handoff

`AI-HANDOFF.md` harus tetap singkat dan mengganti snapshot lama. Isinya hanya:

- task/tujuan aktif;
- bukti terbaru beserta levelnya;
- gap dan keputusan yang membutuhkan pengguna/external state;
- satu next action aman;
- verifikasi terakhir yang relevan.

Jangan menyalin seluruh changelog, log command, acceptance criteria, atau isi dokumen domain ke handoff.
