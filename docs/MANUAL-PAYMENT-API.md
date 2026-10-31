# API iuran manual

Prefix `/dolend-api/v1`. Organizer wajib JWT Google terverifikasi. Guest memakai `x-booking-token`; UUID tagihan tidak memberi akses. Semua body menolak field tambahan.

| Endpoint | Fungsi |
| --- | --- |
| POST /events | Buat recruiting dynamic dengan workspace_id, activity_type_id, title, starts_at, ends_at, registration_closes_at, timezone, capacity, estimated_total_cost, payment_timing; venue_snapshot opsional |
| GET /events/:id | DTO publik tanpa kontak, rekening, atau bukti |
| PATCH /events/:id/planning | Ubah estimasi, status booking, confirmed/completed |
| POST /events/:id/join | Member/organizer ikut dengan user dari sesi |
| POST /events/:id/participants | Organizer menambah guest (display_name, whatsapp); simpan/distribusikan token booking secara privat |
| GET /events/:id/roster | Roster privat dan estimasi; charge ID untuk tautan pembayaran |
| POST /events/:id/contributions/lock | Snapshot tagihan peserta aktif chargeable; retry aman |
| POST /participants/:id/charge | Tetapkan amount eksplisit untuk late joiner; snapshot lama immutable |
| POST /participants/:id/cancel | policy retain/waive, reason, idempotency_key; setelah lock hanya organizer |
| GET/POST /payment-settings | List/tambah type static_qris/bank_transfer/cash, recipient_name, storage_path atau bank_details |
| PATCH /payment-settings/:id | is_active; hanya pemilik metode |
| POST /payment-settings/qris-image | Body file PNG/JPG mentah, maksimal 2 MB; menghasilkan storage_path |
| POST /events/:id/payment-methods | method_id dan enabled; metode milik organizer |
| GET /charges/:id | Tagihan scoped, balance, laporan dan metode aktif beserta signed download URL |
| POST /charges/:id/proof | File PNG/JPG mentah, opsional; akses scoped |
| POST /charges/:id/payments | method_id, amount, idempotency_key, proof_storage_path opsional; pending_verification |
| GET /events/:id/payment-reviews | Queue privat organizer, bukti signed URL |
| POST /payments/:id/review | decision verified/rejected dan reason; receipt idempotent |
| POST /charges/:id/adjustments | type refund/adjustment, amount, reason, idempotency_key; refund dibatasi receipt |

Halaman akun menyediakan pengaturan metode per event, review lewat pilihan event, dan pencatatan tunai. Halaman `/payment/?charge=<uuid>#booking=<token>` untuk guest; member memakai sesi Google. Guest menemukan tagihan sesudah lock dengan membuka ulang tautan booking. Dashboard create/manage lengkap tetap task UI terpisah; jangan menyatakan semua R05 selesai.

Cash dicatat organizer lewat form penerimaan tunai, memakai endpoint laporan lalu review. Refund endpoint adalah pencatatan refund manual yang telah dilakukan, bukan instruksi transfer otomatis. Pembersihan orphan upload, rate limit upload/report, pengujian concurrency hosted, dan drill restore produksi masih gate hardening sebelum release MVP penuh.
