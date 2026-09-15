# Deploy HMI UNPI ke Vercel + Supabase

## 1. Supabase Database
Buka Supabase > SQL Editor, lalu jalankan `supabase_schema.sql`.

## 2. Storage
Buat bucket Storage bernama `kader-poto` dan jadikan **Public**. Upload foto aplikasi/CMS dilakukan oleh server memakai Service Role, sehingga policy upload publik tidak diperlukan.

## 3. Vercel Environment Variables
Set pada Production (dan Preview jika diperlukan):
- `NODE_ENV=production`
- `JWT_SECRET` = secret acak panjang
- `ADMIN_USER`
- `ADMIN_PASSWORD`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_MEDIA_BUCKET=kader-poto`

**Jangan pernah memasukkan `SUPABASE_SERVICE_ROLE_KEY` ke HTML, JS browser, GitHub, atau variable `NEXT_PUBLIC_*`.**

## 4. Deploy
Project memiliki `api/index.js` sebagai entry point Express. Tidak ada `vercel.json` dengan runtime versi lama, sehingga error `Function Runtimes must have a valid version` tidak dipakai lagi.

## 5. Data lama
Untuk memindahkan JSON localhost ke Supabase, setelah env tersedia jalankan:
`node scripts/migrate-local-to-supabase.js`

Catatan: file media lama yang URL-nya masih `/uploads/...` perlu diupload ulang ke Storage agar permanen di Vercel.
