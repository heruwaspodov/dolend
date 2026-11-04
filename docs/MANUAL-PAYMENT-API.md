# API iuran manual

Prefix `/dolend-api/v1`. Organizer wajib JWT Google terverifikasi. Guest memakai `x-booking-token`; event unlisted memakai `x-invite-token`; UUID tagihan atau event tidak memberi akses. Semua body menolak field tambahan.

| Endpoint | Fungsi |
| --- | --- |
| GET /organizer/events | Daftar event yang dapat dikelola beserta status planning dan lock |
| GET /organizer/workspaces | Workspace dengan role owner/organizer untuk sesi Google |
| GET /activity-types | Jenis aktivitas aktif untuk form create |
| POST /events | Buat event dynamic (`estimated_total_cost`, `payment_timing`) atau billed (`billing_mode` free/before_event/after_event, `price_amount`, hold/due, rekening aktif). Event billed langsung published dan venue wajib |
| GET /organizer/events/:id | Detail event milik organizer, termasuk status cancelled untuk rekonsiliasi |
| GET /events/:id | DTO peserta tanpa kontak, rekening, bukti, atau kredensial pengelolaan; event unlisted wajib undangan aktif |
| GET/POST /events/:id/invites | Organizer melihat metadata undangan atau membuat token 256-bit yang dikembalikan sekali; hash saja yang disimpan |
| POST /invites/:id/revoke | Organizer event mencabut undangan; operasi aman diulang |
| PATCH /events/:id/planning | Ubah judul/deskripsi, jadwal, kapasitas, timing/estimasi biaya, snapshot/status venue, confirmed/completed; wajib expected_version dan stale edit mengembalikan 409 VERSION_CONFLICT |
| POST /events/:id/join | Member/organizer ikut dengan user dari sesi |
| GET /events/:id/participation | Status partisipasi milik sesi Google atau booking token; tidak menerima user/participant ID dari client |
| POST /events/:id/participation/cancel | Pembatalan mandiri member/guest dengan alasan; setelah lock tagihan selalu dipertahankan untuk review organizer |
| POST /events/:id/participants | Organizer menambah guest (display_name, whatsapp); simpan/distribusikan token booking secara privat |
| POST /participants/:id/guest-token | Organizer merotasi token guest yang hilang; token lama dicabut dan token baru dikembalikan sekali dengan no-store |
| GET /events/:id/roster | Roster privat, saldo per tagihan, dan ringkasan charged/received/refunded/adjustments/outstanding/credit |
| POST /events/:id/contributions/lock | Snapshot tagihan peserta aktif chargeable; retry aman |
| POST /participants/:id/charge | Tetapkan amount eksplisit untuk late joiner; snapshot lama immutable |
| POST /participants/:id/cancel | policy retain/waive, reason, idempotency_key; setelah lock hanya organizer |
| POST /events/:id/cancel | Organizer membatalkan semua peserta aktif dengan policy retain/waive; event, ledger, dan riwayat tetap tersimpan |
| GET/POST /payment-settings | List/tambah type static_qris/bank_transfer/cash, recipient_name, storage_path atau bank_details |
| PATCH /payment-settings/:id | is_active; hanya pemilik metode |
| POST /payment-settings/qris-image | Body file PNG/JPG mentah, maksimal 2 MiB; menghasilkan storage_path |
| POST /events/:id/payment-methods | method_id dan enabled; metode milik organizer |
| GET /charges/:id | Tagihan scoped, balance, laporan dan metode aktif beserta signed download URL |
| GET /invoices/:id | Invoice scoped booking token/JWT, due date, overdue projection, metode snapshot, dan riwayat attempt |
| POST /invoices/:id/attempts | Membuat attempt idempotent untuk metode event; penyelesaian manual/gateway berada di T15/T16 |
| POST /attempts/:id/proof | Upload PNG/JPEG 2 MiB scoped; membuat evidence dan status pending_review secara langsung |
| GET /events/:id/invoice-reviews | Queue evidence invoice khusus organizer event dengan signed URL pendek |
| POST /attempts/:id/review | Approve/reject evidence invoice dengan alasan; receipt idempotent |
| POST /attempts/:id/refunds | Organizer meminta refund manual dengan nominal bounded dan idempotency key |
| POST /refunds/:id/complete | Catat refund selesai hanya bersama reference dan evidence path |
| GET /events/:id/payment-exceptions | Daftar late-payment exception dan seluruh status refund event |
| POST /participants/:id/attendance | Catat `attended`/`no_show` oleh organizer setelah event mulai tanpa mengubah invoice |
| POST /charges/:id/proof | File PNG/JPG mentah, opsional; akses scoped |
| POST /charges/:id/payments | method_id, amount, idempotency_key, proof_storage_path opsional; pending_verification |
| GET /events/:id/payment-reviews | Queue privat organizer, bukti signed URL |
| POST /payments/:id/review | decision verified/rejected dan reason; receipt idempotent |
| POST /charges/:id/adjustments | type refund/adjustment, amount, reason, idempotency_key; refund dibatasi receipt |
| POST /internal/storage/orphans/cleanup | Worker service-only; klaim dan hapus maksimal 100 staging upload expired melalui provider asal |

Halaman akun menyediakan pengaturan metode per event, review lewat pilihan event, dan pencatatan tunai. Halaman `/payment/?charge=<uuid>#booking=<token>` untuk guest; member memakai sesi Google. Guest menemukan tagihan sesudah lock dengan membuka ulang tautan booking. Halaman event menawarkan guest booking bila tidak login, atau join member bila ada sesi Google. Organizer dapat ikut memakai akun yang sama dan baru dihitung ketika menekan ikut. Implementasi lokal `/dashboard/`, `/event/create/`, dan `/event/manage/` mencakup create recruiting, planning, roster tambah/cancel, rotasi tautan guest, lock, late-join charge eksplisit, confirmed/completed, pembatalan event tanpa menghapus ledger, serta ringkasan charged/received/refunded/outstanding.

Cash dicatat organizer lewat form penerimaan tunai, memakai endpoint laporan lalu review. Refund endpoint adalah pencatatan refund manual yang telah dilakukan, bukan instruksi transfer otomatis. Rate limit upload/report, scheduler cleanup T19, dan drill restore produksi masih gate hardening sebelum release MVP penuh.

File privat memakai adapter `supabase` atau `s3`. Supabase adalah default untuk E2E hosted saat ini. Path lama tanpa prefix tetap menunjuk Supabase; referensi `s3:` menunjuk Amazon S3 atau layanan S3-compatible. API tetap memvalidasi owner/guest sebelum upload maupun signed download URL, sehingga browser tidak pernah menerima kredensial provider.

Kontrak file final: PNG/JPEG maksimum 2 MiB, dimensi maksimum 8192 × 8192, dan signed download URL 120 detik. Path hanya berisi UUID profil/tagihan serta UUID object acak—tidak pernah nomor telepon. Upload staging kedaluwarsa setelah 24 jam; attachment QRIS/bukti bersifat sekali pakai dan atomik dengan record bisnis. Registry cleanup memberi lease 15 menit agar worker paralel atau retry tidak berebut object yang sama.
