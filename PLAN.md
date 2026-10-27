# Dolend — Product & Implementation Plan

Versi: 1.0 • Diperbarui: 27 Oktober 2026 • Status: perencanaan, belum diimplementasikan

## 1. Dasar dokumen dan keputusan produk

Dolend adalah **social activity network yang membantu orang merencanakan, mengikuti, dan membagikan aktivitas bersama**. Inspirasi Strava berada pada hubungan sosial, aktivitas, dan progres; titik masuk Dolend adalah mengubah ajakan menjadi rencana bersama yang jelas: siapa ikut, kapan, di mana, berapa kapasitas, dan bagaimana pembayarannya.

Aktivitas dapat berupa football/futsal, badminton, lari, bersepeda, hiking, atau kegiatan sosial lain. Model data dan copy tidak dibatasi satu olahraga. Identitas produk, UI, project, package, dokumentasi, konfigurasi contoh, dan aset menggunakan nama Dolend. Nama domain dan handle produksi masih perlu dicek ketersediaannya; jangan diasumsikan sudah dimiliki.

**Catatan pemulihan rencana:** workspace tidak memiliki PLAN.md awal. Chat sumber “Sistem Pendaftaran Football” (ID `6adf4d8a-398c-83ec-902c-c9cc0dd5895e`) berhasil dibaca, tetapi respons assistant yang tersedia hanya berupa content reference, tanpa isi rencana atau lampiran. Dokumen ini merekonstruksi rencana dari kebutuhan eksplisit pengguna. Detail/ID task lama belum dapat dibandingkan atau diklaim dipertahankan verbatim. Setelah sumber lama tersedia, lakukan rekonsiliasi tanpa menghapus task atau acceptance criteria yang belum terpetakan. Semua task di bawah memiliki description, deliverables, dependencies, dan acceptance criteria; status default seluruh task adalah **To do**.

### Keputusan tetap

- Frontend: **React melalui Next.js App Router + TypeScript**, **Tailwind CSS v4 + shadcn/ui (Radix/Nova)**, static export di **Firebase Hosting** (project `dolend-apps`, site `dolend`, target `web`). Komponen source berada di `src/components/ui/`; token tema di `src/app/globals.css`.
- Backend: **ElysiaJS di Supabase Edge Functions**, wajib melewati POC kompatibilitas runtime dan deployment.
- Data/platform: **Supabase PostgreSQL, Auth, Storage, Cron**.
- Tidak memakai Cloudflare untuk hosting, Workers, database, storage, cron, DNS proxy, atau CAPTCHA.
- UUID adalah primary key internal. Nomor telepon Indonesia berbentuk digit `62...` adalah unique business identifier orang, bukan primary key dan bukan bukti autentikasi.
- Hanya registered user dengan sesi valid dan nomor terverifikasi boleh membuat event. Peserta bisa member atau guest.
- Pembayaran mendukung sebelum/sesudah event, transfer manual, QRIS, dan metode yang disediakan payment gateway terpilih.

## 2. Roadmap dan batas cakupan

| Tahap | Tujuan | Cakupan wajib | Di luar tahap |
| --- | --- | --- | --- |
| MVP / Phase 1 | Ajakan menjadi aktivitas bersama yang terlaksana | Akun, profil, create/manage event, undangan WhatsApp/link, venue/Maps, jadwal, kapasitas, guest/member, roster, kehadiran, pembayaran, dashboard organizer | Follow, komunitas formal, feed sosial, galeri aktivitas |
| Phase 2 | Membentuk hubungan sosial dan dokumentasi aktivitas | Follow friends, communities, activity feed, photos, privacy dan moderation | Challenges, achievements, rekomendasi personal |
| Phase 3 | Membantu pengguna rutin aktif | Challenges, achievements, stats, recommendations | GPS tracking langsung, route recording, wearable integration kecuali diputuskan terpisah |

MVP harus mencakup semua jalur pembayaran yang disebutkan, bukan berhenti pada transfer manual. Hanya satu gateway diperlukan di MVP; metode gateway diaktifkan sesuai kapabilitas dan persetujuan merchant. Booking venue otomatis, marketplace venue, wallet, escrow, subscription, split settlement otomatis, chat realtime, dan WhatsApp bot bukan scope MVP.

### Pengguna dan alur utama

1. Organizer mendaftar/login, memverifikasi nomor, membuat draft event, mengisi lokasi, waktu, kapasitas, serta kebijakan biaya, lalu publish.
2. Organizer membagikan tautan lewat WhatsApp. WhatsApp dibuka melalui share link; aplikasi tidak mengirim pesan otomatis atau membaca kontak.
3. Penerima membuka halaman event. Member bergabung dengan akun; guest memasukkan nama dan memverifikasi nomor tanpa harus membuat akun permanen.
4. Untuk bayar sebelum event, slot ditahan sementara sampai pembayaran memenuhi kebijakan. Untuk bayar sesudah event, peserta langsung mengonfirmasi slot dan memiliki tagihan sesuai waktu yang ditetapkan.
5. Organizer mengelola roster, pembayaran manual, kehadiran, pembatalan, serta penyelesaian event. Peserta melihat status miliknya melalui akses yang tervalidasi.
6. Guest yang membuat akun di kemudian hari dapat mengklaim riwayat miliknya setelah membuktikan kepemilikan nomor; tidak ada pencocokan otomatis hanya berdasarkan input nomor.

## 3. Aturan bisnis MVP

### 3.1 Identitas, guest, dan autentikasi

- Semua identitas bisnis berada di `public.users`; `profiles` menghubungkan user tersebut dengan `auth.users`. Guest memiliki user dan partisipasi tetapi belum memiliki profile.
- Normalisasi server: `081234567890`, `+6281234567890`, dan `6281234567890` menjadi `6281234567890`. Hapus separator yang diizinkan, validasi dengan library metadata telepon yang dipin versinya; reject nomor non-Indonesia atau tidak valid. Jangan sekadar menerima regex sebagai validasi penuh.
- Simpan `phone_normalized text NOT NULL UNIQUE`, bukan tipe angka. Format tampilan boleh `+62`; database tetap `62...`. Adapter OTP mengubahnya menjadi E.164 `+62...` jika provider memerlukan.
- OTP melalui Supabase Auth dengan provider SMS yang dikonfigurasi; jalur guest memakai challenge OTP server-side tanpa memaksa pembuatan akun permanen. Pemilihan provider dan bukti delivery Indonesia adalah gate M0. Jangan membuat OTP sendiri tanpa expiry, hashing, attempt limit, dan throttling.
- Nomor yang sudah terdaftar tidak boleh dibuat ulang sebagai user baru. Input nomor saja tidak boleh membuka profil/riwayat, mengubah identitas, atau membuat impersonasi. Respons pencarian nomor tidak mengekspos keberadaan akun.
- Perubahan nomor perlu verifikasi ulang dan pemeriksaan collision. UUID tetap sama, event/history tetap terhubung. Recycled number memerlukan proses recovery yang tidak menyerahkan riwayat lama secara otomatis.
- Istilah member berarti pengguna berakun Dolend; pada Phase 2 keanggotaan komunitas memakai entitas terpisah.

### 3.2 Event, venue, waktu, dan undangan

- Event: judul, deskripsi, kategori, organizer, venue, tanggal mulai/selesai, zona waktu IANA, kapasitas, registration deadline, visibilitas, aturan pembatalan, dan kebijakan pembayaran.
- Waktu disimpan sebagai `timestamptz` UTC; zona waktu disimpan terpisah, default `Asia/Jakarta`, dapat mendukung `Asia/Makassar` dan `Asia/Jayapura`. UI selalu memperlihatkan zona waktu.
- Venue: nama, alamat, kota, koordinat opsional, Google Maps URL, place ID opsional, meeting instructions. Snapshot venue pada event menjaga sejarah saat master venue berubah.
- MVP menggunakan nama/alamat manual dan Google Maps URL; Places autocomplete dan peta embedded bukan syarat. Link Maps dibuat dari koordinat/alamat dengan `api=1`; hanya URL HTTPS dan host Maps yang diizinkan, tanpa fetch URL arbitrer dari server.
- Visibilitas MVP: `public` (dapat ditemukan) atau `unlisted` (hanya tautan; bukan jaminan rahasia). Nomor telepon dan bukti bayar tidak pernah menjadi data publik. Token undangan terpisah, acak, dapat dicabut, expiry opsional, disimpan dalam bentuk hash.
- Public UUID bukan izin akses. Token undangan memberi akses terbatas untuk melihat/bergabung, bukan mengubah event atau membaca data pembayaran orang lain.
- Link WhatsApp memuat judul, waktu/zona, venue, biaya, dan canonical event link. Jangan memasukkan nomor peserta atau token akses pengelolaan ke pesan.
- Organizer dihitung ke kapasitas hanya bila juga mendaftar sebagai peserta. MVP satu peserta per nomor per event, tanpa pemesanan beberapa kursi di satu identitas.

