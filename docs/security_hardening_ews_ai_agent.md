# Security Hardening EWS AI Agent — Versi 0.1

> **Status:** Dokumen hidup. Diperbarui bertahap selama pengembangan.  
> **Pasangan dokumen:** `spesifikasi_teknis_ews_ai_agent.md` (v1.5 ke atas).  
> **Catatan:** Dokumen ini adalah daftar kendali dan catatan bukti, bukan sertifikasi. Pemenuhan akhir dinilai melalui uji keamanan independen dan penelaahan pengelola keamanan informasi instansi.

## 1. Cara memakai dokumen ini

1. Setiap kontrol memiliki ID tetap (misalnya `SH-AUTHZ-01`), acuan standar, cara penerapan di EWS, cara verifikasi, status, dan bukti.
2. Status diperbarui di PR yang mengimplementasikan atau memverifikasi kontrol tersebut. Bukti berupa tautan PR, nama test, laporan pemindaian, atau tangkapan konfigurasi.
3. Setiap perubahan dicatat di §8 (log hardening). Risiko yang belum dapat diatasi dicatat di §9 beserta pemilik dan batas waktunya.
4. Template PR memuat pertanyaan: "Kontrol `SH-…` mana yang terdampak?" sehingga dokumen ini ikut diperbarui.

Status yang dipakai:

| Status | Arti |
|---|---|
| Belum | Belum dirancang atau diimplementasikan |
| Dirancang | Sudah tertuang di spesifikasi, belum ada kode |
| Ditunda | Sengaja belum diterapkan atas keputusan pemilik; risiko dicatat di §9 beserta kontrol pengganti |
| Diimplementasi | Kode atau konfigurasi sudah ada, belum diverifikasi |
| Terverifikasi | Lulus test otomatis atau pemeriksaan, bukti tercatat |
| Tidak berlaku | Tidak relevan, disertai alasan |

## 2. Acuan dan target

| Acuan | Pemakaian |
|---|---|
| OWASP Application Security Verification Standard (ASVS), **Level 2** | Target utama verifikasi aplikasi, karena aplikasi memproses data pribadi, termasuk data anak |
| OWASP API Security Top 10 (2023) | Risiko pada `/api/v1` |
| OWASP Top 10 (pemetaan memakai edisi 2021; sesuaikan bila memakai edisi terbaru) | Ringkasan risiko aplikasi web |
| OWASP Top 10 for LLM Applications (2025) | Risiko AI Agent |
| OWASP Cheat Sheet Series | Panduan teknis per kontrol (CSP, sesi, upload, logging, dan lainnya) |
| UU No. 27 Tahun 2022 (PDP), PP No. 71 Tahun 2019 (PSTE), Perpres No. 95 Tahun 2018 (SPBE) | Kewajiban pelindungan data dan keamanan sistem pemerintahan |
| Pedoman keamanan SPBE dari BSSN dan kebijakan keamanan informasi instansi | Perlu ditelaah bersama pengelola keamanan informasi |

## 3. Profil risiko

| Aspek | Keterangan | Dampak pada hardening |
|---|---|---|
| Data | Nama dan nomor registrasi peserta, termasuk peserta berusia 16–17 tahun | Minimisasi, pseudonim, retensi, kontrol akses ketat |
| Pengguna | Admin, Pengelola PK, Pengelola Pelatihan, Viewer/Pimpinan; dibatasi per tim kerja | Otorisasi di server dan RLS, uji BOLA/BFLA |
| Integrasi | Google Sheets, Drive, Docs; provider AI; portal Digitalent (hanya tautan) | Scope minimum, allowlist URL, penanganan respons eksternal |
| AI | Agent dengan tool calling, membaca isi sheet dan PDF yang tidak tepercaya | Prompt injection, kebocoran data, batas biaya, hak tool terbatas |
| Deployment | Vercel dan Supabase (cloud untuk prototipe; self-host untuk produksi) | Konfigurasi platform, pemisahan environment, lokasi data |

## 4. Kendali hardening

### 4.1 Arsitektur dan desain aman

