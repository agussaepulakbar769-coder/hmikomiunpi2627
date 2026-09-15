# CMS Website HMI UNPI

Login admin → Kelola Website. Konten berita, galeri, agenda, struktur, profil, dan kontak disimpan di `server/data/cms.json` melalui API.

Untuk produksi, gunakan database sungguhan (SQLite/PostgreSQL/MySQL) jika jumlah data membesar; JSON cocok untuk tahap awal/situs kecil dan wajib dibackup.

Logo halaman sudah di-embed ke HTML agar tidak bergantung pada `assets/logo.png`.


## Media Manager
Admin sekarang memiliki Media Manager untuk upload, cari, pakai, dan hapus foto CMS. Foto pendaftar pribadi tidak diekspos ke Media Manager. Media yang masih dipakai konten akan ditolak saat dihapus.


## Update CMS terbaru
- Isi rutin website diarahkan ke Dashboard Admin > Kelola Website.
- Tampilan/layout dan halaman Kontak tidak dikelola dari CMS.
- Menu WA & IG terpisah dihapus dari navigasi.
- Media CMS dapat memakai Supabase Storage bucket `kader-poto` jika `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` diatur.
- Tanpa kredensial Supabase, upload CMS tetap memakai fallback lokal untuk pengujian localhost.