### 3.3 Kapasitas dan status

- Lifecycle event: `draft → published → completed`; `draft/published → cancelled`. Event selesai jika waktu berakhir dan organizer/Cron menyelesaikannya. Event dengan tagihan outstanding tetap dapat completed.
- Partisipasi: `held → confirmed → attended | no_show`; `held → expired`; `held/confirmed → cancelled`. Kehadiran diisi organizer setelah event dimulai. Waitlist ditunda kecuali disetujui sebagai penambahan scope.
- Kapasitas terpakai = held yang belum expired + confirmed + attended + no_show. Pembatalan/expiry melepas slot; tidak otomatis menghapus kewajiban/refund.
- Join dilakukan dalam transaksi PostgreSQL dengan lock baris event, pemeriksaan ulang lifecycle/deadline/kapasitas dan unique `(event_id, user_id)`. Seluruh jalur edit kapasitas memakai lock yang sama. Dilarang count-then-insert di client.
- Prepay default hold 15 menit, dapat dikonfigurasi per event. Pengajuan bukti manual mendapat review window terpisah yang eksplisit (default 24 jam, dibatasi waktu event); tidak boleh menahan slot tanpa batas.
- Cron dan callback menggunakan lock dan aturan expiry sama. Pembayaran sukses yang terlambat mencoba konfirmasi hanya jika kursi masih tersedia; jika tidak, masuk exception/refund review, tidak overbook.
- Turun kapasitas di bawah slot terpakai ditolak. Perubahan jadwal/venue setelah publish dicatat, terlihat oleh peserta, dan tersedia teks pemberitahuan untuk dibagikan organizer.

### 3.4 Pembayaran

| Mode event | Slot | Tagihan | Penyelesaian |
| --- | --- | --- | --- |
| `free` | Langsung confirmed | Tidak dibuat | Tanpa pembayaran |
| `before_event` | Held hingga pembayaran terverifikasi | Dibuat saat join | Gateway terverifikasi atau organizer approve transfer manual mengonfirmasi slot |
| `after_event` | Langsung confirmed | Dibuat saat join, due setelah event sesuai konfigurasi | Unpaid/overdue tetap terlihat sampai lunas/waived |

- MVP harga tetap per peserta dalam IDR, integer rupiah, tidak floating point. `price_amount >= 0`; harga dinamis pembagian biaya aktual ditunda. Snapshot harga/fee/mode disimpan pada tagihan; perubahan event tidak menulis ulang tagihan lama.
- `manual_bank_transfer`: organizer menyiapkan instruksi rekening; peserta upload bukti ke private Storage; status pending review, approve/reject oleh organizer event, alasan dan audit wajib. Upload bukti tidak berarti paid.
- `qris`: QRIS dinamis melalui gateway terpilih dengan amount/reference/expiry dan callback. MVP tidak menganggap gambar QRIS statis sebagai pembayaran yang otomatis terverifikasi. Jika QRIS statis kelak didukung, harus memakai alur verifikasi manual yang jelas.
- `gateway`: adapter mendukung daftar metode provider, misalnya virtual account/e-wallet/kartu jika diaktifkan merchant. Tidak menjanjikan semua metode pada semua gateway. Minimal QRIS dan satu metode non-QRIS tersedia untuk release penuh.
- Provider dipilih setelah sandbox, onboarding merchant, settlement destination, kepemilikan merchant, biaya, serta tanggung jawab refund disepakati. Jangan mengasumsikan organizer otomatis bisa menerima settlement langsung.
- Return URL browser hanya menunjukkan hasil sementara. Status paid ditentukan webhook bertanda tangan atau status query server-to-server yang tervalidasi.
- Pisahkan invoice, payment attempt, dan payment ledger. Invoice: `open, paid, void, waived`; attempt: `created, pending, pending_review, succeeded, failed, expired, rejected`; refund: `requested, processing, succeeded, failed`. Overdue dihitung dari due date untuk invoice open.
- Retry menciptakan attempt baru pada invoice yang sama, tanpa menggandakan tagihan. Unique provider event/reference, idempotency key, amount/currency matching, dan lock invoice mencegah callback ganda.
- Pembayaran ganda/terlambat tetap dicatat di ledger sebagai kelebihan bayar/exception; jangan hilangkan transaksi karena invoice sudah paid. Callback out-of-order tidak menurunkan succeeded menjadi pending/failed.
- Event dibatalkan: invoice yang belum dibayar di-void, pembayaran sukses menjadi refund review sesuai policy. Refund manual tercatat dengan bukti/referensi; gateway refund menggunakan API jika tersedia. Pembatalan tidak mengklaim refund sudah terjadi.
- Bukti pembayaran guest memerlukan guest session terverifikasi yang scoped ke partisipasi. Nomor, rekening, bukti, dan raw payload provider dibatasi akses dan masa simpan.

## 4. Arsitektur dan deployment

```text
Browser
 ├─ Next.js exported HTML/CSS/JS → Firebase Hosting
 ├─ Supabase Auth → verified member session
 ├─ Elysia API → Supabase Edge Functions (Deno runtime)
 │   ├─ PostgreSQL transactions / RLS / RPC
 │   ├─ Supabase Storage private buckets
 │   └─ SMS provider + payment gateway API
 └─ WhatsApp share + Google Maps link
Payment gateway → signed webhook Edge Function → ledger / invoice / roster
Supabase Cron → expiry / overdue / reconciliation / cleanup jobs
```

### 4.1 Static export yang benar-benar bisa dipakai

`output: 'export'`, hasil build `out/`, Firebase Hosting public directory `out`. Tidak menggunakan SSR, Server Actions, Next API routes, runtime middleware, atau ISR. Fetch data event/auth dilakukan client-side; data pribadi tidak dimasukkan ke hasil build.

Rute statis utama: `/`, `/login/`, `/auth/callback/`, `/dashboard/`, `/events/`, `/event/`, `/event/create/`, `/event/manage/`, `/join/`, `/payment/`, `/profile/`. Event baru memakai `/event/?id=<uuid>`; undangan memakai parameter token bila perlu. Manage/pay memakai ID pada query dan selalu memvalidasi akses di API. Query dibaca pada client setelah hydration (atau memakai Suspense boundary yang sesuai); build tidak bergantung pada event runtime.

Jangan memakai `/events/[id]` yang mengharuskan semua event diketahui saat build. Firebase clean URLs/trailing slash harus diuji terhadap file hasil ekspor. Tidak ada catch-all rewrite ke file yang belum ada. Deep link, refresh, auth redirect, dan payment return URL diuji pada preview Hosting. `next/image` memakai unoptimized atau loader yang sesuai static hosting.

Konsekuensi: metadata/preview WhatsApp MVP bersifat umum Dolend, teks pesan berisi detail event. Preview spesifik event membutuhkan rancangan tambahan dan tidak dijanjikan di MVP. SEO halaman event dinamis juga terbatas; ini tradeoff yang diterima untuk static export.

### 4.2 API runtime, keamanan, dan jobs

- Elysia menggunakan adapter Web Standard/Deno dan handler Request/Response yang terbukti pada versi dipin. POC harus berjalan di Supabase hosted Edge Functions, bukan hanya Deno lokal. Bun-only API, native addons, dan in-process scheduler dilarang.
- Base API: `https://<project>.supabase.co/functions/v1/dolend-api/v1`. Validasi prefix function, nested routes, OPTIONS, CORS, JSON/multipart, error handler, dan raw body webhook.
- Webhook dapat diisolasi menjadi function `dolend-payments-webhook` dengan gateway JWT enforcement disesuaikan untuk provider eksternal; signature provider tetap wajib. Endpoint lain memvalidasi JWT Supabase dan role di server. Jangan menonaktifkan auth global untuk mempermudah webhook.
- Public read, verified guest session, member, organizer, dan internal job adalah scope berbeda. Authorization bukan hanya pemeriksaan user login.
- Browser hanya memegang public Supabase key. Service-role key, gateway secret, SMS secret, serta job secret disimpan server-side. RLS tetap aktif; service-role melewati RLS sehingga pemeriksaan domain eksplisit wajib. RPC privileged dibatasi execute grant, fixed search_path, dan audit.
- Storage upload menggunakan izin/token terbatas, limit ukuran dan MIME serta verifikasi isi; nama objek acak, tanpa nomor telepon. Signed URL berumur pendek; private bucket untuk bukti bayar. MVP rekomendasi batas bukti 5 MB JPEG/PNG/PDF, diputuskan final dalam T13.
- Cron mengerjakan batch kecil dan idempotent: expiry hold, invoice overdue, payment reconciliation, retry notification outbox, token/file cleanup. Tidak memakai timer dalam worker Elysia. Secret disimpan aman, bukan hardcoded pada SQL job.
- Request ID, structured logs tanpa OTP/token/nomor penuh; rate limit join/OTP/payment berdasarkan actor/IP dengan counter atomik PostgreSQL dan TTL. Monitoring kuota function, DB, Storage, SMS, dan gateway.
- Timeout/retry/backoff eksplisit, circuit breaker operasional untuk provider, serta outbox untuk side effect setelah transaksi committed.

