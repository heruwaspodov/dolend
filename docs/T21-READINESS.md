# T21 — Checklist kesiapan pilot dan release

Status: **belum siap pilot atau release; tidak ada pilot/release yang dinyatakan lulus.** Checklist ini merangkum bukti yang tersedia dan gap untuk T21. Kriteria penerimaan sumber tetap seperti tertulis di [PLAN.md](../PLAN.md#t21--pilot-dan-release-mvp); dokumen ini tidak mengganti atau melonggarkannya.

## Gate sebelum pilot

| Gate | Bukti/status saat ini | Status |
| --- | --- | --- |
| T20 selesai | PLAN.md masih mencatat backup restore terisolasi, E2E hosted, audit keamanan terpadu, dan keputusan retensi sebagai gap | Belum lulus |
| Google OAuth production | OAuth nyata pernah diuji pada localhost/Firebase, tetapi provider masih testing dan dibatasi test user menurut [README.md](../README.md) dan [AUTH-FOUNDATION.md](AUTH-FOUNDATION.md) | Belum siap production |
| Merchant/payment readiness T05 | T05 ditunda atas permintaan pengguna; onboarding/approval merchant dan provider tidak dibuktikan | Belum tersedia |
| Scope metode pembayaran | Keputusan revisi MVP 31 Oktober menerima QRIS statis, transfer, dan tunai langsung ke organizer dengan verifikasi manual; gateway, dynamic QRIS, escrow, settlement/refund otomatis dikeluarkan dari MVP ([PRODUCT.md](PRODUCT.md)) | Konflik dengan acceptance historis T21; perlu keputusan scope sebelum menyatakan lulus |

## Acceptance criteria T21

| Kriteria PLAN.md | Bukti yang tersedia | Status |
| --- | --- | --- |
| Minimal 3 event pilot mencakup free/prepay/postpay dan guest/member | Tidak ada laporan pilot atau tiga event pilot yang tercatat | Belum diverifikasi |
| Transfer manual, QRIS, dan satu metode gateway non-QRIS terbukti | Hosted/local payment fixtures bukan transaksi pilot; T05 gateway ditunda. Produk revisi mengarah ke transfer, QRIS statis, dan tunai manual | Belum lulus; konflik scope gateway perlu diselesaikan |
| Settlement dan refund diverifikasi dengan nominal uji | Tidak ada bukti settlement/refund pilot atau rekonsiliasi nominal uji | Belum diverifikasi |
| Tidak ada selisih ledger yang tidak terjelaskan | Hosted tests menguji invariant dan idempotency, tetapi belum ada rekonsiliasi pilot | Belum diverifikasi |
| Organizer menyelesaikan alur tanpa bantuan teknis | Belum ada hasil observasi pilot | Belum diverifikasi |
| Production rollback rehearsal selesai | Belum ada catatan rehearsal | Belum diverifikasi |

## Deliverables

- [ ] Laporan pilot dengan hasil tiga event, peserta guest/member, metode pembayaran, rekonsiliasi, refund, dan masalah yang ditemukan.
- [ ] Release checklist yang menunjukkan T20/T21 gates, konfigurasi OAuth, merchant/payment readiness, data protection, dan dukungan.
- [ ] Runbook deployment dan rollback frontend/API dengan hasil rehearsal.
- [ ] Owner support, jalur eskalasi, dan monitoring produksi yang disepakati.

Tidak ada owner, tanggal, merchant, nominal, atau hasil pilot yang ditetapkan di sini karena belum tersedia sebagai bukti/keputusan.

## Persiapan paralel yang tidak memerlukan pilot

- Siapkan draft release checklist, rollback runbook, monitoring signals, dan support/escalation flow.
- Tuntaskan verifikasi T20 dan kumpulkan bukti hosted yang tersisa.
- Rekonsiliasi konflik scope gateway pada T21 dengan keputusan produk sebelum mengubah acceptance criteria atau mengaktifkan provider.

Persiapan tersebut bukan bukti pilot dan tidak mengubah status T21 menjadi lulus. Jangan mengirim pembayaran atau memulai pilot hingga gate, lingkungan, peserta, dan keputusan scope tersedia.
