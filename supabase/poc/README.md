# Compatibility fixtures

Fixture ini khusus T02 dan **bukan migration schema bisnis**. SQL memakai namespace `dolend_poc_*` dan bucket/function `dolend-compat-poc`; setup sengaja menolak collision, tidak menimpa fixture yang sudah ada.

## Menjalankan ulang

Jalankan dari root proyek dengan Supabase CLI yang sudah login. Perintah berikut membuat dan menghapus resource sementara hanya pada project Dolend yang dipilih pengguna.

```sh
npm run supabase -- db query --linked --project-ref fpbefabsqryxmnmxufjw --file supabase/poc/setup.sql
POC_PROJECT_REF=fpbefabsqryxmnmxufjw npm run poc:hosted -- prepare
npm run supabase -- functions deploy dolend-compat-poc --project-ref fpbefabsqryxmnmxufjw --use-api
POC_PROJECT_REF=fpbefabsqryxmnmxufjw npm run poc:hosted -- test
POC_PROJECT_REF=fpbefabsqryxmnmxufjw node scripts/poc-storage-check.mjs
POC_PROJECT_REF=fpbefabsqryxmnmxufjw npm run poc:hosted -- cleanup
```

`test` berjalan sekali per prepare: counter dan user deletion mengubah fixture. Setelah kegagalan, periksa laporan, lakukan cleanup, setup/prepare ulang sebelum full test berikutnya. Jangan menghapus state sebelum cleanup selesai; file itu memuat identitas resource yang harus dibersihkan. Selalu jalankan cleanup juga ketika test gagal.

Runner mengambil API keys melalui CLI ke memory; tidak mencetak atau menyimpan project keys. Token/password fixture berada pada `.env.poc-state.json` (0600, gitignored), secret env-file sementara langsung dihapus setelah dikirim. Laporan `docs/poc-*.json` disanitasi. Jangan menyalin state/env ke Git atau chat.

Probe memakai `verify_jwt=false` hanya pada function ini untuk webhook HMAC. Endpoint lain membutuhkan run-token; RPC/upload juga membutuhkan user JWT valid dan RLS. API utama tetap `verify_jwt=true`. Jangan mengaktifkan probe sebagai API produk.

Pure handler tests tanpa hosted fixtures:

```sh
npm run poc:check
npm run poc:test
```