### 4.3 Gate POC Elysia

POC membuktikan deploy, cold/warm requests, route prefix, middleware, CORS, schema validation, JWT verification, Supabase SDK/RPC, upload, signature dari raw body, secrets, error handling, dan build reproducibility. Catat versi Next.js, Elysia, adapter, Deno/runtime, SDK, CLI, plugin, bundle size, serta limit layanan yang berlaku saat implementasi.

Target awal uji: 100 request smoke hosted tanpa 5xx; 20 request konkuren endpoint read/write dummy; laporkan p50/p95 cold dan warm, bukan menyatakan SLA sebelum pengukuran. Gate gagal jika dependency membutuhkan Bun atau fitur runtime yang tidak tersedia. Coba perbaikan adapter/version pin terlebih dahulu. Jika tetap gagal, tulis ADR dan hentikan pekerjaan backend yang bergantung padanya sampai pilihan runtime/framework diputuskan; jangan diam-diam mengganti stack atau pindah provider.

## 5. Schema PostgreSQL

Schema MVP telah diterapkan pada T04 melalui `supabase/migrations/`; tabel di bawah merangkum model. Detail kolom/constraint aktual ada di `docs/DATA-DICTIONARY.md` dan generated contracts `src/lib/database.types.ts`. Phase 2/3 masih target konseptual. Semua tabel bisnis menggunakan `id uuid primary key default gen_random_uuid()` kecuali key relasi ke Auth yang ditetapkan eksplisit. Sertakan `created_at`, `updated_at` bila mutable; seluruh waktu memakai `timestamptz`. Foreign key dan indeks FK wajib ditinjau dalam T04. Hard delete dibatasi pada data berledger.

### 5.1 MVP

| Tabel | Kolom dan constraint penting | Relasi / akses |
| --- | --- | --- |
| `users` | id, display_name, phone_normalized UNIQUE NOT NULL, phone_verified_at, state | Satu orang lintas guest/member; nomor private |
| `profiles` | id UUID PK = auth.users.id, user_id UNIQUE FK public.users, avatar_path, bio, default_timezone | Satu akun Auth per user bisnis; safe public projection terpisah |
| `identity_claims` | user_id, auth_user_id, challenge_id, status, expires_at, resolved_at | Claim/merge hanya setelah proof; audit dan transaksi |
| `guest_sessions` | user_id, scope_event_id FK events, token_hash UNIQUE, scope, expires_at, revoked_at | Akses terbatas; token mentah tidak disimpan |
| `verification_challenges` | phone_normalized, auth_user_id, purpose, provider_ref, secret_hash jika diperlukan, attempts, verified_at, expires_at, consumed_at | Internal; throttle, single-use, cleanup |
| `activity_types` | slug UNIQUE, name, active | Kategori extensible tanpa enum olahraga yang kaku |
| `venues` | created_by, name, address, city, latitude, longitude, maps_url, place_id nullable | Master venue; lokasi tervalidasi |
| `events` | organizer_profile_id FK profiles, activity_type_id, venue_id nullable, venue_snapshot jsonb, title, description, starts_at, ends_at, timezone, capacity, registration_closes_at, visibility, status, payment_mode, price_amount, currency, payment_due_at, hold_minutes, cancellation_policy, version | CHECK ends_at > starts_at, capacity > 0, currency=IDR, amount>=0; hanya organizer mutate |
| `event_invites` | event_id, token_hash UNIQUE, expires_at nullable, revoked_at, created_by | Grant view/join; bukan grant pengelolaan |
| `event_participants` | event_id, user_id, joined_as guest/member, status, hold_expires_at, confirmed_at, attendance_at, cancelled_at, cancellation_reason | UNIQUE(event_id,user_id); history joined_as tidak berubah ketika guest claim |
| `participant_history` | participant_id, from_status, to_status, reason, actor_type, actor_id | Append-only transisi roster |
| `event_payment_methods` | event_id, method_type, provider nullable, provider_method nullable, enabled, instruction_snapshot | Rekening/instruksi private sesuai akses peserta; secret bukan di tabel ini |
| `invoices` | participant_id, invoice_number UNIQUE, amount_due, currency, due_at, status, pricing_snapshot | Satu invoice utama per partisipasi di MVP; UNIQUE(participant_id); waiver perlu alasan |
| `payment_attempts` | invoice_id, payment_method_id FK event_payment_methods, method_type, provider, provider_reference, amount, currency, status, expires_at, review_deadline, idempotency_key, checkout_url, reviewed_by, review_reason | Partial unique(provider,provider_reference) saat non-null; unique scoped idempotency |
| `payment_evidence` | attempt_id, storage_path UNIQUE, mime_type, size_bytes, submitted_by_user_id, reviewed_at | Private Storage; participant/organizer terkait |
| `payment_ledger` | invoice_id, attempt_id, entry_type, amount, currency, source_reference, occurred_at | Append-only penerimaan/refund/penyesuaian; unique source; koreksi lewat entry kompensasi |
| `refunds` | invoice_id, attempt_id, amount, status, reason, provider_reference, evidence_path, approved_by, idempotency_key | Total refund tidak boleh melampaui penerimaan refundable; lock transaksi |
| `webhook_events` | provider, external_event_id, payload_hash, payload_private, processed_at, status, retry_count | UNIQUE(provider,external_event_id); raw payload dibatasi retensi |
| `idempotency_records` | actor_scope, route, key, request_hash, response, expires_at | UNIQUE(actor_scope,route,key); beda payload key sama → 409 |
| `audit_logs` | actor_type, actor_id, action, entity_type, entity_id, redacted_changes, request_id | Append-only; akses admin terbatas |
| `outbox_jobs` | kind, aggregate_id, dedupe_key UNIQUE, payload, status, attempts, next_attempt_at, locked_until | Retry side effect setelah commit |
| `rate_limit_counters` | bucket_key, window_start, count, expires_at | Unique(bucket_key,window_start), atomic upsert |

Indeks: events(status, starts_at), events(organizer_profile_id, starts_at), events(activity_type_id, starts_at), participants(event_id,status,hold_expires_at), participants(user_id,created_at), invoices(status,due_at), attempts(invoice_id,created_at), outbox(status,next_attempt_at), invites(token_hash), webhook(status,created_at). Query public mengembalikan jumlah kursi dan profil aman, tidak melakukan select seluruh row users.

RPC/transaksi domain: `join_event`, `cancel_participation`, `expire_holds`, `approve_manual_payment`, `apply_provider_payment`, `cancel_event`, `record_refund`, `claim_guest_identity`. Seluruh RPC memeriksa actor, transisi, amount, dan lock; public tidak mendapat execute langsung ke RPC privileged.

**RLS matrix:** anonymous hanya read proyeksi event public; invite token diverifikasi API untuk unlisted. Member membaca/mengubah profile miliknya dan partisipasi miliknya. Guest melalui session scope di API. Organizer mengelola event miliknya dan membaca data peserta seperlunya. Invoice/evidence hanya pemilik atau organizer terkait. Ledger/webhook/audit/job tidak menerima write browser. Foto Phase 2 memiliki policy sendiri. Test akses lintas-event/lintas-user wajib.

### 5.2 Phase 2

- `follows(id, follower_profile_id, following_profile_id, status, created_at)`: unique pasangan, no self-follow; privacy request jika akun private.
- `communities(id, owner_profile_id, slug unique, name, description, visibility, avatar_path)`.
- `community_memberships(id, community_id, profile_id, role, status, joined_at)`: unique pasangan; owner/admin/member, invite/request/active/banned.
- `community_invites(id, community_id, token_hash, expires_at, revoked_at)` dan `events.community_id` nullable; hak organizer tetap eksplisit.
- `activities(id, event_id nullable, author_profile_id, kind, caption, visibility, occurred_at, deleted_at)`; aktivitas dibuat dari partisipasi terverifikasi atau posting yang jelas sumbernya.
- `activity_photos(id, activity_id, uploader_profile_id, storage_path, sort_order, moderation_status)`; hapus metadata lokasi sensitif dari foto.
- `feed_items(id, activity_id, actor_profile_id, visibility, published_at)`; awal query-on-read dengan cursor, tanpa fan-out mahal sebelum perlu.
- `blocks`, `reports`, `moderation_actions` untuk keselamatan dan penghapusan; blok berlaku pada feed, profil, follow, dan rekomendasi.