| ID | Kontrol | Acuan | Penerapan di EWS | Verifikasi | Status | Bukti |
|---|---|---|---|---|---|---|
| SH-ARCH-01 | Threat model dipelihara | ASVS (arsitektur), Top 10 A04 | `docs/threat-model.md` dari tabel §11 spesifikasi; diperbarui saat fitur baru | Ditinjau per rilis | Dirancang | Spesifikasi §11 |
| SH-ARCH-02 | Lapisan terpisah, logika bisnis di server | ASVS (arsitektur) | Clean architecture §4.2; komponen klien tidak mengakses database | Lint batas lapisan di CI | Dirancang | Spesifikasi §4.2 |
| SH-ARCH-03 | Lingkungan terpisah | API8 | Local, CI, preview, produksi dengan secret dan database terpisah | Pemeriksaan konfigurasi | Dirancang | Spesifikasi §12.4 |

### 4.2 Autentikasi dan sesi

| ID | Kontrol | Acuan | Penerapan di EWS | Verifikasi | Status | Bukti |
|---|---|---|---|---|---|---|
| SH-AUTH-01 | Login lewat penyedia identitas tepercaya | ASVS (autentikasi), API2 | Supabase Auth dengan email dan kata sandi. Akun didaftarkan manual oleh Admin di Supabase (dashboard atau Admin API di server), lalu role dan tim kerja diisi di `profiles` | E2E `@auth` | Diimplementasi | Server Action `login`, `src/lib/auth/`; E2E `@login` lulus lokal; Terverifikasi setelah CI hijau (F1-07) |
| SH-AUTH-02 | MFA untuk Admin dan Pengelola PK | ASVS (autentikasi) | Belum diwajibkan pada tahap ini. Rencana: TOTP Supabase Auth wajib untuk Admin dan Pengelola PK, lalu untuk semua role sebelum produksi. Kontrol pengganti: SH-AUTH-03, -04, -05, SH-SESS-01 sampai -03, SH-LOG-01, -03 | Uji manual dan E2E saat diaktifkan | Ditunda | RR-04 |
| SH-AUTH-03 | Pendaftaran akun mandiri dinonaktifkan | ASVS (autentikasi) | "Allow new users to sign up" dimatikan; halaman daftar tidak tersedia; akun hanya dibuat Admin | Uji konfigurasi Supabase; E2E endpoint signup ditolak | Diimplementasi | `[auth] enable_signup = false`; tanpa halaman daftar; `tests/integration/auth.test.ts` dan E2E `@login` lulus lokal; Terverifikasi setelah CI hijau (F1-07); proyek Cloud menunggu F0-02 |
| SH-AUTH-05 | Kebijakan kata sandi | ASVS (autentikasi) | Minimal 12 karakter; cek kata sandi bocor (leaked password protection Supabase, bila tersedia di paket); kata sandi awal sekali pakai dan wajib diganti saat login pertama; reset lewat email | Uji konfigurasi dan E2E | Diimplementasi | Lokal: panjang minimal 12 dan `lower_upper_letters_digits` (integration test kata sandi lemah ditolak, lulus lokal; Terverifikasi setelah CI hijau (F1-07)); cek kebocoran dan kata sandi awal sekali pakai belum |
| SH-AUTH-06 | Siklus hidup akun | ASVS (autentikasi), A01 | Akun pegawai yang pindah tugas atau keluar dinonaktifkan; peninjauan daftar akun dan role tiap 3 bulan | Catatan peninjauan | Belum | |
| SH-AUTH-04 | Batas percobaan login | API2, API4 | Rate limit Supabase Auth dan lockout bertahap | Integration test | Belum | |
| SH-SESS-01 | Cookie sesi aman | ASVS (sesi) | `HttpOnly`, `Secure`, `SameSite=Lax`; token tidak disimpan di `localStorage` | Pemeriksaan header | Diimplementasi | `src/lib/supabase/cookies.ts` memaksa HttpOnly, SameSite=Lax, Secure di produksi; tanpa klien Supabase di browser; E2E `@login` lulus lokal; Terverifikasi setelah CI hijau (F1-07) |
| SH-SESS-02 | Batas waktu sesi | ASVS (sesi) | Idle timeout 30 menit, absolut 12 jam (dikonfigurasi) | E2E | Belum | |
| SH-SESS-03 | Logout mencabut sesi | ASVS (sesi) | `signOut` sisi server; refresh token dicabut | Integration test | Diimplementasi | `signOut({ scope: "local" })` di Server Action; integration test refresh dan access token lama ditolak; E2E cookie lama ditolak, lulus lokal; Terverifikasi setelah CI hijau (F1-07) |

