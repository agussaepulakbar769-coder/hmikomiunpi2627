HMI KOMISARIAT UNPI - WEBSITE MULTI HALAMAN

BUKA:
1. Buka folder ini di VS Code.
2. Klik index.html.
3. Jalankan menggunakan browser / Live Server.

FILE UTAMA:
index.html              = Beranda
tentang.html            = Tentang Komisariat
berita.html             = Berita Kegiatan
agenda.html             = Agenda Acara
galeri.html             = Galeri
struktur.html           = Struktur Organisasi
kontak.html             = Kontak
sosial.html             = WhatsApp & Instagram
sejarah.html            = Sejarah
kader.html              = Database Kader
materi.html             = 5 Materi Wajib
daftar.html             = Daftar Jadi Kader

MATERI TERPISAH:
materi-sejarah.html
materi-konstitusi.html
materi-ndp.html
materi-mission.html
materi-keislaman.html

ASSET YANG DIPANGGIL:
assets/background.jpg = latar belakang utama
assets/logo.png       = logo kecil pojok kanan atas
assets/kegiatan-1.jpg s/d kegiatan-3.jpg
assets/galeri-1.jpg s/d galeri-6.jpg
assets/ketua.jpg, sekretaris.jpg, bendahara.jpg, pengurus.jpg, kader.jpg

PENTING:
File gambar di atas adalah nama file yang harus kamu masukkan sendiri ke folder assets.
Logo sebaiknya PNG transparan agar tidak terlihat kotak putih. CSS sudah memanggilnya otomatis.

DATABASE KADER:
Saat ini masih DATA CONTOH di script.js. Belum menjadi database online.
Tahap berikutnya bisa dibuat:
- login admin
- tambah/edit/hapus kader
- pencarian
- filter angkatan/status
- statistik
- database online
- keamanan akses admin

JANGAN memasukkan NIK, alamat rumah, nomor identitas, atau data sensitif ke halaman publik.


DATABASE KADER - VERSI ADMIN

Database kader sekarang dapat dikelola dari website tanpa mengubah script.js.
Jalankan:
  npm install
  npm start
Buka:
  http://localhost:3000/kader.html
Untuk admin:
  http://localhost:3000/admin-kader.html
Login menggunakan akun admin yang sama dengan admin.html.

Data kader disimpan otomatis di:
  server/data/kader.json

Fitur:
- tambah kader
- edit kader
- hapus kader
- cari kader
- filter angkatan
- filter status
- statistik otomatis
- halaman publik hanya menampilkan data yang tidak sensitif

Catatan: akun default pada project lama adalah admin / admin123. Ganti untuk penggunaan online.