### 5.3 Phase 3

- `challenges(id, creator_profile_id, name, metric, target, starts_at, ends_at, eligibility_rules, visibility)`.
- `challenge_participants(id, challenge_id, profile_id, joined_at)` unique pasangan.
- `achievement_definitions(id, code unique, rules_version, criteria)` dan `user_achievements(id, profile_id, definition_id, rules_version, awarded_at, source_key unique)`.
- `activity_metrics(id, activity_id, profile_id, metric, value, unit, source, verified_at)`; tidak mengarang jarak/durasi dari kehadiran saja.
- `user_stats(id, profile_id, period, metric, value, calculation_version)` unique(profile_id,period,metric,calculation_version), dapat dibangun ulang.
- `recommendation_impressions(id, profile_id, target_type, target_id, reason_code, model_version, shown_at, action)`; preferensi/opt-out dan retensi eksplisit.
- Perhitungan challenge/achievement/stats lewat Cron/outbox idempotent. Completion/cancellation/refund tidak boleh otomatis menghasilkan achievement yang salah.

## 6. Kontrak API

Prefix `/v1` pada function Elysia. JSON response `{ data, meta?: { next_cursor }, request_id }`; error `{ error: { code, message, fields? }, request_id }`. Pagination cursor stabil, default 20/max 100. UUID divalidasi; uang integer IDR; timestamp ISO 8601 dengan offset. Gunakan `Idempotency-Key` pada create/join/payment/refund dan version/If-Match pada edit event. Semua mutasi diotorisasi server.

| Method / endpoint | Akses | Fungsi / aturan |
| --- | --- | --- |
| GET `/health` | Public, minimal | Liveness tanpa membocorkan env |
| GET/PATCH `/me` | Member | Profil sendiri; ganti nomor melalui verifikasi |
| POST `/identity/challenges` | Rate-limited | Kirim challenge, respons generik anti-enumerasi |
| POST `/identity/verify` | Challenge | Single-use OTP; member binding atau guest session scoped |
| POST `/identity/claim` | Member + proof | Klaim user guest atomik; collision → recovery |
| GET `/activity-types` | Public | Kategori aktif |
| GET `/events` | Public/member | Public discovery atau filter organizer=me; tidak bocor unlisted |
| POST `/events` | Verified member | Buat draft; organizer dari JWT, bukan body |
| GET `/events/:id` | Public/invite/organizer | DTO sesuai hak; token undangan via header setelah bootstrap |
| PATCH `/events/:id` | Organizer | Validasi version, kapasitas, snapshot, perubahan published |
| POST `/events/:id/publish` | Organizer | Validasi field wajib, metode pembayaran, deadline |
| POST `/events/:id/cancel` | Organizer | Release seats, void unpaid, refund review paid |
| POST `/events/:id/complete` | Organizer/internal | Hanya setelah ends_at; tidak menghapus piutang |
| POST/DELETE `/events/:id/invites` | Organizer | Create/revoke invite; token plaintext hanya saat dibuat |
| GET/POST `/venues` | Member untuk create | Search master aman; create validasi Maps/location |
| POST `/events/:id/participants` | Member/verified guest | Join atomik, tagihan dan hold konsisten |
| GET `/events/:id/participants` | Organizer | Roster private; public hanya projection terpisah |
| GET `/participants/:id` | Pemilik/organizer | Status roster dan tagihan milik terkait |
| POST `/participants/:id/cancel` | Pemilik/organizer | Policy pembatalan, release seat, refund review |
| PATCH `/participants/:id/attendance` | Organizer | attended/no_show setelah waktu mulai |
| GET `/invoices/:id` | Pemilik/organizer | Tagihan, attempts, outstanding |
| POST `/invoices/:id/payment-attempts` | Pemilik | Amount dari invoice; metode diizinkan event |
| POST `/payment-attempts/:id/upload-url` | Pemilik | Signed upload terbatas untuk bukti manual |
| POST `/payment-attempts/:id/evidence` | Pemilik | Verifikasi objek lalu pending_review |
| POST `/payment-attempts/:id/review` | Organizer | Approve/reject dengan audit; lock invoice/slot |
| POST `/invoices/:id/waive` | Organizer | Alasan wajib, ledger adjustment, bukan fake paid |
| POST `/invoices/:id/refunds` | Organizer | Manual/gateway, batas refundable dan idempotency |
| POST `/webhooks/payments/:provider` | Provider signature | Function terisolasi; dedupe, amount matching, durable record |
| GET `/organizer/summary` | Member | Event, peserta, paid/unpaid/overdue/pending review |
| POST `/internal/jobs/:job` | Internal only | Batch bounded, idempotent, tidak menerima JWT user biasa |

Supabase Auth SDK menangani signup/login/refresh/logout; bukan password custom di API. Token invite pada URL ditukar/digunakan terbatas, dibersihkan dari address bar saat memungkinkan, tidak dicatat log; `Referrer-Policy` membatasi kebocoran token. Akses guest memakai bearer/session aman yang scope dan TTL-nya tervalidasi, bukan localStorage berisi nomor sebagai kredensial.

Kode error utama: 400 validasi, 401 sesi tidak valid, 403 tidak berhak, 404 objek tidak terlihat, 409 event full/duplicate join/version conflict/idempotency mismatch, 410 invite/hold expired, 422 transisi atau payment mismatch, 429 throttle, 502 provider failure, 503 dependency unavailable. Endpoint webhook mengembalikan acknowledgement setelah persist durable sesuai kontrak provider, lalu retry pemrosesan secara aman.

Phase 2 API: follow/unfollow, follow requests, community CRUD/membership/invites, community events, cursor feed, activity CRUD, photo upload, block/report/moderation. Phase 3 API: challenge list/join/progress, achievements, stats per periode, recommendations + feedback/opt-out. OpenAPI dan auth matrix diperbarui tiap phase.

## Progres eksekusi — 27 Oktober 2026

| Task | Status | Bukti / sisa pekerjaan |
| --- | --- | --- |
| T01 | Selesai untuk sumber tersedia | `docs/PRODUCT.md`: brief, persona, glossary, scope, keputusan merek. Rekonsiliasi rencana lama tetap terbuka sampai sumber tersedia. |
| T02 | Selesai — compatibility GO | Hosted Elysia lulus user JWT valid/invalid/deleted identity, 20 RPC write konkuren dengan RLS, private multipart Storage/signed URL, raw-text HMAC webhook + 20 duplicate callbacks, CORS/validation/errors, 100 smoke read, bundle diagnostic, dan instalasi bersih. First request 3698.24 ms; warm p95 396.80 ms. Fixture dibersihkan; bukti `docs/POC-RESULTS.md` dan ADR 0001. |
| T03 | Selesai — static Hosting GO | Project `dolend-apps`, site `dolend`, target `web`, channel `t03`. Event query-route + client fetch, auth/payment return shell, post-build public fixture, clean export tanpa fixture, 12 browser test lokal + 12 hosted (desktop/360 px), headers/direct-link/refresh lulus. Bukti `docs/HOSTING-RESULTS.md`. |
| T04 | Selesai | Delapan migration diterapkan ke Supabase; identitas bisnis kini `public.users/user_id`. Ada 22 tabel ber-RLS, 11 service-only RPC, 0 FK tanpa indeks, dan 7 kategori seed. 38 kelompok test lokal + 13 hosted/regression lulus; fresh replay/snapshot lokal serta cleanup fixture terbukti. Generated types/ERD/dictionary/runbook tersedia; lihat `docs/DATABASE-RESULTS.md`. |
| T05 | Ditunda atas permintaan pengguna | Provider SMS dan payment gateway belum dipilih/diaktifkan. Tidak menghalangi landing page publik dan CI frontend; fitur OTP/payment nyata tetap menunggu keputusan berikutnya. |
| T06 | Selesai — baseline CI/CD frontend | Push main menjalankan checks → verified artifact → OIDC live deploy ke dolend.web.app; run GitHub 40465855465 sukses dan SHA live cocok. Node 24, pinned actions/CLI, tanpa long-lived key, release metadata, isolated preview dan runbook tersedia. API/migration tetap prosedur manual; lihat `docs/CI-CD.md` dan `docs/ci-results.json`. |
| T07 | Sebagian selesai — landing page live | Referensi HTML pengguna diadaptasi ke React/Tailwind/shadcn: hero hijau/navy, kategori, simulator patungan, FAQ, menu mobile. Live di `https://dolend.web.app/`; 18 browser checks lokal + 18 live lulus, lebar 360/768/1440 px diperiksa. Kalkulator/DP ilustratif/status peserta/tautan simulasi diuji; alur event, Auth, dashboard dan pembayaran nyata belum selesai. Bukti `docs/LANDING-PAGE.md`. |

