# Dolend CI/CD

Target: `https://dolend.web.app/` • repository `heruwaspodov/dolend` • workflow `.github/workflows/firebase-hosting.yml`.

Status: **baseline CI/CD frontend selesai**. [Run pertama 40465855465](https://github.com/heruwaspodov/dolend/actions/runs/40465855465) sukses pada commit `4e3dd77`, termasuk autentikasi OIDC, deploy dan SHA live yang cocok. [Bukti mesin](ci-results.json).

## Urutan pipeline

Pull request menjalankan checks tanpa kredensial deploy. Push ke `main` atau workflow_dispatch pada `main` menjalankan checks, lalu deploy jika semuanya sukses. Branch lain tidak boleh deploy. Node LTS 24 dipin melalui `.node-version`, pnpm melalui field `packageManager`, dan dependency melalui `pnpm-lock.yaml`; action pihak ketiga dipin ke commit SHA yang terverifikasi.

Job checks: `pnpm install --frozen-lockfile` → lint → Deno API/probe tests → test schema/RLS/transaksi/restore lokal → normal static build → TypeScript → browser tests landing/demo/account/participation dengan Chromium → stamp release → verifikasi export → upload artefak `out/`.

Job `deploy-api` berjalan setelah checks. Job ini meninjau lalu menerapkan migrasi database yang tertunda, menerbitkan Edge Function `dolend-api` ke Supabase, dan memeriksa endpoint `/health`. Job Hosting berjalan setelah API lulus. Hosting mengambil artefak yang sama, memverifikasi commit dan target, memperoleh kredensial OIDC sementara, lalu menerbitkan `hosting:web` pada project `dolend-apps`/site `dolend`. `/release.json` menunjukkan commit/run/build yang terbit. Job memverifikasi commit live cocok dengan commit workflow. Metadata release memakai Cache-Control no-store.

Run untuk ref yang sama diurutkan agar deploy aktif tidak dipotong run berikutnya. Artefak build disimpan 14 hari; diagnostik browser yang gagal 7 hari. Tidak ada secret di artefak; autentikasi baru dilakukan di job deploy, setelah build/test selesai.

## Autentikasi

Tidak ada service-account JSON key atau Firebase refresh token yang disimpan di GitHub/Git. Workload Identity Federation menerima token GitHub OIDC, lalu mengimpersonasi akun CI dengan kredensial pendek umur. Detail resource non-rahasia: [ci-infrastructure.json](ci-infrastructure.json).

Trust provider dibatasi numeric repository ID, owner ID, `refs/heads/main`, dan workflow_ref yang tepat. Job checks hanya contents:read; id-token:write hanya di job deploy. Akun CI memiliki Hosting Admin, API Keys Viewer dan Service Usage Consumer di project Firebase; tidak diberi role Owner, Firebase Auth Admin, Cloud Functions, atau Supabase. Hosting IAM berada di level project; pemilihan site aplikasi dikunci oleh target/config dan verifikasi artefak, bukan diklaim sebagai IAM tingkat site.

File `gha-creds-*.json` yang dibuat action di runner diabaikan Git dan tidak masuk folder out; action membersihkannya setelah job. Service account CI tidak memiliki user-managed key. Tidak ada credential layanan SMS/payment yang dibuat.

## Dev, preview dan produksi

Dev: lokal. Preview T03: channel terpisah `t03`, dengan data contoh browser saja. Produksi: live site `dolend`, build POC flag false. Preview dan live tidak berbagi state simulator; landing belum memanggil backend. Saat Auth/event bisnis dihubungkan, gunakan project/env Supabase staging terpisah sebelum menguji mutasi, bukan menjalankan pengujian hosted otomatis ke produksi.

CI sengaja hanya menjalankan test database lokal, bukan fixture hosted yang mengubah tabel/Auth. Hosted checks T02/T04 tetap prosedur manual pada project yang dipilih. `test:hosting` memerlukan fixture khusus preview; workflow produksi memakai `test:landing` dan gate static export, sehingga data POC tidak dipublikasikan.

## Backend dan migration ordering

Sebelum push workflow, siapkan dua environment secret di **Settings → Environments → production** pada GitHub.

- `SUPABASE_ACCESS_TOKEN` punya izin deploy Edge Functions pada project Dolend.
- `SUPABASE_DB_URL` adalah URI PostgreSQL dari **Connect → Session pooler → URI** di project Dolend. Isi placeholder dengan password database yang sudah di-encode untuk URL. Gunakan port 5432.

Workflow mencocokkan target database dengan project dari `NEXT_PUBLIC_SUPABASE_URL`. Setelah dry-run lulus, Supabase CLI menerapkan migrasi yang belum tercatat. Seed dan function probe tetap di luar rilis. Buat migrasi additive yang kompatibel dengan API lama yang masih aktif saat migrasi berjalan. Tinjau perubahan schema dan siapkan backup bila rilis memerlukannya.

Simpan kedua kredensial rilis hanya sebagai secret GitHub. Service-role key dan konfigurasi runtime seperti `GEOAPIFY_API_KEY` tetap dikelola di Supabase.

## Rollback dan diagnosis

- Jika checks, migrasi, atau deploy API gagal, job Hosting tidak berjalan. Jika deploy API gagal setelah migrasi lulus, migrasi yang sudah diterapkan tetap tercatat. Jika health check gagal setelah deploy API, periksa log Supabase karena versi API baru mungkin sudah aktif.
- Jika authentication/deploy gagal, lihat job dan resource OIDC yang dirujuk, bukan menambahkan kredensial ke source. Pastikan ref/repository/workflow_ref cocok.
- Jika post-deploy verification gagal, deploy mungkin sudah terjadi; bandingkan `/release.json` dan log rilis Firebase sebelum mengambil tindakan.
- Untuk rollback cepat, gunakan riwayat release Hosting di Firebase Console. Untuk perbaikan permanen, revert kode frontend lewat commit baru dan biarkan checks/deploy berjalan. Database/ledger tidak di-reset atau di-rollback oleh pipeline ini.
- Workflow dapat dijalankan ulang melalui Actions atau `gh workflow run firebase-hosting.yml --ref main`. Rerun membangun dan menguji artefak lagi; upload mendukung overwrite untuk run yang sama.

Firebase CLI 15.34.1 dipin sebagai dev dependency. Audit dependency runtime baseline bersih. Audit penuh saat setup melaporkan 6 advisory moderate pada dependency CLI; tidak ada high/critical setelah upgrade dari CLI lama. Advisory tersebut bukan endpoint server aplikasi dan tidak menjadi alasan memaksa upgrade mayor yang merusak kompatibilitas. Pembaruan CLI/transitif tetap perlu dipantau; job deploy memasang dependency dengan lifecycle scripts dimatikan.

Referensi: [GitHub OIDC Google Auth](https://github.com/google-github-actions/auth), [Google WIF deployment pipelines](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines), [Firebase deploy targets](https://firebase.google.com/docs/cli/targets).

## Rilis manual alur iuran — 31 Oktober 2026

Migration hybrid Google auth dan dynamic manual contributions diterapkan pada Supabase fpbefabsqryxmnmxufjw setelah backup schema/data di luar repository. dolend-api dideploy ke project yang sama. Frontend build normal diterbitkan dengan target hosting:web, project dolend-apps, site dolend, URL https://dolend.web.app. Ini deployment manual workspace; bukan bukti commit baru telah dipush atau pipeline main berjalan.

Verifikasi: lint/build/typecheck, tes API, tes transaksi lokal dan hosted rollback, tes upload QRIS authenticated/private/cross-owner, serta browser desktop/mobile akun dan pembayaran. Laporan hosted ada di manual-finance-hosted-results.json dan manual-storage-hosted-results.json. CORS live diukur 200 dengan origin https://dolend.web.app. QRIS uji adalah fixture gambar; tidak ada uang, gateway, atau pesan yang dikirim.