### 4.3 Otorisasi

| ID | Kontrol | Acuan | Penerapan di EWS | Verifikasi | Status | Bukti |
|---|---|---|---|---|---|---|
| SH-AUTHZ-01 | Role diverifikasi di server | Top 10 A01, API5 | Role dari tabel `profiles`, bukan dari klien | Integration test per role | Dirancang | Spesifikasi §11.1 |
| SH-AUTHZ-02 | RLS aktif di semua tabel yang terekspos | A01 | RLS per role dan per tim kerja; grant minimum | pgTAP; query pemeriksa tabel tanpa RLS (§10) | Dirancang | Spesifikasi §6 |
| SH-AUTHZ-03 | Uji BOLA pada setiap endpoint berparameter ID | API1 | Pengguna tim A tidak dapat membaca pelatihan, peserta, atau laporan tim B | Integration test matriks role × resource | Belum | |
| SH-AUTHZ-04 | Uji BFLA | API5 | Endpoint admin (`/api/v1/admin/*`) hanya untuk Admin | Integration test | Belum | |
| SH-AUTHZ-05 | Perlindungan properti objek | API3 | Respons memakai DTO eksplisit; input dibatasi skema Zod `strict` (tanpa mass assignment) | Unit test skema | Belum | |
| SH-AUTHZ-06 | Persetujuan untuk alur sensitif | API6 | Commit impor, publikasi laporan, persetujuan katalog item, dan aturan risiko memerlukan role dan konfirmasi | E2E sesuai fitur | Dirancang | Spesifikasi §3, §10 |

### 4.4 Validasi input, injeksi, dan upload

| ID | Kontrol | Acuan | Penerapan di EWS | Verifikasi | Status | Bukti |
|---|---|---|---|---|---|---|
| SH-INPUT-01 | Validasi semua input di server | ASVS (validasi), A03 | Zod di setiap route dan Server Action | Unit test skema | Dirancang | |
| SH-INPUT-02 | Query terparameterisasi | A03 | Supabase client/RPC; tidak ada SQL dinamis dari input | CodeQL; review | Dirancang | |
| SH-INPUT-03 | Encoding output | A03 (XSS) | Render React tanpa `dangerouslySetInnerHTML`; teks dari sheet diperlakukan sebagai teks | Lint aturan larangan; CodeQL | Belum | |
| SH-INPUT-04 | CSV formula injection | ASVS (validasi) | Sel ekspor yang diawali `=`, `+`, `-`, `@` diberi awalan aman | Unit test | Dirancang | Spesifikasi §3.4 |
| SH-UPLOAD-01 | Batas ukuran dan jumlah baris | API4 | Batas ukuran file dan baris per impor | Integration test | Dirancang | |
| SH-UPLOAD-02 | Validasi tipe dan struktur file | ASVS (file) | Cek ekstensi, MIME, dan signature; parser aman; formula tidak dieksekusi | Unit test dengan file rusak | Dirancang | |
| SH-UPLOAD-03 | Penyimpanan file privat | ASVS (file) | Bucket privat; akses hanya lewat signed URL berumur pendek | Uji konfigurasi | Dirancang | Spesifikasi §10.3 |

### 4.5 API dan integrasi eksternal

