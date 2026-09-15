# HMI Komisariat UNPI — Pendaftaran + Penerimaan

## Yang ditambahkan
- Backend Node.js + Express
- Database SQLite otomatis (`server/hmi.sqlite`)
- Form pendaftaran tersambung ke database
- Upload foto JPG/PNG/WEBP maksimal 5 MB
- Nomor pendaftaran otomatis, contoh `HMI-UNPI-2026-0001`
- Dashboard admin terpadu
- Login admin
- Satu dashboard untuk Penerimaan Kader + Database Kader + Riwayat Ditolak
- Filter dan pencarian pendaftar
- Status Menunggu / Verifikasi / Diterima / Ditolak
- Halaman publik untuk cek hasil penerimaan

## Cara menjalankan
1. Install Node.js LTS.
2. Buka folder project di VS Code.
3. Jalankan:
   `npm install`
4. Jalankan:
   `npm start`
5. Buka:
   `http://localhost:3000/`

Admin:
- `http://localhost:3000/admin.html`
- Username default: `admin`
- Password default: `admin123`

## Penting untuk produksi
Ganti `JWT_SECRET`, `ADMIN_USER`, dan `ADMIN_PASSWORD` melalui environment variable.
Jangan gunakan password default.
Gunakan HTTPS saat online.
Jangan menampilkan NIK, alamat rumah, atau data sensitif di halaman publik.

# PERBAIKAN INSTALL

Versi ini sudah diperbaiki agar **tidak menggunakan `better-sqlite3`**.
Data pendaftar sekarang disimpan di:

`server/data/applicants.json`

Keuntungannya:
- Tidak membutuhkan Python.
- Tidak membutuhkan Visual Studio Build Tools.
- Tidak membutuhkan proses compile native module.
- `npm install` cukup memasang dependency JavaScript biasa.

## Cara menjalankan di Windows

Buka CMD/Terminal pada folder project, lalu jalankan:

```cmd
npm install
npm start
```

Kemudian buka:

`http://localhost:3000/`

Admin:

`http://localhost:3000/admin.html`

Login default:
- Username: `admin`
- Password: `admin123`

## Catatan

Folder `server/data` akan dibuat otomatis dan file `applicants.json` akan dibuat saat server pertama kali dijalankan.

Jangan menghapus `server/data/applicants.json` jika sudah ada data pendaftar.


## DATABASE KADER HMI
Versi ini juga menyediakan database kader terpisah dari data pendaftaran.
- Admin terpadu: `/admin.html`
- `/admin-kader.html` otomatis mengarah ke Dashboard Admin
- Publik: `/kader.html`
- Penyimpanan: `server/data/kader.json`