Hasil lokal: lint, Next build, TypeScript, Deno check dan 6 test lulus. HTTP localhost: first request 72.39 ms, warm p50 1.02 ms, p95 4.94 ms; ini bukan ukuran hosted/cold-start atau transaksi DB. Docker daemon belum aktif. Supabase tujuan dipilih pengguna: `fpbefabsqryxmnmxufjw`. Setup UI dikerjakan sesuai keputusan pengguna; compatibility gate T02 sudah GO. T03 juga sudah GO melalui preview Firebase. T05 (SMS/gateway readiness) ditunda atas permintaan pengguna; M0/MVP penuh tetap belum selesai, sementara landing page dan CI frontend dapat dilanjutkan. Verifikasi expired JWT asli/refresh/logout tetap T08/T20; webhook gateway nyata tetap T16.

## 7. Backlog implementasi terperinci

Setiap task adalah pekerjaan yang dapat ditinjau. Dependencies menyebut ID task yang harus memenuhi acceptance criteria terlebih dahulu. Estimasi dan urutan dapat disesuaikan setelah M0; tidak ada task yang dinyatakan selesai hanya karena tercantum dalam dokumen.

### T01 — Fondasi produk dan rebrand Dolend

- **Description:** tetapkan positioning, persona organizer/member/guest, cakupan aktivitas, terminology, serta audit seluruh referensi merek di source yang tersedia.
- **Deliverables:** product brief, glossary, MVP scope, daftar keputusan dan pemetaan task sumber lama bila diperoleh; naming Dolend untuk UI/config/docs/assets.
- **Dependencies:** tidak ada.
- **Acceptance criteria:** copy menjelaskan social activity network dan planning bersama; tidak membatasi football; nama produk konsisten Dolend; task lama yang belum tersedia ditandai belum direkonsiliasi, bukan diklaim sudah dipertahankan.

### T02 — POC ElysiaJS pada Supabase Edge Functions

**Status: Selesai — GO, 27 Oktober 2026.** Hosted runtime, JWT valid/invalid, RPC/RLS, Storage, webhook raw signature, concurrency, CORS/errors, secrets, versi/bundle/latensi, dan clean-source install dibuktikan; fixture dibersihkan. ADR 0001 diterima. Ini gate kompatibilitas, bukan sign-off auth/payment produksi.

- **Description:** buktikan kompatibilitas framework, adapter, dependency, SDK, deployment, dan security boundary pada hosted runtime.
- **Deliverables:** POC deployable, lockfile/version matrix, test route/auth/CORS/upload/webhook, laporan cold/warm/concurrency, ADR go/no-go.
- **Dependencies:** T01.
- **Acceptance criteria:** seluruh pemeriksaan §4.3 lulus, deployment dapat diulang dari clean checkout, tidak ada Bun-only dependency; 100 smoke request tanpa 5xx dan 20 request konkuren terukur; raw body signature dan route prefix terbukti; kegagalan diblokir dengan ADR, tanpa penggantian stack diam-diam.

### T03 — POC static export dan Firebase Hosting

**Status: Selesai — GO, 27 Oktober 2026.** Static export diuji pada preview site `dolend` di project `dolend-apps`. Data contoh publik dibuat setelah build dan dimuat browser melalui query-route; bukan event bisnis nyata. Dua belas browser test lokal dan 12 hosted lulus, termasuk direct open/refresh, missing event, mobile 360 px, serta auth/payment return shells. Auth exchange dan pembayaran nyata tetap task berikutnya.

- **Description:** bangun shell frontend dan buktikan event yang dibuat setelah build tetap dapat dibuka melalui query route.
- **Deliverables:** Next.js export config, Firebase preview, contoh event client fetch, auth callback dan payment return shell.
- **Dependencies:** T01.
- **Acceptance criteria:** clean build menghasilkan out; direct open/refresh `/event/?id=...`, `/auth/callback/`, dan `/payment/` berhasil di preview; unknown event menampilkan not found; tidak membutuhkan runtime Next.js server; tradeoff preview WhatsApp tercatat.

### T04 — Schema, migration, transaksi, dan RLS

**Status: Selesai, 27 Oktober 2026.** Delapan migration resmi diterapkan ke project `fpbefabsqryxmnmxufjw`. Model identitas bisnis telah diseragamkan menjadi `public.users` dengan FK `user_id`; `auth.users` dan `auth_user_id` tetap khusus autentikasi. Migration koreksi kedelapan mempertahankan refund-review pada pembatalan setelah routine refresh. Schema/RLS/grants/indexes, transaksi kapasitas dan billing, fresh replay serta snapshot restore lokal lulus. Uji hosted pasca-rename membuktikan 20 join/5 kursi, duplicate callbacks/refunds, expiry nyata dan RLS; semua fixture dibersihkan. Restore produksi tetap release drill T20/T21, bukan klaim hasil snapshot lokal.

- **Description:** terjemahkan schema MVP ke migration berversi, seed kategori, constraints, indeks, dan RPC atomik.
- **Deliverables:** migrations, ERD/data dictionary, RLS matrix, seed, migration/restore procedure, uji integritas dan authorization.
- **Dependencies:** T02.
- **Acceptance criteria:** database kosong dapat dibangun ulang; UUID PK dan phone unique bekerja; seluruh tabel terpapar memiliki policy/grants yang tepat; user A tidak mengakses data B; join/cancel/payment menggunakan lock yang konsisten; data ledger tidak dapat diubah client.

### T05 — Provider identity dan payment readiness

**Status: Ditunda atas permintaan pengguna, 27 Oktober 2026.** Jangan memilih, onboarding, atau mengaktifkan SMS/payment gateway sampai ada instruksi lanjutan. Cakupan MVP dipertahankan di backlog; landing page saat ini hanya simulasi, tanpa OTP atau transaksi sungguhan.

- **Description:** pilih SMS dan satu gateway, verifikasi delivery Indonesia, QRIS/metode non-QRIS, signature, settlement model, dan refund support.
- **Deliverables:** decision matrix, sandbox credentials server-side, laporan OTP delivery, daftar metode, onboarding checklist merchant dan biaya terverifikasi dari provider.
- **Dependencies:** T01, T02.
- **Acceptance criteria:** OTP terkirim ke nomor Indonesia uji; sandbox QRIS dan satu metode non-QRIS berjalan; raw webhook validasi terbukti; pemilik merchant/settlement dan tanggung jawab refund jelas; produksi tidak diasumsikan siap sebelum approval provider.

### T06 — Repo, lingkungan, dan CI/CD

**Status: Selesai untuk baseline static frontend, 27 Oktober 2026.** Workflow `.github/workflows/firebase-hosting.yml` telah berjalan sukses di GitHub, termasuk checks, OIDC/WIF authentication, deploy hanya site `dolend`, dan verifikasi commit live. Preview tetap channel terpisah; migration/API Supabase mengikuti urutan manual yang didokumentasikan, bukan otomatis dari push frontend. Backend staging terpisah diperlukan sebelum mutasi Auth/event sungguhan mulai diuji.

- **Description:** siapkan struktur frontend/API/shared contracts, env dev/staging/prod, lint/typecheck/build, deployment bertahap.
- **Deliverables:** repository scaffold, env.example tanpa secret, pipeline GitHub Actions pada repo `heruwaspodov/dolend`, preview deployment, migration ordering, rollback runbook. Sesuai permintaan pengguna: auto-deploy frontend ke **https://dolend.web.app/** (project `dolend-apps`, site `dolend`, target `web`) setelah push branch rilis dan seluruh checks lulus.
- **Dependencies:** T02, T03.
- **Acceptance criteria:** clean checkout lulus quality checks; workflow GitHub Actions otomatis build normal (POC fixture flag false) dan deploy live frontend ke `https://dolend.web.app/` setelah push branch rilis (baseline `main`); gagal checks berarti tidak deploy; target hanya `web` pada site `dolend`, bukan default site `dolend-apps`; credential CI disimpan sebagai secret/OIDC, bukan Git atau bundle. API tetap Supabase; staging terisolasi; artefak dapat dipulihkan tanpa rollback migration destruktif. Workflow OIDC dan identitas CI sudah dikonfigurasi serta dibuktikan pada T06; tidak ada private key GitHub secret.

### T07 — UI dasar dan alur mobile