| ID | Kontrol | Acuan | Penerapan di EWS | Verifikasi | Status | Bukti |
|---|---|---|---|---|---|---|
| SH-API-01 | Rate limiting dan pagination | API4 | Batas per pengguna dan per IP; pagination wajib pada daftar | Integration test | Dirancang | |
| SH-API-02 | Pencegahan SSRF | API7, A10 | Allowlist host: `docs.google.com`, `sheets.googleapis.com`, `www.googleapis.com`, `digitalent.komdigi.go.id`; tanpa redirect ke host lain; blok IP privat | Unit test validator URL | Dirancang | Spesifikasi §11 |
| SH-API-03 | Inventaris API | API9 | Spesifikasi OpenAPI dari skema Zod; endpoint lama dihapus | Pemeriksaan per rilis | Belum | |
| SH-API-04 | Respons eksternal tidak dipercaya | API10 | Respons Google dan provider AI divalidasi skema; timeout dan retry terbatas | Integration test dengan mock | Belum | |
| SH-API-05 | Job panjang tidak menahan request | API4 | Endpoint mengembalikan `202` dan `job_id` | Integration test | Dirancang | Spesifikasi §7, §12.5 |
| SH-GOOG-01 | Scope Google minimum | API8 | `drive.file` dan `documents`; Sheets baca saja | Pemeriksaan konfigurasi | Dirancang | Spesifikasi §10.4 |
| SH-GOOG-02 | Dokumen tidak dibagikan publik | A01 | Salinan laporan di Shared Drive tanpa tautan publik | Integration test sandbox | Dirancang | |
| SH-GOOG-03 | Kunci service account dikelola | A02 | Hanya di secret server; rotasi 90 hari; dicabut bila bocor | Pemeriksaan per kuartal | Belum | |

### 4.6 Header keamanan dan browser

