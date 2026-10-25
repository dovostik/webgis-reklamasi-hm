# Web GIS Reklamasi & Nursery · PT Hamparan Mulya

Aplikasi web (PWA) untuk reklamasi, perawatan, nursery, gudang, dan berita acara.
Berjalan di browser HP, bisa dipasang ke layar utama, dan tetap mencatat saat tanpa sinyal.

- Frontend: HTML + JavaScript murni (tanpa build), Leaflet, jsQR, qrcodejs (sudah disertakan di `lib/`).
- Backend: Supabase (Auth, Postgres + RLS, Storage).
- Hosting: GitHub Pages.

## Pemasangan

1. **Supabase**: buat project, buka *SQL Editor*, jalankan `sql/01_schema.sql`, lalu `02_seed.sql` (file data perusahaan, dikirim terpisah, **jangan di-commit**).
2. **Pengguna**: *Authentication → Users → Add user* (email + kata sandi, centang *Auto confirm*). Pengguna pertama otomatis menjadi **admin**; berikutnya default *viewer*, lalu admin mengatur nama, jabatan, dan peran di menu **Pengguna**.
   - Jabatan dipakai untuk penanda tangan BA: isi persis `SPV Reklamasi`, `Reclamation Suptend`, `KTT PT Hamparan Mulya`.
3. **config.js**: isi `SUPABASE_URL` dan `SUPABASE_ANON_KEY` (kunci *anon / public*). Jangan pernah memasukkan *service_role key*.
4. **GitHub Pages**: *Settings → Pages → Deploy from branch → main / root*.

## Peran

| Peran | Menu |
|---|---|
| admin | semua, persetujuan BA, pengguna, cetak tag |
| spv (SPV Reklamasi) | lihat semua menu, beri nama BASTL, tanggal blok lama, unggah & konfirmasi scan BA, cetak tag |
| admrek (Admin Reklamasi) | lihat semua menu, cetak tag, cetak BA, unggah & konfirmasi scan BA (tanpa beri nama BASTL, tanggal blok lama, simulasi tanggal) |
| owner (GL lapangan) | tugas, peta, scan/inspeksi, penampungan, BA, gudang |
| nursery (GL Nursery) | nursery, kirim bibit, penampungan, gudang, BA |
| crew (akun bersama) | nursery, gudang |
| exdas / bumdes | tugas, peta blok sendiri, scan, terima bibit, penampungan |
| viewer (atasan) | beranda, peta, BA, stok bibit & material (lihat saja) |