**Tambahan T07:** playground `/demo/` menyediakan form aktivitas, detail venue/Maps, jadwal WIB, kapasitas, biaya sebelum/sesudah, join tamu, roster, dashboard dan simulasi full/expired. Data in-memory hilang saat refresh; bukan integrasi Auth/API/payment. Dua browser checks desktop/mobile memeriksa alur lengkap; CI ikut menjalankannya. T07 tetap sebagian selesai: integrasi nyata, share undangan, loading/error jaringan dan QA aksesibilitas menyeluruh belum selesai.

**Progres:** setup React + Tailwind CSS + shadcn/ui serta landing page referensi pengguna dikerjakan pada 27 Oktober 2026. Referensi `docs/references/dolend_landing_page_demo.html` diadaptasi menjadi komponen React dengan aset/font lokal, simulator/FAQ/menu mobile dan penanda demo. T07 secara keseluruhan belum selesai; form/join/dashboard/payment dan QA alur penuh tetap wajib.

- **Description:** rancang navigasi Dolend, event card/detail/form, join, roster, pembayaran, dan dashboard dengan Bahasa Indonesia.
- **Deliverables:** design tokens/components, responsive screens, empty/loading/error/full/expired states, aksesibilitas dasar.
- **Dependencies:** T01, T03.
- **Acceptance criteria:** alur utama dapat digunakan pada viewport 360 px dan desktop; keyboard/focus/label/contrast diperiksa; waktu/zona/biaya jelas sebelum join; guest/member mudah dipahami; nama dan pesan konsisten Dolend.

### T08 — Supabase Auth, profil, dan identitas nomor

- **Description:** implementasi signup/login/logout/refresh, verified phone, normalisasi, unique identity, recovery, dan profile ownership.
- **Deliverables:** Auth integration, normalization utility, profile API/UI, OTP throttle, nomor-change flow, identity tests.
- **Dependencies:** T04, T05, T06, T07.
- **Acceptance criteria:** variasi 08/+62/62 menuju user yang sama; invalid/non-ID ditolak; UUID tidak berubah saat nomor berubah; user tanpa nomor verified tidak dapat create event; input nomor orang lain tidak memberi akses; expired/reused OTP ditolak; refresh/logout benar di static app.

### T09 — Venue dan Google Maps

- **Description:** input venue, koordinat opsional, alamat, meeting instructions, dan Maps link tervalidasi.
- **Deliverables:** venue API/form, link builder/validator, venue snapshot pada event.
- **Dependencies:** T04, T07, T08.
- **Acceptance criteria:** link membuka Maps untuk venue yang dimaksud pada mobile/desktop; koordinat invalid dan host berbahaya ditolak; perubahan master venue tidak mengubah event lama; tanpa API Maps berbayar tetap dapat dipakai.

### T10 — Create, publish, edit, cancel, complete event

- **Description:** lifecycle event dengan semua field jadwal/kapasitas/venue/pembayaran dan ownership organizer.
- **Deliverables:** event API, create/manage screens, validation, optimistic version checks, audit perubahan.
- **Dependencies:** T08, T09.
- **Acceptance criteria:** hanya member verified membuat event; draft tidak terlihat publik; publish menolak field kurang/deadline invalid; end sesudah start; kapasitas tidak bisa turun di bawah occupancy; non-organizer dilarang edit; edit published tercatat; cancel/complete mengikuti policy.

### T11 — Share WhatsApp dan invitation

- **Description:** buat canonical link dan teks ajakan, copy link, undangan unlisted, revoke dan expiry.
- **Deliverables:** share builder, invite API/UI, public event DTO, invite token handling.
- **Dependencies:** T03, T10.
- **Acceptance criteria:** link event baru terbuka tanpa rebuild; pesan memuat detail benar dan encoded; invite revoked/expired gagal; unlisted tidak muncul dalam discovery; share tidak mengandung kredensial pengelolaan atau data peserta; aplikasi tidak mengirim WhatsApp otomatis.

### T12 — Join guest/member, roster, dan kapasitas

- **Description:** implementasi verified guest session, member join, atomic slot reservation, cancellation, dan guest-to-member claim.
- **Deliverables:** join API/UI, roster API/UI, capacity RPC, guest access/claim, status history.
- **Dependencies:** T04, T08, T10, T11.
- **Acceptance criteria:** 20 join konkuren untuk 5 slot tidak pernah mengonfirmasi/menahan lebih dari 5 kursi; duplicate retry tidak membuat peserta ganda; guest hanya melihat miliknya; member claim memerlukan proof nomor; event closed/full/expired jelas; cancel melepaskan slot sesuai policy; organizer ikut hanya dihitung jika terdaftar.

### T13 — Private Storage dan bukti pembayaran

- **Description:** bangun upload/akses bukti yang scoped ke attempt dan verifikasi isi file.
- **Deliverables:** private bucket policies, signed upload/download, file constraints, orphan cleanup dan retention config.
- **Dependencies:** T04, T06, T12.
- **Acceptance criteria:** peserta lain tidak dapat membaca/upload bukti; file oversize/jenis tidak valid ditolak di server; path tidak memuat nomor; signed URL expired ditolak; object tanpa evidence record dibersihkan sesuai grace period; ukuran/MIME final didokumentasikan.

### T14 — Invoice dan mode bayar sebelum/sesudah event

- **Description:** implementasi harga snapshot, free/prepay/postpay, due date, ledger, attempts, dan idempotency.
- **Deliverables:** billing domain/RPC, invoice API/UI, payment state machine, overdue projection.
- **Dependencies:** T04, T10, T12.
- **Acceptance criteria:** free tidak membuat invoice; prepay menahan kursi; postpay langsung confirmed dengan invoice jatuh tempo sesudah event; uang integer IDR; retry satu aksi tidak menggandakan invoice; perubahan harga tidak mengubah invoice lama; invoice paid tidak diturunkan callback pending.

### T15 — Transfer manual dan review organizer

- **Description:** tampilkan instruksi rekening, submit bukti, review approve/reject, waiver dengan alasan, dan review deadline.
- **Deliverables:** manual payment flow, organizer review queue, audit dan ledger entries.
- **Dependencies:** T13, T14.
- **Acceptance criteria:** upload hanya pending_review; organizer lain tidak bisa approve; double approve hanya satu posting ledger; reject mencatat alasan dan peserta bisa membuat attempt baru; review deadline/slot policy terlihat; approve terlambat tidak overbook.

### T16 — QRIS dan metode payment gateway

- **Description:** integrasikan adapter provider, create checkout/QR, webhook, status query, expiry, retry, dan reconciliation.
- **Deliverables:** gateway adapter, QRIS UI, metode non-QRIS, signed webhook function, dedupe storage, reconciliation report.
- **Dependencies:** T02, T05, T14.
- **Acceptance criteria:** sandbox QRIS dan satu metode non-QRIS berhasil end-to-end; webhook invalid/mismatch ditolak dan dicatat; callback duplicate/out-of-order tidak double credit; return URL tidak menetapkan paid; timeout create payment direkonsiliasi sebelum retry; late success masuk confirm aman atau exception/refund review; production methods sesuai merchant approval.

### T17 — Pembatalan, refund, dan exception pembayaran

- **Description:** tangani event/participant cancellation, unpaid void, paid refund review, overpayment, dan refund manual/gateway.
- **Deliverables:** cancellation/refund UI/API, exception queue, refund evidence/reference, runbook rekonsiliasi.
- **Dependencies:** T15, T16.
- **Acceptance criteria:** pembatalan tidak menghapus ledger; refund tidak melebihi nilai refundable; retry tidak menggandakan refund; paid after hold expiry saat penuh tidak menambah peserta; refund gagal tetap terlihat; manual refund baru succeeded setelah bukti konfirmasi tercatat.

### T18 — Dashboard organizer dan kehadiran

- **Description:** satukan event, occupancy, roster, pending review, paid/unpaid/overdue, dan attendance tanpa mencampur status bayar dengan ikut.
- **Deliverables:** dashboard, filter/search, attendance action, ringkasan penerimaan/refund/outstanding.
- **Dependencies:** T12, T15, T16, T17.
- **Acceptance criteria:** ringkasan cocok dengan invoice/ledger; phone hanya terlihat pihak berhak; attendance hanya event milik organizer dan setelah mulai; no_show tidak otomatis membatalkan invoice; completed tetap menampilkan outstanding postpay.

### T19 — Supabase Cron, outbox, dan operasional