| ID | Kontrol | Acuan | Penerapan di EWS | Verifikasi | Status | Bukti |
|---|---|---|---|---|---|---|
| SH-HDR-01 | Content Security Policy | ASVS (konfigurasi), A05 | CSP dengan nonce dari middleware; `default-src 'self'`; `frame-ancestors 'none'`; tanpa `unsafe-inline` untuk skrip | Uji header otomatis; ZAP baseline | Belum | |
| SH-HDR-02 | HSTS dan HTTPS | A02 | `Strict-Transport-Security: max-age=31536000; includeSubDomains` | Uji header | Belum | |
| SH-HDR-03 | Header lain | A05 | `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimum | Uji header | Belum | |
| SH-HDR-04 | CORS ketat | A05 | Hanya origin aplikasi; tanpa wildcard dengan kredensial | Integration test | Belum | |
| SH-HDR-05 | Perlindungan CSRF | A01 | Pemeriksaan origin pada Server Action; token CSRF untuk form non-Server Action | Integration test | Belum | |

### 4.7 Kriptografi dan secret

| ID | Kontrol | Acuan | Penerapan di EWS | Verifikasi | Status | Bukti |
|---|---|---|---|---|---|---|
| SH-CRYPTO-01 | TLS untuk semua koneksi | A02 | HTTPS; koneksi database wajib SSL | Uji konfigurasi | Dirancang | |
| SH-CRYPTO-02 | Enkripsi data tersimpan | A02 | Enkripsi bawaan Supabase; MinIO SSE pada self-host | Pemeriksaan konfigurasi | Dirancang | Spesifikasi §12.5 |
| SH-SECRET-01 | Secret hanya di server | A02 | Tidak ada secret di variabel `NEXT_PUBLIC_`; kunci provider AI dienkripsi dan disamarkan | Lint dan gitleaks | Dirancang | Spesifikasi §5.1 |
| SH-SECRET-02 | Rotasi dan pencabutan | A02 | Jadwal rotasi; prosedur bila secret bocor | Catatan rotasi | Belum | |

### 4.8 Data pribadi dan data anak

| ID | Kontrol | Acuan | Penerapan di EWS | Verifikasi | Status | Bukti |
|---|---|---|---|---|---|---|
| SH-PDP-01 | Minimisasi data | UU PDP | `JENIS KELAMIN`, `USIA`, `ADA DI USULAN MITRA` tidak diimpor | Unit test pemetaan kolom | Dirancang | Spesifikasi §3.2 |
| SH-PDP-02 | Pseudonim ke provider AI | LLM02, UU PDP | Peserta dikirim sebagai ID internal; nama dan nomor registrasi tidak dikirim | Test kontrak payload AI | Dirancang | Spesifikasi §9.5 |
| SH-PDP-03 | Retensi dan penghapusan | UU PDP | Anonimisasi otomatis sesuai keputusan §15.1 no. 3 | Job terjadwal dan test | Belum | |
| SH-PDP-04 | Dasar pemrosesan saat unggah | UU PDP | Konfirmasi dasar pemrosesan dan persetujuan wali di formulir tambah pelatihan dan impor | E2E `@impor` | Dirancang | Desain Tambah pelatihan |
| SH-PDP-05 | Data riil tidak masuk repositori | A08 | Fixture sintetis; aturan gitleaks pola `NO REGISTRASI` | CI security | Dirancang | Spesifikasi §12.2 |
| SH-PDP-06 | Akses sumber data dibatasi | A01 | Peringatan bila sheet dapat dibaca tanpa autentikasi | Integration test | Dirancang | Spesifikasi §3.2.4 |

### 4.9 Logging, monitoring, dan penanganan galat

| ID | Kontrol | Acuan | Penerapan di EWS | Verifikasi | Status | Bukti |
|---|---|---|---|---|---|---|
| SH-LOG-01 | Audit log aktivitas penting | A09 | Login, impor, perubahan konfigurasi, persetujuan, publikasi laporan | Integration test | Dirancang | Spesifikasi §7.4 |
| SH-LOG-02 | Log tanpa data sensitif | A09 | Redaksi PII, token, secret, isi prompt, dan isi dokumen | Unit test redaktor | Dirancang | |
| SH-LOG-03 | Peringatan keamanan | A09 | Alert untuk lonjakan login gagal, error 403, dan biaya AI | Uji alert | Belum | |
| SH-ERR-01 | Pesan galat aman | A05 | Tanpa stack trace; `request_id` untuk penelusuran | Integration test | Dirancang | Spesifikasi §7.3 |

### 4.10 Dependensi dan rantai pasok

| ID | Kontrol | Acuan | Penerapan di EWS | Verifikasi | Status | Bukti |
|---|---|---|---|---|---|---|
| SH-SUPPLY-01 | Lockfile dan instalasi beku | A06, A08 | `pnpm install --frozen-lockfile` | CI | Dirancang | Spesifikasi §12.2 |
| SH-SUPPLY-02 | Pemindaian dependensi | A06 | Dependabot, dependency review, `pnpm audit` | CI security | Dirancang | |
| SH-SUPPLY-03 | Action dipin SHA, token minimum | A08 | Spesifikasi §12.2 dan §12.6 | Pemeriksaan workflow | Dirancang | |
| SH-SUPPLY-04 | SBOM per rilis | A06 | SBOM CycloneDX dilampirkan pada rilis | CI rilis | Belum | |

### 4.11 AI Agent (OWASP Top 10 for LLM Applications 2025)

| ID | Kontrol | Acuan | Penerapan di EWS | Verifikasi | Status | Bukti |
|---|---|---|---|---|---|---|
| SH-LLM-01 | Ketahanan terhadap prompt injection | LLM01 | Isi sheet dan PDF dibungkus sebagai data; instruksi di dalamnya diabaikan; tool divalidasi di server | Kumpulan prompt uji serangan | Dirancang | Spesifikasi §9.2 |
| SH-LLM-02 | Pencegahan kebocoran data sensitif | LLM02 | Pseudonim; data minimum per pertanyaan; hasil disaring sesuai role | Test kontrak payload | Dirancang | |
| SH-LLM-03 | Rantai pasok model | LLM03 | Provider dan model yang disetujui; SDK resmi | Pemeriksaan konfigurasi | Dirancang | |
| SH-LLM-04 | Penanganan output AI | LLM05 | Output divalidasi skema; ditampilkan sebagai teks; tidak dieksekusi | Unit test | Dirancang | |
| SH-LLM-05 | Hak agent terbatas | LLM06 | Tool baca saja kecuali draf yang perlu persetujuan; tanpa SQL bebas; tanpa aksi keluar otomatis | Integration test daftar tool | Dirancang | Spesifikasi §9.3 |
| SH-LLM-06 | System prompt tidak memuat secret | LLM07 | Tidak ada kredensial atau aturan akses di prompt | Review | Dirancang | |
| SH-LLM-07 | Retrieval aman | LLM08 | Indeks dokumen dibatasi per hak akses | Integration test | Belum | |
| SH-LLM-08 | Angka dari tool, bukan ingatan model | LLM09 | Klaim angka harus merujuk hasil tool; jawaban tanpa bukti ditolak | Test grounding | Dirancang | PRD NFR-01 |
| SH-LLM-09 | Batas konsumsi | LLM10 | Batas token, timeout, rate limit, dan batas biaya bulanan | Integration test | Dirancang | Spesifikasi §9.5 |

### 4.12 Platform dan deployment

| ID | Kontrol | Acuan | Penerapan di EWS | Verifikasi | Status | Bukti |
|---|---|---|---|---|---|---|
| SH-PLAT-01 | Proteksi deployment preview | A05 | Vercel Deployment Protection untuk preview; data sintetis | Pemeriksaan konfigurasi | Belum | |
| SH-PLAT-02 | Konfigurasi Supabase | A05 | Provider auth yang tidak dipakai dinonaktifkan; SSL wajib; batasan jaringan bila tersedia; backup dan PITR | Checklist per environment | Belum | |
| SH-PLAT-03 | Hardening self-host | A05 | Container non-root; hanya port aplikasi yang dibuka; Postgres, Studio, dan MinIO console tidak publik; firewall | Pemindaian port | Belum | |
| SH-PLAT-04 | Repositori GitHub | A08 | Ruleset, CODEOWNERS, environment, secret scanning | Pemeriksaan pengaturan | Dirancang | Spesifikasi §12.6 |

## 5. Pengujian keamanan

| Jenis | Alat | Kapan | Gagal bila |
|---|---|---|---|
| SAST | CodeQL (`security-extended`) | Setiap PR | Temuan high/critical |
| SCA | Dependency review, `pnpm audit`, Dependabot | Setiap PR dan mingguan | Kerentanan high/critical |
| Secret scanning | gitleaks, secret scanning GitHub | Setiap PR dan push | Ada temuan |
| Otorisasi | Integration test matriks role × resource × tim kerja, pgTAP RLS | Setiap PR | Akses lintas tim atau role berhasil |
| Header | Test otomatis terhadap respons halaman dan API | Setiap PR | Header wajib hilang |
| DAST | OWASP ZAP baseline terhadap preview | Mingguan dan sebelum rilis | Peringatan medium ke atas yang belum diterima |
| Uji AI | Kumpulan prompt injection dan uji kebocoran | Saat perubahan modul agent | Agent mengikuti instruksi dari data atau membocorkan data |
| Uji penetrasi | Pihak independen | Sebelum memakai data riil di produksi | Temuan kritis belum ditutup |

## 6. Gerbang rilis

| Gerbang | Syarat minimum |
|---|---|
| Prototipe dengan data sintetis | Semua kontrol berstatus minimal Dirancang; SH-AUTHZ-01/02, SH-SECRET-01, SH-PDP-05, SH-SUPPLY-01 sampai 03 Terverifikasi |
| Uji coba dengan data riil terbatas | Seluruh kontrol §4.2, §4.3, §4.8, dan §4.11 Terverifikasi, kecuali yang Ditunda dengan risiko diterima di §9 (SH-AUTH-02 hanya dapat ditunda bila kontrol penggantinya Terverifikasi); ZAP baseline bersih; persetujuan pengelola data dan fungsi hukum |
| Produksi | Semua kontrol Terverifikasi atau Tidak berlaku dengan alasan; uji penetrasi selesai; risiko tersisa tercatat dan diterima pemilik risiko |

## 7. Contoh konfigurasi

Header keamanan di `next.config.ts` (CSP dengan nonce disetel di `middleware.ts`):

```ts
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Frame-Options", value: "DENY" },
];

