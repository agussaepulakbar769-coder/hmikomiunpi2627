# HMI UNPI — PRODUCTION CLOUD ARCHITECTURE

This release keeps the existing website as the base and prepares the project for
persistent cloud data/storage.

TARGET:
Website -> secure server/API -> Supabase PostgreSQL + Supabase Storage

PERSISTENT DATA:
- kader
- pendaftar/penerimaan
- berita
- galeri/albums/media
- agenda
- struktur + periode
- materi
- pengumuman
- profil/sejarah/kontak
- admin users/roles
- audit logs
- settings

PERSISTENT FILES:
- news images
- gallery images
- background/hero images
- structure/alumni images
- approved public documents

FIXED BRAND:
- official logo remains embedded/fixed and is not an ordinary CMS upload.

SECURITY:
- Service-role credentials must stay server-side.
- Never put SUPABASE_SERVICE_ROLE_KEY in browser JavaScript.
- Every admin mutation must be authorized server-side.
- Validate upload type, signature, size and dimensions.
- Use parameterized queries / Supabase client APIs.
- Use secure HttpOnly/SameSite cookies for admin sessions.
- Add CSRF protection where cookie-authenticated writes are used.
- Rate-limit login and sensitive endpoints.
- Enable HTTPS and production security headers.

IMPORTANT:
This ZIP is an architecture-ready production base. A real Supabase project
must be connected before production. Do not claim cloud persistence until the
connection and CRUD/upload/redeploy tests pass.

MANDATORY TEST:
1. Create news -> reload -> still exists.
2. Upload image -> reload -> still exists.
3. Create kader -> restart server -> still exists.
4. Login -> logout -> login again.
5. Permission test for each admin role.
6. Delete/edit tests.
7. Backup/restore test.
8. Redeploy test: data and media remain available.
