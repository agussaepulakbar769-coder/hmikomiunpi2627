# Perbaikan Vercel

- `server.js` sekarang export Express app untuk Vercel dan hanya `listen()` saat dijalankan lokal.
- Tidak memakai `vercel.json` dengan runtime versi lama yang dapat memicu error `Function Runtimes must have a valid version`.
- Upload CMS production wajib memakai Supabase Storage; tidak fallback ke disk lokal Vercel.
- Set Environment Variables di Vercel: `NODE_ENV`, `JWT_SECRET`, `ADMIN_USER`, `ADMIN_PASSWORD`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_MEDIA_BUCKET`.

Catatan: file JSON lokal masih dipakai untuk mode localhost. Untuk data CMS yang harus permanen setelah deploy Vercel, data sebaiknya dipindahkan ke tabel Supabase pada tahap berikutnya.