export default {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
```

Pemeriksaan tabel tanpa RLS (dipakai di pgTAP atau CI):

```sql
select schemaname, tablename
from pg_tables
where schemaname = 'public' and rowsecurity = false;
```

Hasil query harus kosong.

## 8. Log hardening

Isi satu baris setiap ada perubahan yang memengaruhi keamanan.

| Tanggal | Versi aplikasi | Perubahan | Kontrol terkait | Bukti | Catatan |
|---|---|---|---|---|---|
| 31 Okt 2026 | Spesifikasi v1.6 | Dokumen hardening dibuat; kontrol dipetakan dari spesifikasi | Semua | Dokumen ini | Belum ada kode; status maksimal Dirancang |
| 31 Okt 2026 | Spesifikasi v1.6 | Akun didaftarkan manual oleh Admin di Supabase dengan email dan kata sandi; MFA belum diwajibkan | SH-AUTH-01 sampai -06 | Keputusan pemilik | MFA berstatus Ditunda; kontrol pengganti ditambahkan (RR-04) |
| 31 Okt 2026 | Starter pack 0.1.0 | Migration awal: RLS + FORCE di semua tabel, grant anon dicabut, akses per tim kerja, viewer tanpa data peserta; lint batas lapisan dan larangan `dangerouslySetInnerHTML`; header keamanan dasar; `escapeCsvCell`, allowlist URL; gitleaks pola `NO REGISTRASI`; pnpm `minimumReleaseAge` 14 hari | SH-AUTHZ-02, SH-ARCH-02, SH-INPUT-03, SH-INPUT-04, SH-API-02, SH-HDR-02, SH-HDR-03, SH-PDP-05, SH-SUPPLY-01 | `supabase/tests/rls.test.sql`, `tests/unit/security.test.ts`, `eslint.config.mjs` | Belum diuji di Supabase CLI (dicek di PGlite); status tetap Dirancang sampai CI hijau |
| 31 Okt 2026 | 0.1.0 (F1-02) | `supabase init`; pendaftaran mandiri dimatikan dan kebijakan kata sandi lokal (12 karakter, huruf besar, huruf kecil, angka); Supabase CLI dipin sebagai devDependency | SH-AUTH-03, SH-AUTH-05, SH-SUPPLY-01 | `supabase/config.toml`; `POST /auth/v1/signup` lokal ditolak `422 signup_disabled`; `supabase test db` 9/9 lulus | Pengaturan yang sama wajib diterapkan di proyek Cloud (F0-02) |
| 31 Okt 2026 | 0.1.0 (F1-04) | Login email + kata sandi lewat Server Action `@supabase/ssr`; cookie sesi dipaksa HttpOnly (bawaan pustaka tidak); `src/proxy.ts` memperbarui sesi dan mengalihkan ke login; `getUser()` divalidasi ke Supabase Auth; logout server-side; pesan galat login generik; parameter `next` hanya path relatif (cegah open redirect); `[auth.email] enable_signup` dikembalikan `true` karena opsi itu mematikan login email, pendaftaran tetap ditutup `[auth] enable_signup = false` | SH-AUTH-01, SH-AUTH-03, SH-AUTH-05, SH-SESS-01, SH-SESS-03 | `tests/integration/auth.test.ts` 3/3, `tests/e2e/login.spec.ts` desktop + mobile, `tests/unit/auth-paths.test.ts`, `tests/unit/login-input.test.ts` | Belum: idle/absolute timeout (SH-SESS-02), lockout (SH-AUTH-04), audit log login (SH-LOG-01) |

## 9. Risiko tersisa dan pengecualian

| ID | Risiko | Kontrol terkait | Mitigasi sementara | Pemilik | Batas waktu | Status |
|---|---|---|---|---|---|---|
| RR-01 | Sheet sumber contoh dapat diunduh tanpa login dan berisi data anak | SH-PDP-06 | Batasi akses sheet; gunakan service account | Pengelola data | Sebelum data riil | Terbuka |
| RR-02 | Jadwal pelatihan belum dapat diambil dari portal secara resmi | SH-API-02 | Verifikasi jadwal manual | Pengelola pelatihan | Sampai akses resmi tersedia | Terbuka |
| RR-04 | Login tanpa MFA: akun dapat diambil alih bila kata sandi bocor atau ditebak | SH-AUTH-02 | Kata sandi kuat dan cek kebocoran, pembatasan percobaan login, batas waktu sesi, audit log dan peringatan login gagal, tanpa pendaftaran mandiri | Admin aplikasi | Sebelum produksi (MFA wajib untuk Admin dan Pengelola PK paling lambat sebelum uji coba data riil) | Diterima sementara |
| RR-03 | Penyimpanan di cloud luar negeri pada topologi pilihan B | SH-CRYPTO-02, SH-PDP-03 | Data sintetis pada prototipe; pilihan A untuk produksi | Fungsi hukum | Sebelum produksi | Terbuka |
