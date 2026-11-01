# Keputusan Proyek

Sumber: spesifikasi §15.1. Perbarui kolom Status dan Catatan setiap ada keputusan baru; agen wajib membaca file ini sebelum mengerjakan tugas.

| No | Keputusan | Status | Isi / usulan bawaan | Catatan |
|---|---|---|---|---|
| 1 | Cakupan akses role per tim kerja | **Penghambat — belum** | Pengelola Pelatihan dan Viewer dibatasi ke tim kerjanya lewat RLS; Admin dan Pengelola PK lintas tim | Migration awal memakai usulan ini. 31 Okt 2026: pemilik menyetujui usulan ini untuk prototipe data sintetis (F1-05); tetap penghambat untuk data riil |
| 2 | Identitas peserta lintas pelatihan | **Penghambat — belum** | `NO REGISTRASI` per pendaftaran; tidak digabung lintas pelatihan | |
| 3 | Masa simpan data peserta | **Penghambat — belum** | Identitas dianonimkan 12 bulan setelah tahun anggaran berakhir | |
| 4 | Indikator PK dan pemetaan tim | Sebagian selesai | IKSK 1.1 DTA, 2.1 GTA, 3.1 KDD, 3.2 lintas tim (spesifikasi §8.7) | Lengkapi spreadsheet PK dan target antara IKSK 3.2 |
| 5 | Definisi lulus dan "mengikuti" | Sebagian selesai | Per indikator PK | Format sheet GTA/KDD dan `STATUS` saat berjalan belum diverifikasi |
| 6 | Metode login | Selesai | Supabase Auth email + kata sandi, akun manual, MFA ditunda (RR-04) | |
| 7 | Topologi produksi | **Penghambat untuk data riil** | Prototipe Vercel + Supabase Cloud data sintetis; produksi pilihan A (server instansi) | |
| 8 | Akun dan akses (GitHub, Vercel, GCP, Shared Drive) | **Penghambat untuk deploy** | Atas nama instansi | |
| 9 | Provider AI pertama | Bawaan | Gemini, batas biaya bulanan | |
| 10 | Sumber rencana belajar | Bawaan | Diisi Pengelola Pelatihan | |
| 11 | Template laporan per pelatihan | Bawaan | Belum ada; MVP bulanan dan tahunan | |
| 12 | Bentuk mobile | Bawaan | Web responsif (PWA) | |
| 13 | Notifikasi otomatis | Bawaan | Di luar MVP | |
| 14 | Zona waktu dan format | Bawaan | WIB, format Indonesia | |
| 15 | Desain kanvas sebagai acuan UI | Bawaan | Disetujui | |

## Keputusan teknis starter pack

| Tanggal | Keputusan | Alasan |
|---|---|---|
| 2026-10-31 | pnpm `minimumReleaseAge` 14 hari | Mengurangi risiko paket berbahaya yang baru terbit (SH-SUPPLY) |
| 2026-10-31 | Kriteria lulus dan target antara disimpan sebagai data (`pk_indicators`, `pk_indicator_targets`), bukan konstanta | Spesifikasi §8.7 |
| 2026-10-31 | Supabase CLI dipasang sebagai devDependency `supabase@2.121.0` (versi tepat), dijalankan lewat `pnpm db:reset`, `pnpm db:test`, atau `pnpm exec supabase` | Versi sama di lokal dan CI tanpa instalasi global; versi ≥ 14 hari (SH-SUPPLY-01) |
| 2026-10-31 | Layar mobile "Lainnya" (`M-Lainnya.dc.html`) memakai rute `/more` di grup `(dashboard)`; di layar ≥ 768px dialihkan ke `/dashboard` | Desain menampilkannya sebagai layar penuh dengan tab Lainnya aktif; tidak menambah menu web (keputusan pemilik) |
| 2026-10-31 | Tautan "Lupa kata sandi?" pada desain login belum ditampilkan sampai alur reset kata sandi dibuat sebagai tugas terpisah (SH-AUTH-05) | Menghindari tautan mati (keputusan pemilik) |
| 2026-10-31 | Tombol "Keluar" di web ditempatkan di kartu pengguna sidebar; di mobile pada layar Lainnya sesuai `M-Lainnya.dc.html` | Desain web tidak memiliki tombol logout (keputusan pemilik) |
| 2026-10-31 | Login dan logout memakai Server Action, bukan endpoint `/api/v1` | §7.1 tidak memuat endpoint auth; Server Action diizinkan §4.2; cookie sesi tetap HttpOnly karena tidak ada klien Supabase di browser |
| 2026-10-31 | Next.js 16: `src/proxy.ts` menggantikan `middleware.ts`; `scope-map.json` diperbarui | Konvensi Next.js 16 |
| 2026-10-31 | `experimental.turbopackFileSystemCacheForDev: false` dan indikator dev di kanan atas | Next 16.4.2 memicu loop muat ulang saat cache dev dipakai ulang; indikator kiri bawah menutupi tombol Keluar. Tinjau ulang saat Next diperbarui |
| 2026-10-31 | Menu Pengaturan hanya tampil untuk Admin; `/settings` memeriksa role di server dan menampilkan "Akses ditolak" untuk role lain | Catatan desain `M-Lainnya.dc.html` dan spesifikasi §11.1 |
| 2026-10-31 | Halaman menolak akses dengan komponen "Akses ditolak", bukan `forbidden()` Next.js | `forbidden()` masih eksperimental (`authInterrupts`) di Next 16.4; kontrol keamanan tidak bergantung pada fitur eksperimental |