- **Description:** deploy job expiry hold/review, overdue, provider reconciliation, cleanup, dan retry outbox yang bounded.
- **Deliverables:** Cron migrations/config, job endpoint auth, locks/dedupe, monitoring, retry/dead-letter runbook.
- **Dependencies:** T14, T15, T16, T17.
- **Acceptance criteria:** menjalankan job dua kali memberikan hasil domain sama; race callback vs expiry tidak overbook/double ledger; job gagal dapat dilanjutkan; secret tidak ada di SQL/log publik; alert kegagalan tersedia; worker tidak memakai in-process cron.

### T20 — Security, privacy, dan pengujian terpadu

- **Description:** verifikasi trust boundaries, abuse controls, akses file, concurrency, dan seluruh alur MVP di staging.
- **Deliverables:** RLS/API negative tests, payment fixtures, E2E mobile/desktop, risk register terkini, data retention/deletion procedure.
- **Dependencies:** T06–T19.
- **Acceptance criteria:** seluruh skenario §9 lulus; tidak ada temuan kritis/tinggi terbuka; public DTO bebas nomor/bukti/secret; token/OTP tidak muncul log; counter rate limit atomik; dependency/build scan ditinjau; backup restore terbukti pada lingkungan uji.

### T21 — Pilot dan release MVP

- **Description:** jalankan pilot terbatas sebelum release, validasi delivery OTP, real payment minimal, settlement, refund, dan support.
- **Deliverables:** pilot report, release checklist, deployment/rollback runbook, ownership support, production monitoring.
- **Dependencies:** T20; production merchant/SMS readiness T05.
- **Acceptance criteria:** minimal 3 event pilot termasuk free/prepay/postpay dan guest/member; transfer manual, QRIS, serta satu metode gateway non-QRIS terbukti; settlement/refund diverifikasi dengan nominal uji; tidak ada selisih ledger tak terjelaskan; organizer menyelesaikan alur tanpa bantuan teknis; production rollback rehearsal selesai.

### T22 — Follow friends dan privacy sosial (Phase 2)

- **Description:** relasi follow/unfollow, privacy profil, follow request, block/report.
- **Deliverables:** migrations, API/UI relasi sosial, privacy matrix, abuse controls.
- **Dependencies:** T21.
- **Acceptance criteria:** no self/duplicate follow; private profile membutuhkan approval; blocked account tidak muncul pada feed/rekomendasi; nomor tidak searchable publik; pagination dan access tests lulus.

### T23 — Communities dan event komunitas (Phase 2)

- **Description:** komunitas dengan owner/admin/member, membership requests/invites, serta event berafiliasi komunitas.
- **Deliverables:** community schema, role policies, discovery/detail/manage UI, community event linkage.
- **Dependencies:** T22.
- **Acceptance criteria:** role escalation ditolak; owner tidak bisa meninggalkan komunitas tanpa transfer kepemilikan; private community tidak bocor; hanya role berizin membuat event komunitas; kapasitas/billing tetap memakai domain MVP.

### T24 — Activity feed (Phase 2)

- **Description:** tampilkan aktivitas diri/friends/community sesuai visibility dengan cursor dan sumber aktivitas yang jelas.
- **Deliverables:** activity/feed schema, APIs, feed screen, edit/delete/report, dedupe publishing.
- **Dependencies:** T22, T23.
- **Acceptance criteria:** activity private/blocked tidak muncul; cursor tidak mengulang/melewatkan item pada urutan stabil; job retry tidak membuat post ganda; feed kosong/error tertangani; deleted activity hilang dari feed terkait.

### T25 — Photos dan moderation (Phase 2)

- **Description:** upload foto aktivitas dengan consent, visibility inheritance, reporting, delete, dan moderator workflow.
- **Deliverables:** Storage policies, photo UI/API, image processing/metadata cleanup, moderation queue dan retention rules.
- **Dependencies:** T13, T24.
- **Acceptance criteria:** hanya uploader/role berizin mengubah foto; file invalid ditolak; metadata lokasi sensitif dibersihkan; perubahan visibility/delete berlaku pada akses file dan feed; reported content dapat ditangani; akses signed URL lama dibatasi TTL.

### T26 — Challenges (Phase 3)

- **Description:** challenge berbatas waktu dengan metric dan eligibility rules yang dapat diaudit.
- **Deliverables:** challenge schema/API/UI, join/progress calculator, rules/versioning, Cron processing.
- **Dependencies:** T25.
- **Acceptance criteria:** progress berasal dari data sah; cancelled/duplicate activity tidak menggandakan nilai; perhitungan idempotent dan rebuildable; zona waktu serta window challenge konsisten; privacy peserta dihormati.

### T27 — Achievements (Phase 3)

- **Description:** penghargaan berdasarkan aturan terverifikasi, versioned, dan dapat dikoreksi saat data sumber berubah.
- **Deliverables:** definitions, award/revoke jobs, profile badges, audit sumber penghargaan.
- **Dependencies:** T26.
- **Acceptance criteria:** award tidak ganda saat retry; threshold boundaries diuji; perubahan/koreksi aktivitas dapat mencabut/menghitung ulang secara tercatat; rules version tersedia untuk audit.

### T28 — Stats (Phase 3)

- **Description:** statistik konsistensi dan aktivitas dengan definisi metric, periode, sumber data, serta perbedaan self-reported/verified.
- **Deliverables:** metrics catalog, agregasi berversi, stats UI/API, rebuild job.
- **Dependencies:** T26.
- **Acceptance criteria:** jumlah hadir/event/frekuensi cocok sumber; jarak/kalori tidak ditampilkan tanpa data yang mendukung; periode menggunakan zona pengguna; rebuild menghasilkan nilai sama; privacy dan corrections dipropagasikan.

### T29 — Recommendations (Phase 3)

- **Description:** rekomendasi awal berbasis kategori, lokasi kasar, jadwal, teman, dan kapasitas; mulai rule-based sebelum ML.
- **Deliverables:** ranking rules, reason labels, consent/preferences/opt-out, feedback events, evaluasi kualitas.
- **Dependencies:** T22, T23, T28.
- **Acceptance criteria:** event penuh/selesai/terlarang dan blocked account tersaring; alasan rekomendasi bisa dipahami; tidak memerlukan lokasi presisi kontinu; opt-out bekerja; fallback untuk pengguna baru tersedia; evaluasi relevance dan privacy dicatat sebelum rollout.

## 8. Milestones dan urutan eksekusi

Estimasi di bawah adalah rentang perencanaan untuk satu engineer full-stack dengan dukungan desain/QA paruh waktu; bukan janji tanggal. Waktu approval provider tidak termasuk dan dapat menjadi critical path. Tidak mengurangi scope diam-diam untuk mengejar estimasi.

| Milestone | Isi / task | Exit gate | Perkiraan durasi kerja |
| --- | --- | --- | --- |
| M0 — Feasibility | T01–T05 (schema awal boleh berjalan setelah POC) | Hosted Elysia + static Hosting lulus; identity/payment feasibility jelas; schema reviewed | 1–2 minggu |
| M1 — Foundation | T06–T09 | CI/deploy, UI shell, verified identity dan venue berjalan | 1–2 minggu |
| M2 — Planning & participation | T10–T12 | Create → publish → share → guest/member join; concurrency aman | 2 minggu |
| M3 — Payment complete | T13–T17 | Manual + QRIS + non-QRIS gateway; pre/postpay; refund/late callback aman | 2–3 minggu |
| M4 — MVP release | T18–T21 | Dashboard/jobs/security/pilot/settlement lulus | 1–2 minggu |
| M5 — Social network | T22–T25 | Follow/community/feed/photos dan moderation siap | 4–6 minggu setelah MVP |
| M6 — Motivation & discovery | T26–T29 | Challenges/achievements/stats/recommendations terukur | 4–6 minggu setelah Phase 2 |

MVP indikatif 7–11 minggu setelah pekerjaan dimulai, dipengaruhi kapasitas tim, temuan POC, dan provider onboarding. Critical path: T02 → T04/T06 → T08 → T10 → T12 → T14 → T16/T17 → T20 → T21. T05 dapat memblokir auth maupun payment. Phase 2 baru dimulai setelah integritas roster/billing MVP stabil.

## 9. Acceptance matrix dan Definition of Done

