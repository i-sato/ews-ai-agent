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
| 2026-10-31 | Semua rute dirender dinamis (`connection()` di root layout) | CSP bernonce SH-HDR-01 hanya berlaku pada render dinamis; semua halaman sudah dinamis karena cek sesi (keputusan pemilik) |
| 2026-10-31 | Halaman 404 sendiri berbahasa Indonesia (`src/app/not-found.tsx`) | 404 bawaan Next.js memakai style inline yang diblokir CSP produksi |
| 2026-10-31 | E2E di CI berjalan pada `pnpm build && pnpm start`, lokal tetap `pnpm dev` | Kebijakan CSP dev lebih longgar; regresi CSP hanya tertangkap pada build produksi |
| 2026-10-31 | Teks pernyataan kepatuhan §11.3 berversi sebagai konstanta di `src/modules/shared/domain/compliance-statement.ts` (versi, tanggal berlaku, status draf); riwayat lewat git/PR | Belum ada UI Pengaturan untuk mengubahnya; dapat dipindah ke tabel bila diperlukan (keputusan pemilik) |
| 2026-10-31 | Halaman `/compliance` publik (tanpa login); tautan "Pernyataan kepatuhan" di bawah sidebar (web, sesuai `Main.dc.html`) dan di akhir konten setiap halaman (mobile) | §11.3 meminta tautan di setiap halaman; desain mobile belum memuatnya (keputusan pemilik) |
| 2026-10-31 | Golden dataset F2-05: 25 baris tanpa identitas per sheet (bukan 1.996/1.986); nomor registrasi fiktif `SINTn-nnn` | Fixture kecil dan mudah ditinjau; tidak berpola nomor registrasi riil (keputusan pemilik) |
| 2026-10-31 | Asumsi format baris 1 sheet: label dan angka di sel terpisah (A1 `UPDATE TERAKHIR`, B1–I1 pasangan label/angka, jumlah selesai di atas kolom item); `TOTAL DITERIMA` disamakan dengan `TOTAL PENDAFTAR` | Format persis dan arti `TOTAL DITERIMA` belum dikonfirmasi; verifikasi dengan sheet asli sebelum F2-04 dianggap final (keputusan pemilik) |

## Saran tertunda (belum diputuskan)

Dicatat 31 Okt 2026 atas permintaan pemilik. Belum dikerjakan; ambil sebagai tugas terpisah setelah diputuskan.

| No | Saran | Asal | Usulan | Kontrol/tugas |
|---|---|---|---|---|
| S1 | Push branch F1-01 s.d. `security/cek-keamanan-fase-1` dan buat PR bertumpuk | F1-01–F1-08 | Merge berurutan; PR F1-02 harus di-merge bersama F1-04 karena `[auth.email] enable_signup = false` di F1-02 mematikan login email (diperbaiki di F1-04) | — |
| S2 | Batas waktu sesi | /cek-keamanan | Idle 30 menit, absolut 12 jam: `timebox`/`inactivity_timeout` di `supabase/config.toml` (Cloud: cek ketersediaan paket) dan umur cookie sesi disesuaikan | SH-SESS-02 |
| S3 | Lockout login per akun | /cek-keamanan | Penghitung gagal per email di server dengan jeda bertahap, di samping rate limit Supabase per IP | SH-AUTH-04 |
| S4 | Audit log login, logout, dan login gagal | /cek-keamanan | Tulis `audit_logs` dari server (tanpa email/PII di `details`) | SH-LOG-01, F6-03 |
| S5 | Halaman "Akses ditolak" berstatus HTTP 200 | /cek-keamanan | Kembalikan 403 (mis. `forbidden()` bila `authInterrupts` stabil, atau rute khusus) agar terlihat oleh alert | SH-LOG-03 |
| S6 | Kata sandi uji sintetis di `tests/support/local-supabase.ts` | /cek-keamanan | Biarkan (hanya Supabase lokal) dan tambahkan allowlist gitleaks, atau buat acak per run | SH-SECRET |
| S7 | Halaman berdata wajib memanggil `requireRole` | /cek-keamanan | Aturan lint atau tes yang memeriksa setiap `page.tsx` di `(dashboard)` | SH-AUTHZ-01 |
| S8 | Blok "nextjs-agent-rules" yang ditambahkan `next dev` ke `AGENTS.md` | F1-03 | Pilih: commit blok tersebut, atau `agentRules: false` di `next.config.ts` | — |
| S9 | Next.js 16.4.3 tersedia | F1-04 | Perbarui setelah lolos `minimumReleaseAge`; uji ulang lalu aktifkan kembali `turbopackFileSystemCacheForDev` bila loop muat ulang sudah hilang | SH-SUPPLY |
| S10 | `src/lib/container.ts` | F1-04 | Dibuat saat use case pertama butuh adapter (F2-06) | §4.2 |
| S11 | Alur lupa kata sandi | F1-04 | Tugas terpisah: minta reset via email, atur ulang kata sandi | SH-AUTH-05 |
| S12 | Cek kata sandi bocor dan kata sandi awal sekali pakai | F1-02 | Aktifkan leaked password protection di Cloud (bila paket mendukung); wajib ganti kata sandi saat login pertama | SH-AUTH-05 |
| S13 | `pnpm` dan Supabase CLI belum terpasang global di mesin pengembang | F1-01 | `corepack enable`; CLI sudah tersedia lewat `pnpm exec supabase` | — |
| S14 | `gh` CLI belum terpasang | F1-02 | `brew install gh` lalu `gh auth login` agar PR bisa dibuat dari terminal | — |