| Area | Skenario wajib | Hasil yang diharapkan |
| --- | --- | --- |
| Static hosting | Event baru, direct open, refresh, auth callback, return payment | Berjalan tanpa rebuild/Next server dan tanpa 404 hosting |
| Identity | 08/+62/62, collision, nomor invalid, OTP replay, claim guest | Satu user bisnis per nomor valid; akses selalu membutuhkan proof |
| Authorization | Guest/member/organizer lain mencoba akses event/invoice/evidence | Tidak ada kebocoran atau mutasi lintas owner |
| Concurrency | 20 join untuk 5 kursi, duplicate join, cancel race | Occupancy maksimal 5, invoice/participant tidak ganda |
| Time | WIB/WITA/WIT, UTC boundaries, deadline, end before start | Tampilan konsisten dan validasi server benar |
| Sharing | WhatsApp mobile/desktop, revoked invite, unlisted discovery | Link dan teks benar; izin sesuai visibility |
| Prepay | Hold → success, hold expiry, manual pending review, review expiry | Kursi dan status invoice konsisten dengan aturan |
| Postpay | Join sebelum bayar, completed unpaid, overdue, payment kemudian | Konfirmasi tetap valid dan outstanding terlihat sampai selesai |
| Gateway | Signature palsu, wrong amount/currency, duplicate/out-of-order callback | Ditolak/quarantine atau idempotent; tidak double credit |
| Late payment | Hold expired dan event penuh lalu webhook succeeded | Ledger tercatat, exception/refund review, tanpa overbook |
| Provider timeout | Create attempt timeout setelah provider menerima request | Query/reconcile reference sebelum membuat attempt baru |
| Refund | Cancel paid event, partial/full refund, duplicate retry, failed refund | Ledger benar, batas refund dijaga, failure terlihat |
| Cron | Duplicate job, crash di tengah batch, callback bersamaan expiry | Safe retry dan progres dapat dipulihkan |
| Storage | URL expired, MIME palsu, oversized, orphan, akses lintas user | Ditolak/dibersihkan tanpa mengekspos data |
| Deployment | Clean build/deploy, migration, backup restore, rollback frontend/API | Reproducible, secret aman, data tidak hilang |

**Definition of Done task:** deliverables tersedia dan dapat direview; acceptance criteria dibuktikan; typecheck/lint/build dan test relevan lulus; migration/API/docs berubah bersama; observability/error states tersedia; tidak ada secret/PII di artefak publik; temuan material dicatat. Tidak perlu unit test yang hanya menyalin implementasi, tetapi integritas transaksi, authorization, pembayaran, dan hosted compatibility wajib diuji.

**Release gate MVP:** M0–M4 lulus; production OTP dan merchant approved; QRIS + satu gateway non-QRIS dan transfer manual operasional; data protection/retention/support/refund ownership jelas; tidak ada bug kritis/tinggi; uji restore dan reconciliation selesai. Mode pilot yang membatasi metode harus dilabeli pilot, bukan MVP lengkap.

## 10. Risks, mitigasi, dan keputusan terbuka

| Risiko | Dampak | Mitigasi / owner / gate |
| --- | --- | --- |
| Detail rencana lama tidak tersedia | Task/AC terdahulu mungkin belum tercakup | Product owner + engineer merekonsiliasi sumber lama saat tersedia; pertahankan ID/detail yang ditemukan; catat gap |
| Elysia dependency tidak cocok dengan Supabase runtime | Backend tidak dapat deploy | Engineer: hosted POC T02 sebelum domain implementation; pin adapter; ADR bila no-go |
| Static export dan dynamic route disalahgunakan | Event hasil create tidak bisa dibuka | Engineer: query route shell, deployed refresh test T03/T11; metadata umum diterima |
| SMS Indonesia gagal/biaya abuse | Guest/member tidak bisa join atau biaya melonjak | Engineer/product: delivery POC, throttle, resend cooldown, biaya/limit monitor, recovery policy; M0/M4 |
| Nomor recycled/shared atau input palsu | Account takeover, salah klaim history | Proof kepemilikan, audited change/claim, collision recovery; nomor bukan kredensial; T08 |
| Join/payment/expiry race | Overbooking atau uang tanpa kursi | DB lock, idempotency, durable ledger, late-payment exception; T12/T16/T19 |
| Manual evidence palsu/review lambat | Salah konfirmasi atau slot terkunci | Review organizer, bounded review deadline, audit/reject/retry, pending queue; T15 |
| Merchant approval/QRIS/settlement belum siap | MVP payment tertunda | Product/finance: pilih provider dan model merchant di M0; sandbox bukan bukti approval produksi |
| Callback hilang/duplikat/terlambat | Salah invoice/ledger | Signature, durable webhook inbox, dedupe, reconciliation Cron, exception queue; T16/T19 |
| Kebocoran nomor/bukti/rekening/token | Kerugian privasi dan trust | Engineer: private storage, RLS/DTO tests, masking, signed URL TTL, retention; T20 |
| Edge/DB/storage quota dan cold start | Lambat/gagal, biaya naik; POC first request 3.70 s dibanding warm p95 397 ms | T02 terukur; lanjut loading states, pagination/index, bounded jobs, budget alert dan load test M4; jangan hardcode asumsi tier |
| Dua platform deploy dan CORS/redirect mismatch | Auth/payment callback gagal | Config per lingkungan, allowlist origin, tested redirect allowlist, release checklist T06 |
| Postpay tidak dibayar | Piutang organizer | Due date/outstanding jelas, reminder/outbox internal, waiver/audit; tidak menjanjikan debt collection |
| Feed/photos memperbesar abuse dan biaya | Spam, konten bermasalah, storage membengkak | Block/report/moderation, upload limits, retensi dan privacy sebelum Phase 2 |
| Achievement/rekomendasi memakai data keliru | Trust rendah, manipulasi | Verified source, rules versioning, rebuild/correction, opt-out; Phase 3 gates |

Keputusan terbuka yang harus ditutup pada task terkait: provider SMS dan gateway; identitas merchant/settlement; fee ditanggung siapa; refund/cancellation policy default; final retention bukti/ledger/log sesuai kebutuhan operasi dan kewajiban yang divalidasi saat implementasi; akses nama peserta publik (default hanya count); domain/brand availability; review window manual; budget dan kapasitas tim. Default teknis dalam dokumen adalah baseline implementasi, bukan bukti keputusan komersial/legal telah selesai.

## 11. Metrik keberhasilan dan observability

- Product MVP: event draft→published, share→verified join, join→confirmed, event terlaksana, repeat organizer, repeat participant; bedakan funnel guest/member dan metode pembayaran.
- Operasional: OTP delivery/verification success, payment success/reconciliation lag, manual review time, outstanding postpay, refund turnaround, job failures, API error/latency, occupancy invariant violations.
- Phase 2: accepted follows, active communities, feed participation, photo contributions dan report resolution. Phase 3: challenge completion, repeat activity, stats consistency dan recommendation relevance.
- Instrumentasi memakai event ID/UUID dan agregasi; nomor/OTP/token/bukti tidak dikirim sebagai analytics properties. Baseline pilot menentukan target numerik berikutnya; tidak mengarang target growth sebelum baseline ada.
- Alert langsung untuk overbooking, unmatched payment, ledger mismatch, backlog callback/job, delivery OTP drop, dan kuota mendekati anggaran. Assign owner dan runbook pada M4.

## 12. Referensi teknis

Dokumentasi resmi diperiksa 27 Oktober 2026. Referensi mendukung keputusan arsitektur, tetapi tidak menggantikan hosted POC, version pinning, dan validasi limit tier pada saat implementasi.

- [Next.js static export](https://nextjs.org/docs/app/guides/static-exports): batas fitur server dan build/export; dasar pilihan shell statis dengan client fetch.
- [Firebase Hosting configuration](https://firebase.google.com/docs/hosting/full-config): public directory, clean URLs, headers, dan perilaku hosting.
- [Elysia Deno integration](https://elysiajs.com/integrations/deno): dasar integrasi Web Standard/Deno; kompatibilitas Supabase hosted masih harus dibuktikan pada T02.
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions) dan [runtime limits](https://supabase.com/docs/guides/functions/limits): runtime, security, deployment, serta batas yang harus diukur/dipatuhi.
- [Supabase Cron](https://supabase.com/docs/guides/cron): recurring SQL/function/HTTP jobs; dasar expiry/reconciliation terpusat.
- [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started): format link lintas perangkat dengan parameter `api=1`.

## 13. Paket hasil dan langkah awal

Hasil rencana adalah `PLAN.md` ini. Implementasi aplikasi, POC, deployment, integrasi provider, serta seluruh verifikasi runtime belum dilakukan pada pembaruan dokumen.

Langkah berikutnya: lanjutkan T07 untuk alur UI event/join/dashboard yang tidak membutuhkan provider. T06 baseline auto-deploy GitHub Actions ke `https://dolend.web.app/` sudah aktif dan terbukti. T05 SMS/payment ditunda atas permintaan pengguna; jangan mengaktifkan provider sementara. Referensi HTML landing telah dipakai; DP 50% hanya simulasi front-end dan bukan penambahan fitur installment pada schema MVP. T02/T03 GO dan T04 selesai; Auth/payment/release mengikuti gate masing-masing. Rekonsiliasi rencana lama tetap terbuka jika sumber tersedia.
