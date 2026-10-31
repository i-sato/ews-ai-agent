# Spesifikasi Teknis EWS AI Agent — Versi 1.7

> **Status:** Rancangan untuk prototipe dan validasi  
> **Stack:** Next.js, TypeScript, Supabase, Google APIs, AI multi-provider, GitHub Actions, Vercel  
> **Catatan:** Struktur ini merupakan spesifikasi awal. Struktur sheet peserta telah diverifikasi dari dua sheet contoh (§3.2). Definisi indikator, target, rumus resmi, dan template laporan masih harus diverifikasi setelah PDF Perjanjian Kinerja (PK) dan template laporan tersedia.  
> **Pembaruan 1.1:** verifikasi template sheet peserta, aturan impor format lebar (satu kolom per item modul), dan pemantauan detail per pelatihan dan item modul (§8.6). Ringkasan perubahan ada di §16.  
> **Pembaruan 1.2:** laporan periodik bulanan dan tahunan yang mencakup beberapa pelatihan sekaligus, baik yang sudah selesai maupun yang masih berjalan (§10.2).  
> **Pembaruan 1.3:** deteksi kolom item dinamis sampai kolom `Cek Sync`, saran katalog item oleh AI yang perlu persetujuan, tiga waktu pembaruan dan sinkronisasi manual (§3.5), tautan halaman pelatihan dan validasi jadwal (§3.6), serta pernyataan kepatuhan (§11.3).  
> **Pembaruan 1.4:** tahun dan tim kerja sebagai induk pelatihan, ID pelatihan hasil parsing yang dikonfirmasi admin (§3.7), template laporan bulanan dan tahunan beserta mekanisme pengisian Google Docs (§10.3), serta topologi deployment Vercel dan Supabase (§12.5).  
> **Pembaruan 1.5:** clean architecture dan batas panjang kode (§4.2, §4.3), pipeline CI/CD dan workflow GitHub Actions (§12.1, §12.2), keamanan repositori GitHub (§12.6), strategi pengujian dengan E2E sesuai cakupan perubahan (§12.7), serta keputusan yang perlu dikonfirmasi sebelum implementasi (§15.1).  
> **Pembaruan 1.6:** security hardening berbasis OWASP dipisah ke dokumen hidup `security_hardening_ews_ai_agent.md` (§11.4).  
> **Pembaruan 1.7:** indikator PK 2026 asli (IKSK) dan pemetaannya ke tim kerja, rumus persentase dengan penyebut peserta berprogres ≥ 90%, target antara bulanan, level dan kriteria lulus per metode (§8.7), serta pembacaan folder PK per tahun (§9.4).

## 1. Tujuan dan prinsip arsitektur

Sistem Early Warning System (EWS) berbasis AI Agent ditujukan untuk memantau capaian pelatihan, mendeteksi risiko target tidak tercapai, menjelaskan penyebab berdasarkan data, merekomendasikan tindak lanjut, dan membantu menyusun laporan pelatihan.

Prinsip utama:

- **Data aktual sebagai sumber kebenaran:** Google Sheets menjadi sumber data awal; CSV/XLSX menjadi alternatif impor.
- **PK sebagai sumber aturan resmi:** indikator dan target diekstrak dari PDF, lalu diverifikasi sebelum digunakan.
- **Rules engine deterministik:** status risiko dihitung melalui kode yang teruji, bukan ditentukan bebas oleh LLM.
- **AI Agent multi-provider:** Gemini, Anthropic Claude, dan OpenAI dapat dipilih tanpa mengubah arsitektur inti.
- **Human-in-the-loop:** rekomendasi dan laporan AI dapat ditinjau sebelum disahkan.
- **Security by design:** perlindungan data peserta, secret, akses, dan audit trail menjadi bagian desain sejak awal.

### 1.1 Dua jenis risiko

1. **Risiko individu:** peserta berpotensi tidak menyelesaikan materi atau memenuhi kriteria kelulusan.
2. **Risiko capaian kinerja:** akumulasi realisasi pelatihan berpotensi tidak memenuhi target PK pada akhir periode.

Keduanya berhubungan tetapi tidak identik. Progres materi bukan otomatis realisasi resmi indikator PK.

## 2. Arsitektur yang direkomendasikan

Gunakan **monolit modular Next.js + Supabase** untuk prototipe, bukan microservices. Pendekatan ini mengurangi kompleksitas deployment dan integrasi.

```text
Google Sheets / CSV / XLSX
            |
            v
  Ingestion & Validation
            |
            v
 Supabase PostgreSQL <---- PDF PK / dokumen terverifikasi
            |                         |
            v                         v
   Rules Engine <------------ PK Indicator Mapping
            |
            +------> Dashboard / Risk Assessments
            |
            v
       AI Agent Service
       |      |      |
    Gemini  Claude  OpenAI
            |
            v
  Recommendations / Report Draft
            |
            v
      Google Docs API
```

Komponen:

- **Frontend & API:** Next.js App Router + TypeScript, di-hosting di Vercel (§12.5).
- **Database dan autentikasi:** Supabase PostgreSQL + Supabase Auth.
- **File storage:** Supabase Storage (kompatibel S3; pada self-host dapat memakai MinIO) untuk PDF PK, file impor sementara, gambar laporan, dan arsip PDF laporan. Dokumen laporan yang aktif disimpan di Shared Drive Google.
- **Integrasi sumber:** Google Sheets API atau ekspor CSV; fallback unggah CSV/XLSX.
- **AI:** adapter internal untuk Gemini, Claude, dan OpenAI.
- **Laporan:** Google Docs API dan Drive API.
- **CI/CD:** GitHub Actions + Vercel + Supabase CLI.

## 3. Pemeriksaan sumber data dan strategi impor

### 3.1 Google Sheets

Dua sheet contoh telah diperiksa melalui endpoint ekspor CSV pada tab `ALL PENDAFTAR WEB` (gid `509877154`, sama pada kedua salinan template). Hasil verifikasi struktur ada di §3.2. Kegagalan pembacaan melalui akses web tidak membuktikan bahwa aplikasi tidak dapat mengakses sheet.

Implementasikan tiga mode impor:

| Mode | Metode | Prioritas |
|---|---|---|
| Google Sheets | Google Sheets API atau ekspor CSV dari sheet yang dapat diakses | Utama |
| CSV | Unggah file CSV melalui dashboard | Fallback pertama |
| XLSX | Unggah file Excel dengan pemilihan sheet dan pemetaan kolom | Fallback kedua |

Untuk sheet publik, aplikasi dapat mencoba endpoint ekspor CSV berdasarkan spreadsheet ID dan `gid`. Jika gagal, arahkan pengguna ke impor CSV/XLSX. Hindari scraping HTML halaman Google Sheets sebagai mekanisme utama. Endpoint ekspor publik hanya untuk uji dengan data sintetis; data peserta riil dibaca melalui service account dengan akses baca (§3.2.4).

Spreadsheet ID dan `gid` harus disimpan sebagai konfigurasi sumber, bukan ditanam permanen di kode. Identitas pelatihan tidak tercantum di sel sheet, sehingga konfigurasi sumber juga memuat pelatihan tujuan, tata letak sheet (baris metadata, baris header, baris awal data, rentang kolom item), pemetaan nilai status, jadwal sinkronisasi, dan batas kesegaran data. Pada template yang diverifikasi, satu spreadsheet berisi satu kelas pelatihan. Data pelatihan juga dapat menyimpan tautan halaman pelatihan pada portal sebagai rujukan jadwal (§3.6).

### 3.2 Struktur template sheet peserta (hasil verifikasi)

Dua sheet contoh diperiksa pada 29 Oktober 2026. Keduanya salinan template yang sama dengan satu tab, `ALL PENDAFTAR WEB`. Angka di bagian ini berupa agregat; tidak ada data pribadi peserta yang disalin ke dokumen ini.

#### 3.2.1 Tata letak

| Bagian | Lokasi | Isi | Perlakuan |
|---|---|---|---|
| Metadata dan total | Baris 1 | `UPDATE TERAKHIR: <tanggal> <BULAN> <jam> WIB`, `TOTAL PENDAFTAR`, `TOTAL DITERIMA`, `TOTAL ONBOARDING`, `TOTAL SELESAI`, lalu jumlah peserta selesai di atas setiap kolom item | Diurai sebagai metadata batch dan bahan rekonsiliasi, bukan data peserta |
| Header | Baris 2 | Nama kolom | Dicocokkan dengan pemetaan kolom sumber |
| Data peserta | Baris 3 dan seterusnya | Satu baris per peserta | Hanya baris dengan identitas yang diproses |
| Identitas dan status | Kolom A–I pada contoh; dikenali dari nama header | `NAMA`, `NO REGISTRASI`, `INSTANSI`, `JENIS KELAMIN`, `USIA`, `ADA DI USULAN MITRA`, `STATUS`, `ONBOARDING`, `PERSENTASE LMS` | Lihat §3.2.2 |
| Slot item modul | Semua kolom setelah `PERSENTASE LMS` sampai sebelum `Cek Sync`; pada contoh J–AY (42 slot), jumlahnya dapat berbeda antarsheet | Satu kolom per item: overview, materi, video, kuis, atau final assessment. Nilai `Selesai` atau `Belum Mengerjakan` | Diubah dari format lebar ke format panjang: satu baris per peserta per item |
| Pemeriksaan sinkron | Kolom penutup `Cek Sync`; pada contoh di AZ, posisinya dapat bergeser | `OK`, `Error Sync`, atau galat formula seperti `#REF!` | Bendera kualitas data |

#### 3.2.2 Pemetaan kolom

| Kolom sumber | Field internal | Catatan |
|---|---|---|
| `NAMA` | `participants.name` | Data pribadi; tidak dikirim ke provider AI |
| `NO REGISTRASI` | `participants.participant_number` | Pola 12 digit, tanda hubung, lalu 1–2 digit; disimpan sebagai string; kunci peserta |
| `INSTANSI` | `organizations.name` | Pada kedua contoh, satu instansi per sheet |
| `JENIS KELAMIN`, `USIA` | Tidak diimpor secara default | Tidak dibutuhkan rules engine maupun placeholder laporan. `USIA` berupa teks, misalnya `16Tahun` |
| `ADA DI USULAN MITRA` | Tidak diimpor secara default | Arti kolom perlu dikonfirmasi; nilai `FALSE` terisi sampai ke baris kosong |
| `STATUS` | `training_enrollments.source_status` → `enrollment_status` | `Lulus Pelatihan - Nilai` → `passed`; `Tidak Lulus Pelatihan - Nilai` → `not_passed`; `Pembatalan` → `cancelled`; nilai lain → `unmapped` dan ditahan untuk ditinjau |
| `ONBOARDING` | `training_enrollments.onboarding_status` | `Onboarding` → `true`; `Tidak Onboarding` → `false`; kosong → `null` |
| `PERSENTASE LMS` | `participant_progress_snapshots.completion_percentage` | Divalidasi terhadap status item (§3.3) |
| Kolom item yang berjudul | `training_modules`, `participant_module_progress` | Judul dari baris 2; urutan dari posisi kolom |
| `Cek Sync` | Bendera kualitas baris impor | Nilai selain `OK` menjadi peringatan |

Kedua contoh berasal dari kelas yang sudah selesai, sehingga nilai `STATUS` selama pelatihan masih berjalan belum terlihat dan perlu dikonfirmasi.

#### 3.2.3 Temuan dari dua sheet contoh

| Aspek | Contoh 1 | Contoh 2 |
|---|---|---|
| Judul spreadsheet | `Mirror DTA VBL 13109 IAWD 23 - 30 Sept` | `MIRROR - DTA VBL 13107 OIAT 10 -31 Agustus` |
| Baris peserta | 41 | 51 (50 sesuai `TOTAL PENDAFTAR`, ditambah 1 `Pembatalan`) |
| Baris tanpa identitas yang berisi nilai bawaan formula | 1.996 | 1.986 |
| Item terpakai / slot kosong | 34 / 8 | 28 / 14 |
| Jenis item | 1 overview, 24 materi, 5 video, 3 kuis, 1 final assessment | 24 materi, 3 kuis, 1 final assessment |
| Judul item ganda | Tidak ada | 1 judul pada 2 kolom (AE dan AF) |
| Judul dengan entitas HTML | 2 (`&AMP;`) | Tidak ada |
| Panjang judul item | 6–103 karakter | 6–164 karakter |
| Lulus / tidak lulus / batal | 33 / 8 / 0 | 45 / 5 / 1 |
| Tidak lulus: belum mengerjakan satu item pun / berhenti di tengah | 6 / 2 | 4 / 1 |
| Titik berhenti peserta yang belum tuntas | Item ke-15 (`KUIS 1`) dan ke-17 | Item ke-3 |
| `PERSENTASE LMS` = item selesai ÷ item terpakai × 100 | Cocok untuk semua peserta | Cocok, kecuali 1 baris konflik |
| Konflik dan galat | 1 baris dengan `Cek Sync` = `#REF!` | 1 baris `Pembatalan` dengan `ONBOARDING` kosong, `PERSENTASE LMS` 100 tetapi 0 item selesai, dan `Cek Sync` = `Error Sync` |
| `TOTAL SELESAI` baris 1 vs hitung ulang | Cocok | Cocok |
| `UPDATE TERAKHIR` | `13 OKTOBER 11:43 WIB`, tanpa tahun | `2 SEPTEMBER 11:00 WIB`, tanpa tahun |
| Urutan penyelesaian item | Berurutan untuk semua peserta | Berurutan untuk semua peserta |
| Usia peserta | 16–17 tahun | 16–17 tahun |

Pola yang relevan untuk EWS:

- Semua peserta yang lulus menuntaskan seluruh item dan berstatus `Onboarding`. Seluruh 13 peserta yang tidak lulus berstatus `Tidak Onboarding`.
- 10 dari 13 peserta yang tidak lulus tidak menyelesaikan satu item pun; 3 lainnya berhenti di item tertentu. Kedua kelompok membutuhkan tindak lanjut berbeda: aktivasi atau onboarding untuk yang belum mulai, pendampingan materi untuk yang berhenti di tengah.
- `PERSENTASE LMS` hanya menunjukkan besaran progres, bukan item yang belum selesai. Rincian item dibutuhkan untuk memenuhi FR-04 pada dokumen PRD & FRD Vocational Agentic EWS ("komponen yang paling tertinggal").
- `ONBOARDING` bukan prasyarat teknis mengerjakan item: pada contoh 1, dua peserta `Tidak Onboarding` menyelesaikan 14 dan 16 item.
- Kedua sheet diperbarui setelah periode pada judulnya berakhir. Agar berfungsi sebagai peringatan dini, sinkronisasi harus berjalan selama pelatihan berlangsung.

#### 3.2.4 Catatan pelindungan data

- Kedua sheet contoh dapat diunduh tanpa autentikasi melalui endpoint ekspor CSV, padahal berisi nama dan nomor registrasi peserta berusia 16–17 tahun. Akses "siapa saja yang memiliki link" sebaiknya dicabut dan diganti akses baca melalui service account dengan izin minimum (NFR-03 PRD).
- Data anak termasuk data pribadi yang bersifat spesifik menurut UU No. 27 Tahun 2022 (Pasal 4 ayat (2)), dan pemrosesannya memerlukan persetujuan orang tua atau wali (Pasal 25). Lihat §11.2.
- Kolom yang tidak dibutuhkan (`JENIS KELAMIN`, `USIA`, `ADA DI USULAN MITRA`) tidak diimpor kecuali ada kebutuhan yang disetujui.

### 3.3 Kontrak data internal

Semua format sumber dinormalisasi ke struktur internal yang konsisten. Contoh ilustratif:

```json
{
  "source": "google_sheets",
  "source_id": "UUID-SUMBER",
  "import_batch_id": "UUID-BATCH",
  "training_id": "UUID-PELATIHAN",
  "participant_number": "000000000001-01",
  "participant_name": "Peserta Contoh",
  "organization": "Instansi Contoh",
  "source_status": "Tidak Lulus Pelatihan - Nilai",
  "enrollment_status": "not_passed",
  "onboarding_status": false,
  "completion_percentage": 41,
  "completed_items": 14,
  "total_items": 34,
  "modules": [
    {
      "sequence": 14,
      "module_code": "M14",
      "module_name": "VIDEO: README",
      "module_type": "video",
      "status": "completed"
    },
    {
      "sequence": 15,
      "module_code": "M15",
      "module_name": "KUIS 1",
      "module_type": "quiz",
      "status": "not_started"
    }
  ],
  "quality_flags": [],
  "source_updated_at": "2026-10-13T11:43:00+07:00",
  "source_updated_at_year_inferred": true
}
```

Data tersebut hanya contoh skema, bukan data asli. `training_id` ditentukan dari konfigurasi sumber, bukan dari isi sheet. Status peserta dan status item harus dipetakan dari nilai sumber yang sebenarnya.

Aturan normalisasi:

- Persentase berada pada rentang 0–100.
- Nilai kosong tidak otomatis dianggap 0%.
- Nomor peserta disimpan sebagai string agar nol di depan tidak hilang.
- Duplikasi peserta dalam satu pelatihan harus dideteksi.
- Status sumber dipetakan ke enum internal melalui konfigurasi.
- Jika waktu pembaruan sumber tidak tersedia, catat waktu impor, tetapi jangan menganggapnya sebagai waktu pembaruan sumber.
- Baris peserta valid hanya jika `NO REGISTRASI` terisi. Baris tanpa identitas yang berisi nilai bawaan formula (`Belum Mengerjakan`, `0`, `FALSE`, `OK`) diabaikan dan dicatat sebagai `ignored_rows`, bukan sebagai peserta dengan progres 0%.
- Kolom item tanpa judul diabaikan dan tidak dihitung sebagai item belum selesai.
- Format lebar diubah menjadi satu baris per peserta per item. Status item dipetakan: `Selesai` → `completed`, `Belum Mengerjakan` → `not_started`. Status `in_progress` dan `completion_percentage` per item disediakan untuk sumber lain yang memuat persentase.
- Identitas item adalah posisi kolom dan judulnya. Kode item dibangkitkan dari urutan (`M01`, `M02`, ...). Judul ganda tetap menjadi item terpisah dan diberi peringatan.
- Entitas HTML pada judul (`&AMP;`) didekode untuk tampilan; judul asli tetap disimpan untuk jejak sumber.
- Jenis item (`overview`, `material`, `video`, `quiz`, `final_assessment`) diturunkan dari awalan judul (`OVERVIEW`, `VIDEO:`, `KUIS`, `FINAL ASSESSMENT`; selain itu materi) dan dapat dikoreksi pada konfigurasi.
- Perubahan katalog item antarimpor (judul berubah, item bertambah atau berkurang) menahan commit sampai pengguna menyetujui versi katalog baru. Selama itu, snapshot valid terakhir tetap dipakai (NFR-05 PRD).
- `UPDATE TERAKHIR` diurai menjadi `source_updated_at`. Tahun diambil dari periode pelatihan pada konfigurasi; jika periode melewati pergantian tahun atau belum dikonfigurasi, nilai ditandai tidak pasti.
- Total pada baris 1 direkonsiliasi dengan hitung ulang. Selisih ditampilkan pada pratinjau beserta penjelasannya, misalnya `TOTAL PENDAFTAR` 50 vs 51 baris karena satu baris `Pembatalan`.
- `PERSENTASE LMS` harus konsisten dengan rasio item selesai, dengan toleransi 1 poin persentase. Inkonsistensi menghasilkan `DATA_INVALID`.
- Galat formula (`#REF!`, `#N/A`, `#VALUE!`, `#DIV/0!`) dan `Cek Sync` selain `OK` dicatat sebagai bendera kualitas data; nilainya tidak diolah sebagai angka.
- Peserta berstatus `cancelled` tetap tercatat, tetapi dikeluarkan dari penyebut perhitungan.
- Kolom identitas dan status dikenali dari nama header, bukan posisi. Nama dirapikan (spasi di awal/akhir dan spasi ganda), dicocokkan tanpa peka huruf besar/kecil, dan boleh memakai alias yang dikonfigurasi per sumber.
- Rentang item dideteksi dinamis: semua kolom setelah `PERSENTASE LMS` sampai tepat sebelum kolom penutup, yaitu header pertama yang cocok dengan `cek sync` setelah dirapikan dan tanpa peka huruf besar/kecil. Jumlah item tidak dibatasi 42.
- Kolom setelah `Cek Sync` diabaikan; jika berisi data, pratinjau memberi peringatan.
- Proses berhenti dan melapor, tanpa menebak, bila `Cek Sync` tidak ditemukan atau muncul lebih dari sekali, rentang item kosong, atau `Cek Sync` berada sebelum `PERSENTASE LMS`.
- Rentang yang terdeteksi (huruf kolom awal-akhir, jumlah item berjudul, jumlah slot kosong) dicatat pada batch impor. Konfigurasi sumber menyimpan aturan deteksinya, bukan huruf kolom.
- Pemetaan item tetap deterministik. AI hanya boleh memberi saran untuk hal yang ambigu (pengelompokan unit, jenis item tanpa awalan jelas, item ganti judul vs item baru, draf item wajib). Saran memakai judul item saja, tanpa data peserta, disimpan sebagai versi katalog draf, dan baru berlaku setelah disetujui. Jika AI tidak tersedia, impor tetap berjalan dengan hasil deterministik.

Setiap impor menghasilkan `sync_run_id` atau `import_batch_id` untuk menghubungkan data sumber, hasil validasi, snapshot progres, dan assessment risiko.

### 3.4 Pipeline impor

1. **Parse:** baca sheet/file sesuai tata letak sumber (baris metadata, header, dan awal data); kenali kolom dari nama header dan deteksi rentang item sampai kolom `Cek Sync` (§3.3); validasi format, header, ukuran, jumlah baris, dan struktur workbook. Jika header tidak cocok dengan pemetaan, proses berhenti dan melaporkan kolom yang tidak cocok, tanpa menebak (FR-02 PRD).
2. **Validate & normalize:** abaikan baris tanpa identitas dan slot item tanpa judul; ubah kolom item menjadi baris item per peserta; periksa field wajib, persentase, duplikasi, status, konsistensi `PERSENTASE LMS` dengan status item, galat formula, dan perubahan katalog item.
3. **Preview & reconcile:** tampilkan jumlah data baru, berubah, tidak berubah, duplikat, ditolak, dan diabaikan, beserta rekonsiliasi dengan total baris 1 dan `source_updated_at`.
4. **Commit:** simpan perubahan secara transaksional, rekam batch, dan perbarui snapshot peserta serta snapshot item secara idempoten.

Ketentuan tambahan:

- `POST /imports/preview` tidak menulis ke tabel operasional.
- Simpan preview sebagai staging batch yang memiliki masa berlaku.
- Validasi ulang saat commit.
- Batasi ukuran file dan jumlah baris.
- Tolak workbook tidak valid dan jangan mengeksekusi formula sebagai kode.
- Lindungi ekspor CSV dari CSV formula injection.
- Selama periode pelatihan, sinkronisasi Google Sheets dijalankan terjadwal dengan frekuensi yang dikonfigurasi per sumber. Sumber hanya menyimpan status terkini tanpa waktu aktivitas per item, sehingga stagnasi dan tren hanya dapat dihitung dari snapshot antarimpor (FR-08 PRD).

### 3.5 Waktu pembaruan dan sinkronisasi manual

Sel `UPDATE TERAKHIR` diisi pemilik file dan tidak selalu diperbarui, misalnya karena pembatasan akses. Sistem tidak pernah mengubah sel tersebut (PRD: agen tidak mengubah data sumber). Karena itu, kesegaran data memakai tiga waktu terpisah:

| Waktu | Sumber | Arti |
|---|---|---|
| `fetched_at` | Saat sinkronisasi berhasil | Kapan sistem membaca sheet; bukan bukti data baru |
| `content_changed_at` | Perbandingan hash isi per baris dan per item dengan snapshot sebelumnya | Kapan isi data benar-benar berubah |
| `source_updated_at` | `modifiedTime` file dari Google Drive API (akses service account, `drive.metadata.readonly`), atau sel `UPDATE TERAKHIR` bila metadata tidak tersedia | Klaim pembaruan dari sisi sumber |

Ketentuan:

- Waktu acuan kesegaran adalah yang paling baru antara `content_changed_at` dan `modifiedTime`. Sel `UPDATE TERAKHIR` hanya pembanding.
- Isi berubah tetapi `UPDATE TERAKHIR` tidak berubah: data tetap segar, dengan peringatan ringan "label pembaruan di sheet tidak diperbarui".
- Isi tidak berubah: tampilkan "tidak ada perubahan sejak [tanggal], terakhir dicek [fetched_at]". Kondisi ini menjadi masukan `PROGRESS_STAGNANT`; `DATA_STALE` baru berlaku bila sumber juga tidak berubah melewati batas kesegaran.
- Sinkronisasi manual tersedia bagi Pengelola Pelatihan dan Admin, dengan batas frekuensi. Sinkronisasi manual hanya membaca ulang sheet. Jika isi tidak berubah, tidak dibuat snapshot baru; hanya `fetched_at` yang diperbarui. Setiap sinkronisasi tercatat di `sync_runs` dan audit log.
- Jika sheet tidak dapat dibaca karena izin, sistem menampilkan galat yang jelas dan mempertahankan snapshot valid terakhir (NFR-05 PRD).
- Tampilan kesegaran menyebut minimal dua waktu, misalnya "Dicek 30 Okt 10.00 · isi berubah 29 Okt 16.20".

### 3.6 Tautan halaman pelatihan dan validasi jadwal

Setiap pelatihan dapat menyimpan tautan halaman pelatihan pada portal, misalnya `https://digitalent.komdigi.go.id/pelatihan/13109`, sebagai rujukan rekap serta sumber jadwal pendaftaran dan pelaksanaan. ID pelatihan portal (`13109`) diambil dari pola URL `/pelatihan/{id}`.

Hasil pemeriksaan halaman contoh pada 31 Oktober 2026:

- Halaman dirender di browser (Next.js). HTML awal hanya berisi kerangka tanpa data jadwal.
- Data detail dimuat dari `https://api.sdmdigital.id/home/pelatihan/13109/detail`, yang mengembalikan muatan **terenkripsi** (field `load`) dan didekripsi di sisi klien.
- Setelah dirender, halaman contoh tidak menampilkan jadwal yang dapat diandalkan: tanggal pelatihan tampil sebagai tanggal hari pemeriksaan, nomor batch kosong, dan kuota "undefined".

Ketentuan:

- Sistem **tidak** melakukan scraping halaman dan tidak membuka enkripsi API portal. Pengambilan jadwal otomatis hanya dilakukan melalui akses data resmi dari pengelola platform (API atau ekspor yang disetujui), bila tersedia.
- Selama akses resmi belum ada, jadwal diisi manual oleh Pengelola Pelatihan dengan tautan portal sebagai bukti, lalu diverifikasi (`schedule_source` = `manual`, `schedule_verified_by`, `schedule_verified_at`).
- Data jadwal: `registration_start`, `registration_end`, `start_date`, `end_date`. Tahun wajib diisi.
- Validasi jadwal (peringatan, bukan rule risiko):
  - batas pendaftaran tidak melewati tanggal mulai pelaksanaan;
  - periode pelaksanaan cocok dengan periode pada judul spreadsheet bila ada (tanggal dan bulan);
  - `UPDATE TERAKHIR` dan perubahan isi sheet berada dalam atau setelah periode pelaksanaan;
  - peserta baru yang muncul setelah batas pendaftaran ditandai untuk dicek;
  - periode pelatihan dipakai untuk menurunkan tahun `UPDATE TERAKHIR` (§3.3), cakupan laporan periodik (§10.2), dan rule `NOT_STARTED` (§8.2), sehingga jadwal harus terverifikasi sebelum dipakai untuk perhitungan.
- Daftar dan detail pelatihan menampilkan tautan portal, jadwal, sumber jadwal, dan status verifikasinya.

### 3.7 Tahun, tim kerja, dan ID pelatihan

Data disusun berjenjang: **tahun → tim kerja → pelatihan → sumber data** (tautan sheet dan tautan halaman pelatihan).

Tim kerja tahun 2026:

| Kode | Nama | Alias |
|---|---|---|
| `GTA` | Government Transformation Academy | ASN Digital |
| `KDD` | Keterampilan Digital Dasar | — |
| `DTA` | Digital Talent Academy | Talenta Digital |

Kunci data:

- `work_teams.id` memakai UUID sebagai primary key agar relasi tetap stabil bila nama atau alias berubah. `work_teams.code` (`GTA`, `KDD`, `DTA`) adalah kunci bisnis yang unik dan dipakai untuk parsing serta tampilan.
- Keikutsertaan tim per tahun disimpan di `work_team_years` (unik per tim dan tahun). Setiap pelatihan merujuk satu baris `work_team_years`.
- Pelatihan memakai UUID sebagai primary key. ID pelatihan portal (`portal_training_id`, misalnya `13109`) unik dan menjadi kode tampilan bersama kode tim, misalnya `DTA-13109`.

Parsing ID saat sheet dilampirkan:

| Sumber | Contoh | Hasil |
|---|---|---|
| Judul spreadsheet | `Mirror DTA VBL 13109 IAWD 23 - 30 Sept` | Tim `DTA`, ID `13109`, skema `IAWD`, periode 23–30 Sept |
| Judul spreadsheet | `MIRROR - DTA VBL 13107 OIAT 10 -31 Agustus` | Tim `DTA`, ID `13107`, skema `OIAT`, periode 10–31 Agustus |
| Tautan halaman pelatihan | `https://digitalent.komdigi.go.id/pelatihan/13109` | ID `13109` |

- Pola judul tidak konsisten (huruf besar/kecil, tanda hubung, spasi), sehingga parser dibuat toleran: kode tim dicocokkan dengan daftar `work_teams.code`, ID adalah deret angka 4–6 digit, dan skema adalah kata kapital setelah ID.
- Bila ID dari judul dan dari tautan portal berbeda, tampilkan peringatan.
- Hasil parsing hanya **usulan**. Admin wajib mengonfirmasi tahun, tim kerja, ID, nama, dan periode sebelum pelatihan disimpan (`id_confirmed_by`, `id_confirmed_at`). Tanpa konfirmasi, pelatihan tidak dapat disimpan.
- Bila ID sudah dipakai pelatihan lain, penyimpanan ditolak dan pengguna diarahkan ke pelatihan yang ada.

## 4. Struktur repository GitHub

```text
ews-ai-agent/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── security.yml
│   │   └── supabase-deploy.yml
│   ├── CODEOWNERS
│   ├── dependabot.yml
│   └── PULL_REQUEST_TEMPLATE.md
├── scripts/
│   └── affected-e2e.mjs
├── public/
│   ├── icons/
│   └── templates/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/
│   │   │   ├── trainings/
│   │   │   │   └── [id]/
│   │   │   ├── participants/
│   │   │   ├── risk-monitoring/
│   │   │   ├── pk-indicators/
│   │   │   ├── reports/
│   │   │   └── settings/
│   │   └── api/
│   │       ├── health/route.ts
│   │       └── v1/
│   │           ├── imports/route.ts
│   │           ├── sync/route.ts
│   │           ├── risks/route.ts
│   │           ├── agent/chat/route.ts
│   │           ├── reports/route.ts
│   │           └── admin/
│   │               ├── ai-providers/route.ts
│   │               └── pk-indicators/route.ts
│   ├── components/
│   │   ├── dashboard/
│   │   ├── risk/
│   │   ├── forms/
│   │   └── reports/
│   ├── modules/
│   │   ├── ingestion/
│   │   │   ├── google-sheets/
│   │   │   ├── csv/
│   │   │   ├── xlsx/
│   │   │   ├── normalization/
│   │   │   └── validation/
│   │   ├── risk-engine/
│   │   │   ├── rules/
│   │   │   ├── projection/
│   │   │   └── assessment/
│   │   ├── pk/
│   │   │   ├── extraction/
│   │   │   ├── mapping/
│   │   │   └── versioning/
│   │   ├── agent/
│   │   │   ├── providers/
│   │   │   ├── tools/
│   │   │   ├── prompts/
│   │   │   ├── retrieval/
│   │   │   └── guardrails/
│   │   ├── reporting/
│   │   │   ├── coverage/
│   │   │   ├── google-docs/
│   │   │   ├── rendering/
│   │   │   └── validation/
│   │   └── audit/
│   ├── lib/
│   │   ├── auth/
│   │   ├── supabase/
│   │   ├── security/
│   │   ├── env/
│   │   └── observability/
│   └── types/
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   ├── seed.sql
│   └── tests/
│       ├── rls.test.sql
│       └── constraints.test.sql
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   ├── fixtures/
│   └── security/
├── docs/
│   ├── architecture.md
│   ├── data-dictionary.md
│   ├── api-spec.md
│   ├── threat-model.md
│   └── deployment.md
├── .env.example
├── .gitleaks.toml
├── SECURITY.md
├── .gitignore
├── .npmrc
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── next.config.ts
└── README.md
```

### 4.1 Tanggung jawab modul

| Modul | Tanggung jawab |
|---|---|
| `ingestion` | Mengambil, mengimpor, memvalidasi, dan menormalisasi data sumber |
| `risk-engine` | Menghitung capaian, gap, tren, proyeksi, dan peringatan |
| `pk` | Mengelola ekstraksi, versi, dan pemetaan indikator PK |
| `agent` | Mengorkestrasi LLM, retrieval, tool calling, dan validasi output |
| `reporting` | Menentukan cakupan laporan per pelatihan atau per periode, mengisi template Google Docs, dan memvalidasi laporan |
| `audit` | Merekam aktivitas dan perubahan penting |

Business logic jangan diletakkan seluruhnya di `route.ts`. Route API bertugas memvalidasi request, memeriksa otorisasi, memanggil service, dan mengembalikan response.

### 4.2 Clean architecture

Setiap modul di `src/modules/<modul>/` dibagi menjadi empat lapisan. Ketergantungan hanya boleh mengarah ke dalam.

| Lapisan | Lokasi | Isi | Boleh bergantung pada |
|---|---|---|---|
| Domain | `<modul>/domain/` | Entitas, value object, dan aturan murni: rules engine, perhitungan capaian, deteksi rentang item, parser judul sheet, cakupan laporan | Tidak ada. Tanpa Next.js, Supabase, Google API, atau SDK AI |
| Application | `<modul>/application/` | Use case (misalnya `ImportSheet`, `RecalculateRisks`, `CreateReportDraft`), port (interface repository dan gateway), DTO dan skema Zod | Domain |
| Infrastructure | `<modul>/infrastructure/` | Adapter yang mengimplementasikan port: repository Supabase, Google Sheets/Drive/Docs, provider AI, Storage | Application dan domain |
| Interface | `src/app/` (route handler, Server Action, halaman) dan `src/components/` | Menerima input, memanggil use case, menampilkan hasil | Application |

Ketentuan:

- Adapter dirakit di satu composition root (`src/lib/container.ts`). Route handler dan halaman tidak membuat client Supabase atau Google sendiri.
- `route.ts` hanya melakukan parse input dengan Zod, memeriksa otorisasi, memanggil satu use case, dan memetakan hasil ke response.
- Komponen klien tidak mengakses database. Data diambil lewat Server Component atau route handler.
- Arah ketergantungan diperiksa di CI dengan `eslint-plugin-boundaries` atau `dependency-cruiser`; pelanggaran menggagalkan build.
- Folder teknis pada §4 ditempatkan di lapisan yang sesuai, misalnya `ingestion/infrastructure/google-sheets/`, `risk-engine/domain/rules/`, `agent/infrastructure/providers/`, `reporting/infrastructure/google-docs/`, dan `reporting/application/coverage/`.

Contoh satu modul:

```text
src/modules/ingestion/
├── domain/
│   ├── sheet-layout.ts          # deteksi kolom dan rentang item
│   ├── title-parser.ts          # usulan tim, ID, skema, periode
│   └── reconciliation.ts
├── application/
│   ├── ports.ts                 # SheetSource, ImportRepository
│   ├── import-sheet.ts          # use case
│   └── schemas.ts               # Zod
└── infrastructure/
    ├── google-sheets-source.ts
    └── supabase-import-repository.ts
```

### 4.3 Kriteria panjang dan kompleksitas kode

Batas berikut ditegakkan oleh Prettier dan ESLint, dan diperiksa di CI.

| Ukuran | Batas | Alat |
|---|---|---|
| Panjang baris | 100 karakter (URL, string, dan regex dikecualikan) | Prettier `printWidth: 100`, ESLint `max-len` |
| Panjang file `.ts` | 300 baris, tanpa baris kosong dan komentar | `max-lines` |
| Panjang file komponen `.tsx` | 200 baris | `max-lines` (override) |
| Panjang `route.ts` | 60 baris | `max-lines` (override) |
| Panjang file test | 400 baris | `max-lines` (override) |
| Panjang fungsi | 40 baris; komponen React 80 baris | `max-lines-per-function` |
| Kompleksitas siklomatik | 10 per fungsi | `complexity` |
| Kedalaman blok bersarang | 3 | `max-depth` |
| Jumlah parameter | 3; lebih dari itu memakai satu objek | `max-params` |
| Callback bersarang | 3 | `max-nested-callbacks` |
| Duplikasi kode | maksimal 3% | `jscpd` |

Pengecualian hanya untuk file hasil generate (misalnya tipe Supabase), migration SQL, fixture, dan konfigurasi, melalui `overrides`. Pengecualian lain memakai `eslint-disable-next-line` disertai alasan dan ditinjau saat review.

Contoh konfigurasi ESLint (flat config):

```js
// eslint.config.mjs (cuplikan)
export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "max-len": ["error", { code: 100, ignoreUrls: true, ignoreStrings: true, ignoreRegExpLiterals: true }],
      "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 40, skipBlankLines: true, skipComments: true }],
      complexity: ["error", 10],
      "max-depth": ["error", 3],
      "max-params": ["error", 3],
      "max-nested-callbacks": ["error", 3],
    },
  },
  {
    files: ["src/**/*.tsx"],
    rules: {
      "max-lines": ["error", { max: 200, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 80, skipBlankLines: true, skipComments: true }],
    },
  },
  { files: ["src/app/**/route.ts"], rules: { "max-lines": ["error", { max: 60, skipBlankLines: true }] } },
  { files: ["**/*.test.ts", "tests/**"], rules: { "max-lines": ["error", { max: 400 }], "max-lines-per-function": "off" } },
];
```

## 5. Environment dan dependency baseline

Gunakan Node.js LTS yang dipatok dan didukung versi Vercel serta dependensi. Contoh baseline awal: Node.js 22.x, TypeScript strict mode, pnpm dengan lockfile, dan build Next.js.

Dependency utama:

| Kebutuhan | Rekomendasi |
|---|---|
| Framework | Next.js App Router |
| Bahasa | TypeScript |
| Validasi | Zod |
| Database client | `@supabase/supabase-js` |
| Server-side auth | `@supabase/ssr` |
| CSV | Parser CSV yang terpelihara |
| XLSX | SheetJS atau library setara yang telah ditinjau keamanan dan lisensinya |
| Google APIs | `googleapis` |
| AI | Adapter internal dengan SDK resmi masing-masing provider |
| Unit test | Vitest |
| Browser test | Playwright |
| Database test | Supabase CLI dan pgTAP |
| Lint | ESLint |
| Format | Prettier |

Contoh scripts `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:reset": "supabase db reset",
    "db:test": "supabase test db"
  },
  "engines": {
    "node": "22.x"
  },
  "packageManager": "pnpm@10.0.0"
}
```

Versi pnpm di atas hanya contoh dan harus disesuaikan dengan versi stabil yang dipilih. Pin versi dependency dalam lockfile dan commit lockfile ke repository.

### 5.1 Environment variables

Contoh `.env.example` — hanya nama variabel, tanpa secret sungguhan:

```dotenv
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Spreadsheet ID dan gid disimpan per pelatihan di tabel data_sources, bukan di env.
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=

GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=

AI_DEFAULT_PROVIDER=
AI_DEFAULT_MODEL=
AI_ENCRYPTION_KEY=

GOOGLE_REPORT_SHARED_DRIVE_ID=
REPORT_IMAGE_URL_TTL_SECONDS=300

CRON_SECRET=
```

Aturan:

- `SUPABASE_SERVICE_ROLE_KEY`, kredensial Google, `AI_ENCRYPTION_KEY`, dan `CRON_SECRET` hanya digunakan di server.
- Jangan membuat variabel rahasia berawalan `NEXT_PUBLIC_`.
- `AI_ENCRYPTION_KEY` hanya diperlukan bila aplikasi menerapkan penyimpanan key provider terenkripsi.
- Kredensial Google OAuth dan service account merupakan alternatif sesuai model akses; tidak selalu perlu dipakai bersamaan.
- Jangan menyimpan API key provider AI dalam plaintext di tabel konfigurasi.
- Jika key pengguna perlu disimpan, gunakan secret manager atau penyimpanan terenkripsi dengan kontrol akses ketat, rotasi, dan masking.

## 6. Desain database Supabase

Gunakan PostgreSQL, UUID sebagai primary key, foreign key, timestamp, constraint, dan RLS. Tabel data peserta harus memiliki kebijakan akses eksplisit.

### 6.1 Tabel inti

| Tabel | Kolom penting / tujuan |
|---|---|
| `profiles` | `id`, `display_name`, `role`, `organization_id`, `created_at` |
| `organizations` | `id`, `name`, `code`, `created_at` |
| `work_teams` | `id` (UUID), `code` (unik: `GTA`, `KDD`, `DTA`), `name`, `alias`, `active`, `created_at` |
| `work_team_years` | `id`, `work_team_id`, `year`, `report_folder_id`, `monthly_template_id`, `annual_template_id` |
| `trainings` | `id`, `work_team_year_id`, `code`, `name`, `scheme_code`, `level`, `delivery_method`, `certification_type`, `id_confirmed_by`, `id_confirmed_at`, `registration_start`, `registration_end`, `start_date`, `end_date`, `status`, `portal_url`, `portal_training_id`, `schedule_source`, `schedule_verified_by`, `schedule_verified_at` |
| `participants` | `id`, `participant_number`, `name`, `organization_id` |
| `training_enrollments` | `id`, `training_id`, `participant_id`, `source_status`, `enrollment_status`, `onboarding_status` |
| `training_modules` | `id`, `training_id`, `catalog_version`, `catalog_status`, `module_code`, `name`, `source_name`, `module_type`, `unit_group`, `sequence`, `source_column` |
| `training_learning_plans` | `id`, `training_id`, `module_id`, `is_required`, `planned_due_date`, `origin`, `version`, `approved_by` |
| `participant_progress_snapshots` | `id`, `enrollment_id`, `completion_percentage`, `completed_items`, `total_items`, `captured_at`, `import_batch_id` |
| `participant_module_progress` | `id`, `enrollment_id`, `module_id`, `status`, `completion_percentage` (opsional), `captured_at`, `import_batch_id` |
| `import_batches` | `id`, `source_id`, `source_type`, `source_reference`, `status`, `row_counts`, `ignored_counts`, `reconciliation`, `detected_layout`, `content_hash`, `fetched_at`, `content_changed_at`, `source_updated_at`, `created_by` |
| `pk_documents` | `id`, `year`, `source_kind` (sheet/docs/pdf), `drive_file_id`, `title`, `version`, `storage_path`, `checksum`, `approval_status` |
| `pk_indicators` | `id`, `pk_document_id`, `goal_code`, `code`, `definition`, `work_team_id` (kosong = lintas tim), `indicator_type` (persentase/jumlah kumulatif/di luar EWS), `unit`, `target_value`, `baseline_value`, `polarity`, `participant_rule`, `pass_rule`, `recognized_levels`, `reporting_period`, `period_start`, `period_end`, `approval_status` |
| `pk_indicator_targets` | `id`, `pk_indicator_id`, `month`, `target_value`, `action_plan` |
| `training_indicator_mappings` | `id`, `training_id`, `pk_indicator_id`, `mapping_status`, `approved_by` |
| `risk_rule_versions` | `id`, `version`, `configuration`, `approved_by`, `effective_at` |
| `risk_assessments` | `id`, `training_id`, `indicator_id`, `status`, `score`, `evidence`, `rule_version_id`, `assessed_at` |
| `followup_actions` | `id`, `risk_assessment_id`, `description`, `owner_id`, `due_date`, `status` |
| `report_templates` | `id`, `provider`, `report_scope`, `template_reference`, `placeholders`, `version`, `status` |
| `report_assets` | `id`, `report_id`, `kind` (tabel/gambar/PDF), `storage_path`, `checksum`, `created_at` |
| `generated_reports` | `id`, `work_team_year_id`, `report_scope`, `period_start`, `period_end`, `data_cutoff_at`, `is_provisional`, `template_id`, `status`, `document_reference`, `created_by` |
| `report_trainings` | `id`, `report_id`, `training_id`, `status_at_cutoff`, `import_batch_id`, `included`, `exclusion_reason` |
| `data_sources` | `id`, `source_type`, `training_id`, `spreadsheet_id`, `gid`, `layout`, `column_mapping`, `header_aliases`, `status_mapping`, `sync_schedule`, `freshness_threshold`, `last_fetched_at`, `source_modified_at`, `enabled` |
| `sync_runs` | `id`, `source_id`, `started_at`, `finished_at`, `status`, `error_summary` |
| `audit_logs` | `id`, `actor_id`, `action`, `resource_type`, `resource_id`, `created_at` |
| `ai_provider_configs` | Konfigurasi provider/model dan referensi secret, tanpa mengembalikan key |
| `ai_usage_logs` | Provider, model, waktu, token, durasi, estimasi biaya; tanpa isi prompt sensitif |

### 6.2 Constraint dan indeks

- `completion_percentage` dibatasi 0–100.
- `target_value` harus positif untuk indikator kuantitatif dengan target positif.
- `training_enrollments` memiliki unique constraint pada pasangan `training_id` dan `participant_id`.
- `training_modules` unik pada (`training_id`, `catalog_version`, `sequence`); judul tidak dijadikan kunci karena dapat ganda.
- `participant_module_progress.status` dibatasi pada `completed`, `in_progress`, `not_started`, dan `unknown`, serta unik pada (`enrollment_id`, `module_id`, `import_batch_id`).
- `work_teams.code` unik; `work_team_years` unik pada (`work_team_id`, `year`); `trainings.portal_training_id` unik.
- `generated_reports.report_scope` dibatasi pada `training`, `monthly`, dan `annual`. Laporan `training` memiliki tepat satu baris `report_trainings`; `report_trainings` unik pada (`report_id`, `training_id`).
- Snapshot progres mereferensikan enrollment dan batch impor.
- Dokumen dan aturan yang disetujui tidak diubah diam-diam; perubahan menghasilkan versi baru.
- Assessment menyimpan bukti yang cukup untuk mereproduksi keputusan.
- Buat indeks untuk `training_id`, `participant_id`, `module_id`, `captured_at`, `pk_indicator_id`, `status`, dan kolom filter dashboard.

Gunakan tipe numerik dan aturan pembulatan yang konsisten untuk persentase capaian resmi.

### 6.3 Contoh migration SQL

Ini contoh migration awal, bukan keseluruhan skema final. Tabel `organizations` dan `import_batches` harus dibuat terlebih dahulu.

```sql
create table public.trainings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  start_date date,
  end_date date,
  status text not null default 'planned'
    check (status in (
      'planned', 'in_progress', 'completed', 'cancelled'
    )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  participant_number text not null unique,
  name text not null,
  organization_id uuid references public.organizations(id),
  created_at timestamptz not null default now()
);

create table public.training_enrollments (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings(id),
  participant_id uuid not null references public.participants(id),
  source_status text,
  created_at timestamptz not null default now(),
  unique (training_id, participant_id)
);

create table public.participant_progress_snapshots (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null
    references public.training_enrollments(id),
  completion_percentage numeric(5,2)
    check (
      completion_percentage >= 0
      and completion_percentage <= 100
    ),
  captured_at timestamptz not null default now(),
  import_batch_id uuid not null references public.import_batches(id),
  unique (enrollment_id, captured_at)
);

create index idx_enrollments_training
  on public.training_enrollments(training_id);

create index idx_progress_enrollment_time
  on public.participant_progress_snapshots(
    enrollment_id, captured_at desc
  );
```

Sebelum aplikasi dipakai, tambahkan seluruh migration, grants minimum, RLS policies, trigger waktu, constraint, dan pengujian kebijakan. RLS harus diaktifkan pada setiap tabel yang terekspos dan dikombinasikan dengan grants minimum.

## 7. Spesifikasi API

Gunakan prefix `/api/v1`. API utama menggunakan JSON, kecuali upload file menggunakan `multipart/form-data`.

### 7.1 Endpoint

| Method | Endpoint | Fungsi |
|---|---|---|
| `GET` | `/api/v1/dashboard/summary` | Ringkasan capaian dan risiko |
| `GET` | `/api/v1/trainings` | Daftar pelatihan dengan pagination |
| `GET` | `/api/v1/work-teams` | Daftar tim kerja dan tahun aktif |
| `POST` | `/api/v1/trainings/parse-source` | Usulan tim kerja, ID, skema, dan periode dari tautan sheet dan tautan portal; tidak menulis data |
| `POST` | `/api/v1/trainings` | Simpan pelatihan setelah admin mengonfirmasi tahun, tim kerja, dan ID; memeriksa tata letak sheet tanpa mengimpor |
| `PUT` | `/api/v1/trainings/:id/schedule` | Simpan jadwal pendaftaran dan pelaksanaan beserta sumber dan verifikasinya |
| `POST` | `/api/v1/trainings/:id/module-catalog/suggestions` | Minta saran AI untuk katalog item dari judul item saja; hasil berupa draf |
| `POST` | `/api/v1/trainings/:id/module-catalog/:version/approve` | Setujui versi katalog item |
| `GET` | `/api/v1/trainings/:id` | Detail pelatihan |
| `GET` | `/api/v1/trainings/:id/participants` | Peserta, progres, kategori penyelesaian, dan item belum selesai |
| `GET` | `/api/v1/trainings/:id/modules` | Ringkasan per item (selesai, belum selesai, titik berhenti) dan matriks peserta × item berpaginasi |
| `POST` | `/api/v1/imports/preview` | Validasi dan preview CSV/XLSX |
| `POST` | `/api/v1/imports/commit` | Konfirmasi dan simpan impor |
| `POST` | `/api/v1/sync/google-sheets` | Jalankan sinkronisasi sumber, terjadwal atau manual (§3.5) |
| `GET` | `/api/v1/sync/runs/:id` | Status sinkronisasi |
| `GET` | `/api/v1/risks` | Daftar penilaian risiko |
| `POST` | `/api/v1/risks/recalculate` | Hitung ulang risiko dalam scope tertentu |
| `GET` | `/api/v1/pk/indicators` | Daftar indikator PK |
| `POST` | `/api/v1/pk/indicators` | Buat indikator draft |
| `POST` | `/api/v1/pk/indicators/:id/approve` | Setujui indikator/pemetaan |
| `POST` | `/api/v1/agent/chat` | Analisis melalui AI Agent |
| `GET` | `/api/v1/reports/coverage` | Pratinjau pelatihan yang tercakup pada periode laporan beserta kesiapan datanya; tidak menulis data |
| `POST` | `/api/v1/reports/drafts` | Buat draf laporan per pelatihan, bulanan, atau tahunan |
| `POST` | `/api/v1/reports/:id/validate` | Validasi angka dan kelengkapan |
| `POST` | `/api/v1/reports/:id/publish` | Publikasi setelah persetujuan |
| `GET` | `/api/v1/admin/ai-providers` | Daftar provider tanpa secret |
| `PUT` | `/api/v1/admin/ai-providers/:id` | Atur provider/model/key dengan aman |
| `GET` | `/api/v1/admin/audit-logs` | Audit log sesuai hak akses |

Operasi lama, seperti sinkronisasi besar dan pembuatan laporan, sebaiknya membuat job dan mengembalikan `202 Accepted` beserta `job_id`. Status job dibaca melalui endpoint status.

### 7.2 Contoh request AI

```json
{
  "training_id": "UUID-PELATIHAN",
  "question": "Pelatihan mana yang berisiko tidak mencapai target?",
  "include_recommendations": true
}
```

Contoh response konseptual:

```json
{
  "request_id": "UUID-REQUEST",
  "answer": "Ditemukan risiko yang perlu ditinjau.",
  "as_of": "2026-10-28T03:00:00Z",
  "data_freshness": "current",
  "evidence": [
    {
      "indicator_code": "IKSK 3.2",
      "risk_status": "critical",
      "reason": "Proyeksi akhir di bawah target resmi.",
      "assessment_id": "UUID-ASSESSMENT"
    }
  ],
  "recommendations": [
    {
      "action": "Validasi peserta yang progresnya stagnan.",
      "requires_approval": true
    }
  ]
}
```

Response tersebut hanya contoh kontrak; nilai implementasi harus berasal dari data aktual.

### 7.3 Error response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Data impor tidak memenuhi aturan validasi.",
    "request_id": "UUID-REQUEST",
    "details": [
      {
        "field": "completion_percentage",
        "reason": "must_be_between_0_and_100"
      }
    ]
  }
}
```

Jangan menyertakan stack trace, secret, isi PK, atau PII dalam response error.

Kode status yang disarankan:

- `400` — request tidak valid.
- `401` — belum terautentikasi.
- `403` — tidak berizin.
- `404` — resource tidak ditemukan atau keberadaannya tidak boleh diungkap.
- `409` — konflik versi atau batch.
- `413` — file terlalu besar.
- `422` — gagal validasi bisnis.
- `429` — batas penggunaan terlampaui.
- `502`/`503` — kegagalan atau ketidaktersediaan provider eksternal.

### 7.4 Idempotency dan audit

Operasi impor, sinkronisasi, dan publikasi laporan harus menggunakan `idempotency_key` atau deduplikasi yang setara.

- Retry sinkronisasi tidak menggandakan peserta.
- Retry publikasi tidak membuat banyak dokumen untuk satu permintaan.
- Perubahan indikator yang disetujui menghasilkan versi baru.
- Perubahan konfigurasi mencatat aktor, waktu, dan versi sebelum/sesudah tanpa mencatat secret.

## 8. Rules engine

Rules engine terdiri dari tiga lapisan:

1. **Indicator engine:** menghitung realisasi terhadap target resmi PK.
2. **Participant engine:** menganalisis progres, kelengkapan modul, dan stagnasi.
3. **Projection engine:** memperkirakan kemungkinan pencapaian pada akhir periode.

Ketiganya jangan digabung menjadi satu skor yang tidak dapat dijelaskan.

### 8.1 Perhitungan capaian resmi

Untuk indikator kuantitatif dengan target positif:

\[
A_t = \frac{R_t}{T}\times 100\%
\]

Keterangan:

- `R_t`: realisasi yang memenuhi definisi PK sampai waktu `t`.
- `T`: target resmi untuk periode yang sama.
- `A_t`: persentase capaian aktual.

Jika indikator PK mengukur jumlah lulusan, realisasi hanya mencakup peserta yang memenuhi kriteria kelulusan resmi. Persentase progres materi bukan pengganti otomatis realisasi tersebut.

Untuk indikator **persentase** pada PK 2026 (§8.7), realisasi dihitung sebagai:

\[
P_t = \frac{\sum \text{peserta lulus (sertifikat completion)}}{\sum \text{peserta yang mengikuti pelatihan}} \times 100\%
\]

dengan "peserta yang mengikuti" mengikuti definisi tiap indikator (umumnya progres atau kehadiran ≥ 90%). Capaian terhadap target adalah \(A_t = P_t / T \times 100\%\), dan pembandingnya selama tahun berjalan adalah target antara bulan tersebut.

Untuk target kumulatif, hitung gap:

\[
G_t = R_t - T_t^{\text{rencana}}
\]

Gap negatif berarti realisasi tertinggal dari rencana, tetapi tidak otomatis berarti target akhir gagal.

### 8.2 Status risiko peserta

| Rule code | Kondisi awal | Status |
|---|---|---|
| `DATA_INVALID` | Progres di luar rentang, konflik identitas, `PERSENTASE LMS` tidak konsisten dengan status item, atau galat formula pada baris peserta | Data tidak valid |
| `DATA_STALE` | Waktu perubahan terakhir (perubahan isi atau `modifiedTime` file, §3.5) melewati batas kesegaran selama periode pelatihan | Data tidak memadai |
| `NOT_STARTED` | Belum ada item selesai setelah N hari sejak pelatihan dimulai | Waspada; kritis jika sisa periode di bawah ambang |
| `PASS_PENDING` | Peserta sudah masuk penyebut indikator persentase (mis. progres ≥ 90%), tetapi belum lulus atau belum bersertifikat mendekati akhir periode | Waspada |
| `PROGRESS_STAGNANT` | Jumlah item selesai tidak berubah antar-snapshot selama N hari | Waspada |
| `BEHIND_SCHEDULE` | Progres di bawah rencana pembelajaran | Waspada |
| `COMPLETION_AT_RISK` | Estimasi penyelesaian melewati tenggat | Kritis |
| `MODULE_INCOMPLETE` | Item wajib pada rencana belajar belum selesai mendekati tenggat | Waspada/kritis |
| `TARGET_GAP` | Realisasi indikator di bawah target kumulatif | Waspada |
| `TARGET_UNLIKELY` | Proyeksi akhir di bawah target resmi | Kritis |

Nilai `N`, jadwal, tenggat, dan ambang proyeksi harus dikonfigurasi dan divalidasi, bukan diasumsikan sebagai aturan resmi.

Sheet contoh tidak memuat jadwal, tenggat, penanda item wajib, maupun waktu aktivitas per item. Rule berbasis jadwal (`BEHIND_SCHEDULE`, `COMPLETION_AT_RISK`, `MODULE_INCOMPLETE`) hanya dinilai bila rencana belajar pelatihan (`training_learning_plans`) telah dikonfigurasi dan disetujui; jika belum, assessment menampilkan "tidak dapat dinilai", bukan "normal". `NOT_STARTED` dan `PROGRESS_STAGNANT` cukup memakai periode pelatihan dan riwayat snapshot. `NOT_STARTED` ditambahkan pada versi aturan 1.1 dan berlaku setelah disetujui Pengelola PK.

### 8.3 Contoh proyeksi peserta

Untuk progres awal `p1`, progres terbaru `p2`, dan jarak waktu `Δd`:

\[
v = \frac{p_2-p_1}{\Delta d}
\]

Jika `v > 0`, estimasi waktu menuju 100%:

\[
d_{\text{sisa}} = \frac{100-p_2}{v}
\]

Proyeksi hanya digunakan jika dua snapshot valid, interval waktu positif, dan nilainya dapat dibandingkan. Jangan menganggap laju linear pasti berlanjut. Jika data tidak memadai, tampilkan proyeksi sebagai tidak tersedia.

Pada template sheet peserta, progres `p` = item selesai ÷ item terpakai × 100 dengan bobot item yang sama, sesuai cara `PERSENTASE LMS` dihitung. Dua snapshot dengan versi katalog item yang berbeda tidak dapat dibandingkan.

### 8.4 Output assessment yang dapat diaudit

```json
{
  "rule_version": "1.0",
  "assessed_at": "2026-10-28T03:00:00Z",
  "data_snapshot_ids": ["SNAPSHOT-ID-1"],
  "status": "warning",
  "triggered_rules": ["BEHIND_SCHEDULE"],
  "metrics": {
    "actual_progress": 41,
    "planned_progress": 74,
    "gap_percentage_points": -33,
    "completed_items": 14,
    "total_items": 34,
    "stop_item": "M15"
  },
  "explanation": "Progres aktual 33 poin persentase di bawah rencana; berhenti di M15 (KUIS 1).",
  "data_quality": "valid"
}
```

Angka ini hanya ilustrasi. Implementasi harus menyimpan snapshot dan versi aturan agar assessment dapat direproduksi.

### 8.5 Test cases rules engine

- Target nol, tidak tersedia, atau negatif.
- Realisasi nol dan melampaui target.
- Peserta tanpa snapshot sebelumnya.
- Progres stagnan atau menurun akibat koreksi sumber.
- Data kedaluwarsa.
- Perubahan PK pada periode berjalan.
- Peserta terdaftar di beberapa pelatihan.
- Duplikasi dan impor ulang.
- Perbedaan zona waktu dan batas akhir periode.
- Baris tanpa identitas yang berisi nilai bawaan formula dan slot item tanpa judul.
- Judul item ganda, entitas HTML pada judul, dan perubahan katalog item antarimpor.
- `PERSENTASE LMS` tidak konsisten dengan status item.
- `STATUS` di luar pemetaan (misalnya `Pembatalan`) dan total baris 1 yang tidak cocok dengan jumlah baris.
- `UPDATE TERAKHIR` tanpa tahun di sekitar pergantian tahun.
- Galat formula (`#REF!`) dan `Cek Sync` bernilai `Error Sync`.
- Pola penyelesaian item yang tidak berurutan.
- Jumlah item lebih dari 42; `Cek Sync` dengan huruf/spasi berbeda, bergeser posisi, ganda, atau tidak ada.
- Isi sheet berubah sementara `UPDATE TERAKHIR` tidak berubah, dan sebaliknya.
- Jadwal tidak valid: batas pendaftaran melewati tanggal mulai, atau periode berbeda dengan judul spreadsheet.

Hasil harus deterministik untuk input, snapshot, dan versi rules yang sama.

### 8.6 Pemantauan detail per pelatihan dan item modul

Pemantauan ini memenuhi FR-04 PRD ("komponen yang paling tertinggal") dan menjadi dasar rekomendasi per kelompok peserta (FR-07 PRD). Datanya berasal dari status item pada snapshot terakhir yang valid.

| Metrik | Definisi |
|---|---|
| Funnel pelatihan | Pendaftar (tanpa `cancelled`) → diterima → onboarding → mulai (≥ 1 item selesai) → tuntas (semua item selesai) → lulus (`enrollment_status` = `passed`) |
| Kategori penyelesaian | `not_started` (0 item), `partial` (sebagian item), `completed` (semua item) |
| Selesai per item | Jumlah peserta berstatus `completed` pada item tersebut |
| Belum selesai per item | Jumlah peserta dalam penyebut dikurangi yang selesai |
| Titik berhenti | Item pertama yang belum selesai, untuk peserta kategori `partial` |
| Item belum selesai per peserta | Daftar item berstatus selain `completed`, sesuai urutan |
| Perubahan sejak snapshot sebelumnya | Jumlah item yang baru selesai sejak sinkronisasi sebelumnya |

Ketentuan:

- Peserta berbendera `DATA_INVALID` tetap ditampilkan, tetapi dihitung terpisah sebagai "perlu dicek" dan tidak masuk penyebut sampai datanya diperbaiki.
- Titik berhenti mengasumsikan penyelesaian berurutan, seperti pada kedua sheet contoh. Jika ada item yang dilewati, tampilkan item pertama yang belum selesai beserta jumlah item yang dilewati.
- Funnel dan penyelesaian item adalah indikator awal. Realisasi indikator PK tetap memakai status kelulusan resmi (§8.1).
- Tampilan berada pada halaman detail pelatihan (`trainings/[id]`, tab Modul dan Peserta) dan detail peserta, tanpa menambah menu utama.
- Daftar peserta dan matriks peserta × item hanya tampil untuk role yang berwenang (NFR-03 PRD); role lain melihat agregat per item.

### 8.7 Indikator PK 2026 dan pemetaan tim kerja

Sumber: folder `PK/2026` berisi spreadsheet `PK` (tabel terstruktur), dan manual `PK_2026` dalam Google Docs dan PDF (26 halaman). Indikator yang relevan untuk EWS:

| Indikator | Target 2026 | Baseline | Tim kerja | Yang mengikuti (penyebut) | Yang lulus (pembilang) | Target antara |
|---|---|---|---|---|---|---|
| IKSK 1.1 Persentase peserta pelatihan SDM bidang komdigi yang bertalenta digital (DEX dan VBL non-sertifikasi) | 87% | 87% | DTA | Progres ≥ 90% | Lulus dan bersertifikat completion | Januari–April 0%, Mei–Desember 87% |
| IKSK 2.1 Persentase peserta pelatihan SDM aparatur bidang komdigi yang bertalenta digital | 99% | 99% | GTA | *Live session*: hadir ≥ 90% JP sinkron. *Self-paced*: ≥ 90% aktivitas LMS | *Live session*: absen ≤ 10% dan nilai akhir ≥ 65 (pre-test, penugasan, post-test). *Self-paced*: seluruh aktivitas LMS selesai | Januari–Maret 0%, April–Desember 99% |
| IKSK 3.1 Persentase peserta pelatihan keterampilan dasar yang mengalami peningkatan keterampilan digital (termasuk microskill) | 95% | 95% | KDD | Mengikuti ≥ 90% kegiatan | Post-test ≥ 60, tugas atau proyek untuk tema tertentu; microskill sesuai ketentuan masing-masing | Januari–Maret 0%, April–Desember 95% |
| IKSK 3.2 Jumlah peserta pelatihan SDM bidang komdigi yang bertalenta digital (kumulatif) | 78.319 | 54.969 | Lintas tim (DTA, GTA, KDD) | — | Capaian 2025 ditambah peserta yang menyelesaikan pelatihan 2026 | Kumulatif bulanan, misalnya Oktober 75.969 dan November 78.319 |

IKSK 4.1–4.4 (temuan dan tindak lanjut BPK, nilai kinerja anggaran, kualitas laporan keuangan UAKPA) bukan indikator pelatihan dan tidak dipantau EWS.

Ketentuan perhitungan:

- Untuk IKSK 1.1, pelatihan dihitung sebagai capaian satker UPT hanya pada **level Basic**; level Intermediate dan Advanced diakui oleh Pusbang Talenta Digital. VBL yang dihitung adalah VBL **non-sertifikasi**. Karena itu setiap pelatihan menyimpan `level`, `delivery_method` (live, self-paced, blended), dan `certification_type`.
- Pada sheet template DTA, "mengikuti" diturunkan dari `PERSENTASE LMS` ≥ 90, dan "lulus" dari `STATUS` = `Lulus Pelatihan - Nilai`. Pada kedua sheet contoh hasilnya 33/33 dan 45/45 (100%). Format sheet GTA dan KDD belum diverifikasi; pemetaannya dikonfigurasi per sumber.
- Ada dua jalur peringatan: indikator persentase (IKSK 1.1, 2.1, 3.1) dipengaruhi peserta yang sudah masuk penyebut tetapi belum lulus (`PASS_PENDING`), sedangkan indikator jumlah (IKSK 3.2) dipengaruhi peserta yang belum menyelesaikan pelatihan (`NOT_STARTED`, `PROGRESS_STAGNANT`, `COMPLETION_AT_RISK`).
- Target antara bulanan dipakai sebagai rencana kumulatif \(T_t^{rencana}\) untuk `TARGET_GAP` dan `TARGET_UNLIKELY`.
- Sumber realisasi resmi menurut PK adalah laporan pelaksanaan pelatihan dan dashboard Metabase (`metabase.sdmdigital.id`). Angka EWS adalah estimasi dini dan dicocokkan dengan Metabase setiap periode pelaporan; selisihnya ditampilkan.
- Kriteria lulus dan penyebut disimpan per indikator sebagai data berversi yang disetujui Pengelola PK, bukan ditanam di kode.

## 9. AI Agent multi-provider

### 9.1 Provider adapter

Jangan membuat tiga Agent terpisah. Gunakan satu antarmuka internal dengan adapter per provider.

```ts
export type AIProviderId =
  | "gemini"
  | "anthropic"
  | "openai";

export interface AgentRequest {
  systemInstructions: string;
  userMessage: string;
  context: Record<string, unknown>;
  maxOutputTokens: number;
}

export interface AgentResponse {
  text: string;
  provider: AIProviderId;
  model: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface AIProvider {
  generate(
    request: AgentRequest
  ): Promise<AgentResponse>;
}
```

Ini adalah kontrak internal awal; implementasi final perlu mendukung tool calling, validasi output, timeout, dan penanganan error.

Struktur adapter:

```text
src/modules/agent/providers/
├── provider.interface.ts
├── provider-factory.ts
├── gemini.provider.ts
├── anthropic.provider.ts
├── openai.provider.ts
└── provider-errors.ts
```

### 9.2 Siklus kerja Agent

1. Terima pertanyaan; validasi sesi, role, dan ruang lingkup.
2. Ambil assessment, snapshot, indikator PK, dan sumber yang diizinkan.
3. Pilih tool yang sesuai.
4. Backend memvalidasi argumen dan otorisasi sebelum tool dijalankan.
5. LLM merangkum hasil dan rekomendasi.
6. Validasi format, referensi bukti, dan klaim yang tidak didukung.
7. Simpan audit provider, model, waktu, pemakaian token, dan referensi assessment.

### 9.3 Tools Agent

| Tool | Fungsi |
|---|---|
| `get_training_summary` | Ringkasan capaian satu pelatihan, termasuk funnel, ringkasan per item, dan titik berhenti |
| `get_risk_list` | Daftar risiko hasil rules engine |
| `get_participant_progress` | Progres dan item belum selesai sesuai hak akses, dengan pseudonim peserta |
| `get_pk_indicator` | Definisi indikator PK yang berlaku |
| `calculate_target_projection` | Proyeksi berdasarkan parameter tervalidasi |
| `create_followup_draft` | Draf tindak lanjut |
| `generate_report_draft` | Draf laporan per pelatihan, bulanan, atau tahunan berdasarkan data yang diizinkan |
| `suggest_module_catalog` | Saran pengelompokan unit, jenis item, dan item wajib dari judul item saja; hasil berupa draf yang perlu persetujuan |

Jangan memberi Agent SQL bebas atau akses penuh database. Semua tool harus memvalidasi input, otorisasi, pagination, dan hasil.

### 9.4 Retrieval dokumen PK

Untuk MVP:

1. Simpan PDF asli di storage privat.
2. Ekstrak teks dan metadata halaman; gunakan OCR bila diperlukan.
3. Simpan hasil ekstraksi sebagai teks yang dapat dicari.
4. Hubungkan setiap bagian dengan dokumen, versi, dan halaman.
5. Ambil bagian relevan berdasarkan indikator yang ditanyakan.
6. Sertakan referensi halaman dalam jawaban AI.

Jika pencarian teks sederhana tidak cukup, tambahkan PostgreSQL full-text search atau `pgvector`. AI boleh menyarankan pemetaan indikator, tetapi hanya pemetaan yang telah diverifikasi dan disetujui yang digunakan untuk perhitungan resmi.

Pembacaan PK per tahun:

1. Sistem membaca folder `PK/<tahun>` di Drive melalui service account, mencatat checksum setiap file, dan membuat versi baru bila file berubah.
2. **Spreadsheet `PK` adalah sumber utama** dan dibaca secara deterministik (kode sasaran, kode indikator, definisi, target, baseline, satuan, metode pengukuran, periode pelaporan). Spreadsheet ini perlu dilengkapi untuk semua indikator; pada contoh 2026 baru IKSK 1.1 yang terisi.
3. AI membaca manual (Docs/PDF) untuk mengusulkan bagian yang belum ada di spreadsheet: definisi "mengikuti" dan "lulus", target antara bulanan, level yang diakui, dan pemetaan tim kerja. Pemetaan diusulkan dari kata kunci definisi: *aparatur* → GTA, *keterampilan digital dasar / microskill* → KDD, *DEX / VBL* → DTA, *kumulatif semua jenis pelatihan* → lintas tim, *BPK / anggaran / laporan keuangan* → di luar EWS. Setiap usulan menyertakan rujukan halaman.
4. Rumus di manual tersimpan sebagai objek persamaan, sehingga hasil ekstraksi teks PDF tidak terbaca. Rumus diambil dari spreadsheet atau dari bagian "Keterangan Metode Pengukuran", lalu dikonfirmasi Pengelola PK.
5. Pengelola PK menyetujui setiap indikator, target antara, kriteria, dan pemetaan. Rules engine hanya memakai versi yang disetujui.
6. Folder PK sebaiknya tidak dibagikan publik; aksesnya cukup untuk service account dan pengelola.

### 9.5 Pengaturan provider

UI administrasi minimal menyediakan:

- Provider aktif dan model.
- Status koneksi.
- Batas output token.
- Timeout dan retry.
- Batas biaya/pemakaian.
- Tanggal rotasi key.
- Status validasi konfigurasi.

API key tidak boleh ditampilkan kembali secara utuh. Validasi key baru dengan request terbatas sebelum mengaktifkannya. Jangan mengirim semua data peserta atau seluruh dokumen PK ke provider pada setiap pertanyaan. Peserta dikirim ke provider dengan pseudonim, bukan nama atau nomor registrasi (NFR-03 PRD).

---

## 10. Integrasi Google Docs

### 10.1 Alur pembuatan laporan

1. Pengguna memilih jenis laporan (per pelatihan, bulanan, atau tahunan), periode, dan template Google Docs. Untuk laporan periodik, sistem menampilkan pelatihan yang tercakup beserta kesiapan datanya (§10.2).
2. Backend mengambil statistik, data pelaksanaan, indikator PK relevan, dan assessment risiko per tanggal batas data untuk setiap pelatihan yang tercakup.
3. Sistem membuat objek data laporan tervalidasi.
4. AI menyusun narasi berdasarkan fakta yang tersedia.
5. Google Docs API mengisi placeholder pada salinan template.
6. Sistem memvalidasi angka, kelengkapan bagian, dan referensi. Untuk laporan periodik, total harus sama dengan jumlah per pelatihan, dan setiap pelatihan harus merujuk batch impornya.
7. Pengguna meninjau draf dan menyetujui publikasi.

### 10.2 Jenis dan cakupan laporan

| Jenis | Periode | Pelatihan yang tercakup | Tanggal batas data |
|---|---|---|---|
| Per pelatihan | Periode pelatihan | Satu pelatihan | Akhir periode pelatihan, atau waktu pembuatan bila pelatihan masih berjalan |
| Bulanan | Satu bulan kalender | Semua pelatihan yang periodenya beririsan dengan bulan tersebut, baik yang sudah selesai maupun yang masih berjalan | Akhir bulan, atau waktu pembuatan bila bulan belum berakhir |
| Tahunan | Satu tahun, mengikuti periode PK | Semua pelatihan yang periodenya beririsan dengan tahun tersebut | Akhir tahun, atau waktu pembuatan bila tahun belum berakhir |

Ketentuan laporan periodik:

- Laporan bulanan dan tahunan dibuat **per tim kerja**. Cakupannya adalah pelatihan milik tim kerja tersebut pada periode laporan.
- Status setiap pelatihan ditentukan per tanggal batas data: selesai, berjalan, atau direncanakan. Pelatihan yang direncanakan atau dibatalkan tidak masuk perhitungan, tetapi disebutkan pada catatan cakupan.
- Pelatihan yang masih berjalan ditampilkan dengan funnel dan penyelesaian item (§8.6) dan diberi label **sementara**. Pesertanya belum dihitung sebagai realisasi lulusan.
- Lulusan dihitung final hanya bila `enrollment_status` peserta sudah terisi. Pelatihan yang sudah berakhir tetapi status kelulusannya belum terisi ditandai "menunggu status kelulusan".
- Setiap pelatihan memakai snapshot valid terakhir yang tidak melewati tanggal batas data. Pelatihan tanpa snapshot valid atau dengan `DATA_STALE` tetap tercantum dengan tanda data tidak memadai, tidak dikeluarkan diam-diam.
- Pengguna dapat mengecualikan pelatihan dari cakupan dengan alasan tertulis. Pengecualian dicantumkan di laporan dan tercatat di audit log.
- Agregat lintas pelatihan dihitung dari jumlah, misalnya total peserta tuntas ÷ total peserta valid, bukan rata-rata persentase per pelatihan.
- Pelatihan yang melewati dua bulan muncul di laporan kedua bulan. Untuk mencegah hitung ganda, lulusan dicatat pada bulan tanggal selesai pelatihan. Aturan ini harus dikonfirmasi terhadap definisi realisasi pada PK.
- Laporan bulanan menampilkan realisasi indikator PK kumulatif sampai tanggal batas data terhadap rencana kumulatif (§8.1), ditambah kontribusi bulan tersebut. Laporan tahunan menampilkan capaian akhir periode PK. Kontribusi hanya berasal dari pelatihan dengan pemetaan indikator yang disetujui.
- Laporan untuk periode yang belum berakhir diberi label sementara pada dokumen dan metadatanya (`is_provisional`).
- Pembuat laporan periodik harus berwenang atas setiap pelatihan yang tercakup; otorisasi diperiksa per pelatihan di server.

Contoh request draf laporan bulanan:

```json
{
  "report_scope": "monthly",
  "period": "2026-10",
  "template_id": "UUID-TEMPLATE-BULANAN",
  "excluded_trainings": [],
  "idempotency_key": "UUID-PERMINTAAN"
}
```

### 10.3 Template dan isi laporan

Template yang disediakan (A4 tegak, kop surat BPSDM Komdigi · BPSDMKOMDIGI Yogyakarta di header, isi Arial spasi 1,5 rata kiri-kanan):

| Jenis | Dokumen template | Placeholder |
|---|---|---|
| Bulanan | `1U0OliACRPKCughuWex3RGxwJieXOjUACX_oiOPLQxnU` | `{{Nama_Program}}`, `{{MM_month}}`, `{{YY_year}}`, `{{Detail_Laporan}}` |
| Tahunan | `1qMGuESTtjpFn5Dfp5wUqdDzBNTVJEnZ_vEHKbydMbPk` | `{{Nama_Tim_Kerja}}`, `{{YY_year}}`, `{{Detail_Laporan}}` |
| Per pelatihan | Belum tersedia | Memakai data pada daftar di bawah |

Judul dokumen: bulanan "Laporan Pelatihan {{Nama_Program}} bulan {{MM_month}} TA. {{YY_year}}"; tahunan "Laporan Tim Kerja {{Nama_Tim_Kerja}} TA. {{YY_year}}".

Aturan nilai:

- `{{Nama_Program}}` dan `{{Nama_Tim_Kerja}}`: nama tim kerja (untuk sementara keduanya sama).
- `{{MM_month}}`: nama bulan bahasa Indonesia, Januari–Desember.
- `{{YY_year}}`: tahun empat digit, misalnya 2026.
- `{{Detail_Laporan}}`: seluruh isi laporan, disusun sistem dengan bagian berikut.

| Bagian `{{Detail_Laporan}}` | Isi |
|---|---|
| A. Ringkasan | Narasi singkat periode, jumlah pelatihan, peserta, dan lulusan |
| B. Rincian per pelatihan | Tabel: kode, nama, periode, status per batas data, peserta, tuntas, lulus, batch impor, catatan data |
| C. Capaian indikator PK | Tabel: indikator, target, realisasi kumulatif, rencana, gap, kontribusi periode |
| D. Temuan dan kendala | Narasi dan gambar grafik (funnel, titik berhenti per item) |
| E. Tindak lanjut | Daftar tindak lanjut beserta PIC dan status |
| F. Catatan data | Tanggal batas data, label sementara, pengecualian beserta alasan |
| G. Pernyataan kepatuhan | Teks berversi (§11.3) |

Mekanisme pengisian:

1. **Salin** template dengan `drive.files.copy` ke folder tim kerja dan tahun di Shared Drive (`work_team_years.report_folder_id`). Template asli tidak pernah diubah.
2. **Ganti placeholder sederhana** dengan `documents.batchUpdate` → `replaceAllText` (peka huruf besar/kecil).
3. **Isi `{{Detail_Laporan}}`:** baca dokumen salinan, cari paragraf yang memuat placeholder, hapus teksnya, lalu sisipkan isi secara berurutan: `insertText` dengan gaya judul untuk subjudul, paragraf dengan gaya paragraf template, `insertTable` lalu isi sel untuk tabel, dan `insertInlineImage` untuk gambar.
4. **Gambar:** grafik dibuat di server dari data agregat saja, tanpa nama atau nomor registrasi peserta. File PNG disimpan di Storage (`report_assets`), lalu disisipkan melalui signed URL berumur pendek (misalnya 5 menit). Google mengambil gambar dari URL tersebut, sehingga endpoint Storage harus dapat dijangkau internet melalui HTTPS.
5. **Validasi:** baca ulang dokumen; tidak boleh ada `{{` yang tersisa; angka harus cocok dengan data laporan; semua bagian A–G ada.
6. **Arsip:** ekspor PDF dengan `drive.files.export` dan simpan di Storage sebagai versi.
7. **Persetujuan:** status mengikuti §10.4.

Data yang dipakai di dalam `{{Detail_Laporan}}` dan pada laporan per pelatihan:

```text
{{training_name}}
{{training_period}}
{{training_location}}
{{participant_count}}
{{completed_count}}
{{completion_rate}}
{{pk_indicator}}
{{pk_target}}
{{pk_actual}}
{{achievement_rate}}
{{main_findings}}
{{identified_constraints}}
{{follow_up_recommendations}}
{{report_generated_at}}
```

Placeholder dipetakan ke skema data tervalidasi. Jika field tidak tersedia, tandai untuk dilengkapi; jangan mengarang isi. `identified_constraints` dapat disusun dari ringkasan item (§8.6), misalnya jumlah peserta yang belum mulai dan titik berhenti terbanyak, dengan referensi batch impor.

Perbedaan penting:

- `completion_rate`: tingkat penyelesaian pelatihan berdasarkan definisi operasional yang disetujui.
- `achievement_rate`: capaian terhadap target indikator PK.

Keduanya tidak identik tanpa dasar definisi resmi.

Data tambahan untuk laporan periodik (dipakai di dalam `{{Detail_Laporan}}`, bukan sebagai placeholder template):

```text
{{report_scope}}
{{report_period}}
{{data_cutoff}}
{{training_count}}
{{training_completed_count}}
{{training_ongoing_count}}
{{participant_total}}
{{graduate_total}}
{{training_table}}
{{pk_summary_table}}
{{module_bottlenecks}}
{{disclaimer}}
```

`{{training_table}}` dan `{{pk_summary_table}}` diisi sebagai tabel melalui Google Docs API, satu baris per pelatihan atau per indikator, bukan teks bebas. Kolom minimal `training_table`: kode, nama, periode, status per tanggal batas data, peserta, tuntas, lulus, batch impor, dan catatan data. `{{module_bottlenecks}}` berisi titik berhenti terbanyak per pelatihan yang masih berjalan (§8.6). Placeholder naratif (`main_findings`, `identified_constraints`, `follow_up_recommendations`) tetap dipakai dan harus merujuk pelatihan sumbernya. `{{disclaimer}}` berisi pernyataan kepatuhan (§11.3) dan dipakai pada semua jenis laporan.

### 10.4 Keamanan Google Docs

- Simpan OAuth refresh token atau kredensial integrasi hanya di server.
- Service account tidak memiliki kuota penyimpanan Drive sendiri. Salinan laporan dibuat di **Shared Drive** instansi dengan service account sebagai anggota (peran Content manager), atau atas nama akun pengguna melalui OAuth.
- Gunakan scope minimum: `https://www.googleapis.com/auth/drive.file` dan `https://www.googleapis.com/auth/documents`. Template dibagikan ke service account dengan akses baca.
- Template saat ini dapat diekspor tanpa login. Template tidak berisi data pribadi, tetapi aksesnya sebaiknya dibatasi agar perubahan template terkendali.
- Gunakan akses minimum terhadap dokumen yang diperlukan.
- Buat salinan template agar template asli tidak berubah.
- Simpan Drive file ID, versi template, pembuat, dan waktu pembuatan.
- Jangan membuat dokumen hasil dapat diakses publik secara otomatis.
- Jangan mencatat token OAuth atau isi dokumen lengkap dalam log.
- Gunakan status laporan: `draft`, `validated`, `pending_approval`, `approved`, `published`, `failed`.

Untuk MVP, pembuatan laporan dilakukan on demand, bukan setiap kali data diperbarui. Laporan bulanan dan tahunan juga dibuat on demand; penjadwalan otomatis berada di luar MVP.

## 11. Security baseline dan threat model

Gunakan OWASP ASVS dan OWASP API Security Top 10 sebagai acuan verifikasi aplikasi dan API.

| Risiko | Mitigasi |
|---|---|
| Akses data peserta tanpa izin | RBAC, scope/ownership check, RLS, tes BOLA |
| Kebocoran API key | Secret management server-side, masking, rotasi, secret scanning |
| Prompt injection dari PDF/sheet | Perlakukan dokumen sebagai data tidak tepercaya; batasi tools dan izin |
| SQL injection | Query terparameterisasi; hindari SQL dinamis dari input pengguna |
| Upload berbahaya | Batas ukuran, validasi MIME/struktur, parser aman, staging |
| Penyalahgunaan API | Rate limit, pagination, batas biaya, timeout, batas request |
| XSS dari teks sumber | Output encoding dan sanitasi sesuai konteks |
| Kebocoran log | Redaksi PII, secret, prompt sensitif, dan isi dokumen |
| SSRF melalui URL sumber | Allowlist domain, validasi URL, batas redirect, blok jaringan internal |
| Sheet sumber dapat diakses publik | Akses baca melalui service account; cabut akses "siapa saja yang memiliki link"; beri peringatan bila sumber data riil dapat dibaca tanpa autentikasi |
| Perubahan aturan tanpa persetujuan | Versioning, audit trail, approval workflow |
| Ketergantungan provider AI | Timeout, fallback terbatas, rules engine tetap berfungsi |

### 11.1 Role awal

- **Admin:** pengguna, sumber data, provider AI, konfigurasi.
- **Pengelola PK:** dokumen, indikator, pemetaan, persetujuan aturan.
- **Pengelola pelatihan:** pelatihan, impor, tindak lanjut, draf laporan.
- **Viewer/Pimpinan:** membaca dashboard dan laporan sesuai kewenangan.

Role harus diverifikasi di server. Nilai role dari browser tidak boleh menjadi dasar otorisasi.

### 11.2 Kepatuhan Indonesia

Regulasi dan standar yang perlu ditelaah:

- **UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi:** dasar pemrosesan, tujuan, pembatasan akses, retensi, dan pengamanan data. Sheet contoh memuat peserta berusia 16–17 tahun; data anak merupakan data pribadi yang bersifat spesifik (Pasal 4 ayat (2)) dan pemrosesannya memerlukan persetujuan orang tua atau wali (Pasal 25).
- **PP No. 71 Tahun 2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik:** keandalan dan keamanan sistem elektronik.
- **Perpres No. 95 Tahun 2018 tentang SPBE:** tata kelola dan keamanan sistem pemerintahan elektronik.
- **Perpres No. 39 Tahun 2019 tentang Satu Data Indonesia:** standar data, metadata, interoperabilitas, dan tata kelola.
- **OWASP ASVS dan OWASP API Security Top 10:** kontrol keamanan aplikasi dan API.

Daftar ini adalah baseline, bukan bukti kepatuhan otomatis. Periksa juga aturan internal instansi, klasifikasi informasi, ketentuan cloud, lokasi pemrosesan, perjanjian pemrosesan data, dan transfer data lintas negara. Sebelum data operasional digunakan, minta penilaian dari pengelola data, keamanan informasi, dan fungsi hukum instansi.

### 11.3 Pernyataan kepatuhan (disclaimer)

Aplikasi menampilkan pernyataan kepatuhan yang singkat dan konsisten. Draf teks:

> Aplikasi ini dirancang dan dioperasikan dengan mengacu pada UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi, PP No. 71 Tahun 2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik, Perpres No. 95 Tahun 2018 tentang Sistem Pemerintahan Berbasis Elektronik, Perpres No. 39 Tahun 2019 tentang Satu Data Indonesia, serta kebijakan internal instansi. Data peserta hanya digunakan untuk pemantauan dan pelaporan pelatihan, diakses sesuai kewenangan, dan tidak dikirim ke penyedia AI dalam bentuk yang mengidentifikasi peserta. Status risiko dan rekomendasi AI adalah alat bantu; keputusan tetap berada pada petugas yang berwenang.

Penempatan:

- Halaman login (teks lengkap) dan tautan "Pernyataan kepatuhan" di bagian bawah setiap halaman.
- Formulir tambah pelatihan dan impor, berupa konfirmasi bahwa pengunggah memiliki dasar pemrosesan data peserta, termasuk persetujuan orang tua atau wali untuk peserta anak.
- Panel AI Agent, berupa catatan bahwa AI tidak menetapkan angka capaian.
- Dokumen laporan melalui `{{disclaimer}}`.

Teks disimpan berversi agar perubahan tercatat. Pernyataan ini bukan bukti kepatuhan otomatis; teks final wajib ditinjau fungsi hukum dan pengelola data instansi sebelum digunakan.

### 11.4 Security hardening

Kendali hardening dikelola di dokumen terpisah `security_hardening_ews_ai_agent.md`, dengan target **OWASP ASVS Level 2**, OWASP API Security Top 10 (2023), OWASP Top 10, dan OWASP Top 10 for LLM Applications (2025). Dokumen itu memuat ID kontrol, cara verifikasi, status, bukti, gerbang rilis, log hardening, dan risiko tersisa. Setiap PR yang menyentuh aspek keamanan memperbarui status kontrol dan log hardening di dokumen tersebut.

---

## 12. CI/CD GitHub Actions, Supabase, dan Vercel

### 12.1 Pipeline

| Tahap | Pemicu | Isi | Wajib lulus untuk merge |
|---|---|---|---|
| Quality | Setiap PR dan push ke `main` | Lint (termasuk §4.3 dan batas lapisan §4.2), type-check, unit test dengan coverage, cek duplikasi | Ya |
| Integration | Setiap PR | Supabase lokal (reset, migration, pgTAP termasuk RLS), integration test use case dan API | Ya |
| Build | Setiap PR | `pnpm build` | Ya |
| E2E sesuai cakupan | Setiap PR yang mengubah kode aplikasi | Playwright hanya untuk fitur yang terdampak (§12.7) | Ya |
| Security | Setiap PR, push ke `main`, dan mingguan | CodeQL, dependency review, pemindaian secret, audit dependensi | Ya |
| Preview | Setiap PR | Vercel Preview dengan Supabase preview berdata sintetis | — |
| E2E penuh | Malam hari, label `e2e:full`, dan sebelum rilis produksi | Seluruh suite Playwright | Ya untuk rilis |
| Produksi | Merge ke `main` + persetujuan environment `production` | Migration Supabase terlebih dahulu (kompatibel ke belakang), lalu deploy aplikasi | — |
| Pascadeploy | Setelah deploy | Smoke test `@smoke` dan `GET /api/health` | — |

### 12.2 Workflow GitHub Actions

Semua action dipin ke full commit SHA (komentar menyebut versinya) dan diperbarui oleh Dependabot. Nilai dari event GitHub tidak disisipkan langsung ke perintah `run`; nilai dilewatkan melalui `env`.

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      e2e_full:
        type: boolean
        default: false

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@<SHA> # v4
      - uses: pnpm/action-setup@<SHA> # v4
      - uses: actions/setup-node@<SHA> # v4
        with:
          node-version: 22.x
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test:unit --coverage
      - run: pnpm check:duplication

  integration:
    needs: quality
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@<SHA> # v4
      - uses: pnpm/action-setup@<SHA> # v4
      - uses: actions/setup-node@<SHA> # v4
        with:
          node-version: 22.x
          cache: pnpm
      - uses: supabase/setup-cli@<SHA> # v1
        with:
          version: <versi-cli-yang-dipin>
      - run: pnpm install --frozen-lockfile
      - run: supabase start -x studio,imgproxy,edge-runtime
      - run: supabase db reset
      - run: supabase test db
      - run: pnpm test:integration

  build:
    needs: quality
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@<SHA> # v4
      - uses: pnpm/action-setup@<SHA> # v4
      - uses: actions/setup-node@<SHA> # v4
        with:
          node-version: 22.x
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build

  e2e:
    needs: [integration, build]
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@<SHA> # v4
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@<SHA> # v4
      - uses: actions/setup-node@<SHA> # v4
        with:
          node-version: 22.x
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - id: scope
        env:
          BASE_SHA: ${{ github.event.pull_request.base.sha || github.event.before }}
          FULL: ${{ inputs.e2e_full || contains(github.event.pull_request.labels.*.name, 'e2e:full') }}
        run: node scripts/affected-e2e.mjs >> "$GITHUB_OUTPUT"
      - if: steps.scope.outputs.grep != ''
        uses: supabase/setup-cli@<SHA> # v1
        with:
          version: <versi-cli-yang-dipin>
      - if: steps.scope.outputs.grep != ''
        run: |
          supabase start -x studio,imgproxy,edge-runtime
          supabase db reset
          pnpm exec playwright install --with-deps chromium
      - if: steps.scope.outputs.grep != ''
        env:
          GREP: ${{ steps.scope.outputs.grep }}
        run: pnpm test:e2e --grep "$GREP"
      - if: failure()
        uses: actions/upload-artifact@<SHA> # v4
        with:
          name: playwright-report
          path: playwright-report
          retention-days: 7
```

`.github/workflows/security.yml`:

```yaml
name: Security
on:
  pull_request:
  push:
    branches: [main]
  schedule:
    - cron: "0 22 * * 0"

permissions:
  contents: read

jobs:
  codeql:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
      actions: read
    steps:
      - uses: actions/checkout@<SHA> # v4
      - uses: github/codeql-action/init@<SHA> # v3
        with:
          languages: javascript-typescript
          queries: security-extended
      - uses: github/codeql-action/analyze@<SHA> # v3

  dependency-review:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<SHA> # v4
      - uses: actions/dependency-review-action@<SHA> # v4
        with:
          fail-on-severity: high

  secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<SHA> # v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@<SHA> # v2
        env:
          GITLEAKS_CONFIG: .gitleaks.toml

  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<SHA> # v4
      - uses: pnpm/action-setup@<SHA> # v4
      - run: pnpm audit --audit-level=high
```

`.gitleaks.toml` menambahkan aturan khusus untuk pola `NO REGISTRASI` (`\d{12}-\d{1,2}`) di luar folder fixture sintetis, agar data peserta riil tidak ikut ter-commit. Untuk repositori milik organisasi, `gitleaks-action` memerlukan lisensi; alternatifnya memakai secret scanning bawaan GitHub (§12.6).

`.github/workflows/supabase-deploy.yml` berjalan setelah merge ke `main`, memakai environment `production` dengan persetujuan reviewer, menjalankan `supabase link` lalu `supabase db push` dengan `SUPABASE_ACCESS_TOKEN` dan `SUPABASE_DB_PASSWORD` dari secret environment. Aplikasi di-deploy oleh integrasi Git Vercel setelah migration selesai. Migration wajib kompatibel ke belakang (pola expand-contract) agar urutan ini aman.

### 12.3 Database deployment

Pilihan:

- **Supabase GitHub integration:** lebih sederhana.
- **Supabase CLI di GitHub Actions:** kontrol lebih eksplisit atas migration, pemeriksaan status, dan approval.

Rekomendasi untuk MVP: Supabase CLI agar migration diuji lokal sebelum diterapkan ke proyek tujuan.

Ketentuan:

- Semua perubahan schema melalui migration di Git.
- Jangan mengubah schema produksi manual tanpa merekonsiliasi perubahan ke migration.
- Pisahkan proyek development dan proyek deployment.
- Gunakan data sintetis untuk integration test.
- Simpan access token, database password, dan secret deployment di GitHub Secrets/environment secrets.
- Jangan menjalankan migration destruktif tanpa review.
- Siapkan backup dan prosedur pemulihan.
- Jika Supabase branching tidak tersedia pada paket yang dipilih, gunakan database lokal untuk CI dan proyek staging terpisah.

### 12.4 Environment

| Environment | Sumber data | Secret | Penggunaan |
|---|---|---|---|
| Local | Fixture sintetis | `.env.local` lokal | Pengembangan |
| CI | Database lokal dan mock provider | Secret minimum | Verifikasi otomatis |
| Preview | Data sintetis atau anonim | Secret preview terpisah | Uji penerimaan |
| Prototipe produksi | Sumber yang disetujui | Secret terpisah | Validasi terbatas |

Jangan menghubungkan preview deployment ke database produksi dengan hak akses penuh. Persetujuan keamanan diperlukan sebelum prototipe menggunakan data peserta riil.

### 12.5 Topologi deployment

| Tahap | Aplikasi | Database, Auth, Storage | Data | Catatan |
|---|---|---|---|---|
| Lokal | `next dev` | `supabase start` (Docker: Postgres, Auth, Storage, Studio) | Sintetis | MinIO opsional sebagai backend Storage lokal. ngrok hanya untuk demo sementara: domain tetap, proteksi login atau IP, dan hanya aplikasi yang dibuka; Postgres, Studio, dan MinIO console tidak dibuka. |
| Preview / prototipe | Vercel | Supabase Cloud, region Singapura (`ap-southeast-1`) | Sintetis atau anonim | Paling mudah disetel. Fungsi Vercel diarahkan ke region `sin1` agar dekat dengan database. |
| Produksi, pilihan A (disarankan untuk data riil) | Next.js (output `standalone`) di Docker pada server instansi atau PDN | Supabase self-host di Docker, Storage dengan backend MinIO | Riil | Domain `.go.id` dengan TLS. Data tetap di Indonesia (PP No. 71 Tahun 2019 Pasal 20). Endpoint Storage untuk signed URL gambar laporan harus dapat dijangkau Google. |
| Produksi, pilihan B | Vercel | Supabase Cloud | Riil | Hanya bila fungsi hukum menyetujui pemrosesan dan penyimpanan di luar negeri (UU PDP Pasal 56), mengingat ada data anak. |

Ketentuan untuk Vercel:

- Durasi fungsi terbatas. Sinkronisasi besar dan pembuatan laporan dijalankan sebagai job: endpoint mengembalikan `202` dengan `job_id`, lalu job diproses oleh antrean (misalnya Supabase Queues/`pgmq` atau `pg_cron`) dan worker.
- Vercel Cron memicu sinkronisasi terjadwal dengan `CRON_SECRET`.
- Kunci service account Google, kunci provider AI, dan `SUPABASE_SERVICE_ROLE_KEY` hanya ada di environment variable server Vercel, tidak pernah di variabel `NEXT_PUBLIC_`.
- Aplikasi di Vercel yang terhubung ke Supabase self-host memerlukan endpoint Supabase publik ber-TLS. ngrok tidak dipakai untuk produksi.

### 12.6 Keamanan repositori GitHub

| Area | Konfigurasi |
|---|---|
| Ruleset branch `main` | Merge hanya lewat PR; minimal 1 persetujuan; persetujuan lama gugur bila ada commit baru; semua check wajib (§12.1) lulus dan branch mutakhir; semua percakapan selesai; riwayat linear; force push dan penghapusan branch diblokir |
| `CODEOWNERS` | Persetujuan pemilik wajib untuk `supabase/migrations/**`, `.github/**`, `src/lib/auth/**`, `src/lib/security/**`, dan `src/modules/*/infrastructure/**` |
| Environment | `preview` tanpa persetujuan; `production` dengan reviewer wajib dan hanya dari branch `main`; secret disimpan per environment |
| GitHub Actions | `GITHUB_TOKEN` default read-only; hanya action dari GitHub, kreator terverifikasi, atau daftar izin, dan semuanya dipin SHA; workflow dari fork memerlukan persetujuan; `pull_request_target` tidak dipakai untuk menjalankan kode PR |
| Dependensi | Dependabot alerts dan security updates aktif; `dependabot.yml` mingguan untuk `npm` dan `github-actions`, pembaruan minor/patch dikelompokkan |
| Secret | Secret scanning dan push protection aktif (repositori privat memerlukan GitHub Secret Protection/Advanced Security); gitleaks di CI; hanya `.env.example` yang di-commit |
| Code scanning | CodeQL dengan query `security-extended`; temuan high/critical menggagalkan PR |
| Akun | 2FA wajib bagi anggota organisasi; peran repositori seminimal mungkin |
| Dokumen | `SECURITY.md` (cara melaporkan kerentanan) dan `PULL_REQUEST_TEMPLATE.md` berisi checklist: data pribadi, migration, tes, dampak keamanan, dan kontrol `SH-…` yang terdampak (§11.4) |

### 12.7 Strategi pengujian

| Level | Alat | Cakupan | Kapan |
|---|---|---|---|
| Unit | Vitest | Lapisan domain dan application: parser judul sheet, deteksi rentang item dan `Cek Sync`, pemetaan status, rekonsiliasi baris 1, tiga waktu kesegaran, rules engine dan proyeksi, cakupan laporan periodik, validasi jadwal, penyusun request `batchUpdate` Google Docs | Setiap PR |
| Integration | Vitest + Supabase lokal + pgTAP | Migration, constraint, RLS per role dan tim kerja, repository, use case `ImportSheet` dengan fixture CSV sintetis berformat template, kontrak API (Zod), Google API dan provider AI melalui mock (MSW) | Setiap PR |
| E2E / UI | Playwright | Alur pengguna per fitur, diberi tag fitur | Sesuai cakupan perubahan; penuh pada kondisi tertentu |
| Uji sandbox (opsional) | Vitest | Google Sheets/Drive/Docs nyata pada Shared Drive sandbox dengan data sintetis | Malam hari atau manual |

**Golden dataset:** fixture sintetis yang meniru kedua sheet contoh, termasuk baris tanpa identitas, slot item kosong, `#REF!`, `Pembatalan`, dan judul item ganda. Hasil rules engine dan agregat harus cocok 100% (NFR-01 PRD). Repositori tidak boleh berisi data peserta riil.

**Coverage minimum** (ditegakkan di konfigurasi Vitest): domain 90% baris dan cabang, application 80%, keseluruhan 70%.

**E2E sesuai cakupan perubahan:**

- Setiap test Playwright diberi tag fitur, misalnya `test("membuat draf laporan bulanan", { tag: ["@laporan"] }, ...)`.
- `tests/e2e/scope-map.json` memetakan path ke tag, misalnya `@laporan` ← `src/app/(dashboard)/reports/**`, `src/modules/reporting/**`, `src/components/reports/**`.
- `scripts/affected-e2e.mjs` membandingkan perubahan terhadap base branch dan menghasilkan `grep` berisi tag fitur yang terdampak, ditambah `@smoke` (login dan dashboard tampil) bila ada perubahan kode aplikasi. Bila tidak ada kode aplikasi yang berubah, E2E dilewati.
- Seluruh suite dijalankan bila: perubahan menyentuh bagian bersama (`src/app/(dashboard)/layout.tsx`, `src/components/ui/**`, `src/lib/auth/**`, `middleware.ts`, `package.json`, lockfile, `playwright.config.ts`, migration); PR diberi label `e2e:full`; `workflow_dispatch` dengan `e2e_full: true`; jadwal malam; atau sebelum rilis produksi.
- Test E2E memakai Supabase lokal dengan seed sintetis dan mock layanan eksternal, sehingga hasilnya stabil dan cepat.

---

## 13. Rencana implementasi

Estimasi berikut merupakan rencana awal untuk satu developer berpengalaman. Durasi aktual bergantung pada kualitas data, dokumen PK, akses Google, dan iterasi pengujian.

| Tahap | Estimasi | Deliverable |
|---|---:|---|
| 1. Fondasi | 2–3 hari | Repository, Next.js, Supabase, auth, CI |
| 2. Data ingestion | 3–4 hari | Sheets, CSV/XLSX, mapping, validasi, import batch |
| 3. PK dan rules engine | 3–5 hari | Model indikator, perhitungan, risk assessment |
| 4. Dashboard | 2–4 hari | KPI, daftar risiko, filter, detail assessment |
| 5. AI Agent | 3–5 hari | Adapter, tools, retrieval PK, guardrails |
| 6. Google Docs | 2–4 hari | Template, draft, validasi, approval |
| 7. Hardening dan UAT | 3–5 hari | Tes keamanan, E2E, perbaikan, deployment |

Estimasi keseluruhan: sekitar **18–30 hari kerja**, dengan sebagian pekerjaan dapat berjalan paralel. Ini bukan jaminan bahwa aplikasi siap produksi dalam periode tersebut.

### 13.1 Prioritas MVP

Versi pertama mencakup:

- Login dan role dasar.
- Impor CSV/XLSX dan satu sumber Google Sheets dengan tata letak template sheet peserta (§3.2).
- Pemetaan indikator PK manual dengan persetujuan.
- Rules engine deterministik dan dashboard risiko.
- Pemantauan detail per pelatihan dan item modul (§8.6).
- Satu provider AI terlebih dahulu, dengan arsitektur yang mendukung provider tambahan.
- Draf laporan Google Docs per pelatihan, bulanan, dan tahunan.
- Audit log dan CI/CD.

Setelah MVP stabil, tambahkan provider lain, retrieval lebih canggih, notifikasi otomatis, dan proyeksi berdasarkan histori.

## 14. Kriteria penerimaan prototipe

- [ ] Sheet atau CSV/XLSX berhasil dibaca, divalidasi, dan diimpor tanpa duplikasi.
- [ ] Data kosong, duplikat, invalid, dan kedaluwarsa ditangani secara eksplisit.
- [ ] Baris tanpa identitas dan slot item tanpa judul diabaikan serta dilaporkan pada pratinjau.
- [ ] Total baris 1 sheet direkonsiliasi dengan hitung ulang, dan selisihnya dijelaskan.
- [ ] Detail pelatihan menampilkan funnel, ringkasan per item, titik berhenti, dan item belum selesai per peserta; angkanya cocok dengan hitung ulang dari sheet.
- [ ] Capaian PK sesuai rumus dan definisi indikator yang telah disetujui.
- [ ] Status risiko memiliki rule code, bukti, snapshot, dan versi aturan.
- [ ] AI Agent menggunakan tools terotorisasi dan tidak mengarang angka capaian.
- [ ] Provider dapat diganti tanpa mengubah rules engine atau dashboard.
- [ ] Laporan Google Docs dibuat dari template dan semua angka dapat ditelusuri.
- [ ] Pelatihan baru tidak dapat disimpan sebelum admin mengonfirmasi tahun, tim kerja, dan ID hasil parsing.
- [ ] Laporan bulanan dan tahunan dibuat dari salinan template per tim kerja; tidak ada `{{` yang tersisa, dan tabel serta gambar di `{{Detail_Laporan}}` sesuai data.
- [ ] Sheet dengan jumlah item berbeda dan posisi `Cek Sync` berbeda terbaca benar tanpa konfigurasi huruf kolom.
- [ ] Sinkronisasi manual membedakan waktu dicek, waktu isi berubah, dan waktu pembaruan sumber.
- [ ] Jadwal pelatihan memiliki sumber dan status verifikasi; jadwal yang tidak konsisten ditandai.
- [ ] Pernyataan kepatuhan tampil di login, formulir unggah, panel AI Agent, dan dokumen laporan.
- [ ] Laporan bulanan dan tahunan mencakup semua pelatihan yang periodenya beririsan dengan periode laporan, menandai pelatihan yang masih berjalan sebagai sementara, dan totalnya sama dengan jumlah per pelatihan.
- [ ] Akses role diuji; secret tidak bocor; RLS dan authorization tests lulus.
- [ ] Lint, type-check, tests, build, dan database migration tests berhasil.
- [ ] Gerbang rilis pada dokumen security hardening terpenuhi untuk tahap yang dituju (§11.4).
- [ ] Batas panjang dan kompleksitas kode (§4.3) serta arah ketergantungan lapisan (§4.2) diperiksa otomatis dan lulus.
- [ ] Ruleset `main`, CODEOWNERS, environment `production`, Dependabot, CodeQL, dan pemindaian secret aktif (§12.6).
- [ ] E2E pada PR hanya menjalankan tag fitur yang terdampak, dan suite penuh berjalan pada kondisi §12.7; coverage minimum terpenuhi.
- [ ] Impor, perubahan konfigurasi, assessment risiko, dan publikasi laporan dapat ditelusuri.

## 15. Langkah berikutnya

1. Unggah PDF Perjanjian Kinerja untuk memverifikasi definisi indikator, target, rumus, satuan, periode, dan kriteria capaian.
2. Konfirmasi arti kolom `STATUS`, `ONBOARDING`, `ADA DI USULAN MITRA`, dan `Cek Sync`, serta nilai `STATUS` yang muncul selama pelatihan masih berjalan. Jika pembacaan langsung bermasalah, siapkan CSV/XLSX dengan header dan nama sheet asli.
3. Siapkan template Google Docs untuk laporan per pelatihan, bulanan, dan tahunan, atau tautan template yang dapat diakses akun integrasi. Konfirmasi juga bulan pencatatan lulusan untuk pelatihan yang melewati dua bulan.
4. Tetapkan apakah prototipe menggunakan data sintetis atau data peserta riil.
5. Tetapkan rencana belajar per pelatihan (tenggat item dan item wajib) agar rule berbasis jadwal dapat dinilai.
6. Batasi akses sheet sumber dan pastikan dasar pemrosesan data peserta anak.
7. Minta akses data jadwal pelatihan yang resmi dari pengelola platform Digitalent (misalnya melalui SDM Digital Developer Console), atau tetapkan prosedur verifikasi jadwal manual.
8. Minta fungsi hukum meninjau teks pernyataan kepatuhan (§11.3).
9. Siapkan Shared Drive laporan dengan folder per tahun dan tim kerja, tambahkan service account sebagai anggota, dan batasi akses kedua template.
10. Tetapkan topologi produksi (§12.5): pilihan A di server instansi, atau pilihan B dengan persetujuan fungsi hukum.

### 15.1 Keputusan yang perlu dikonfirmasi sebelum implementasi

Keputusan bertanda **penghambat** perlu dijawab sebelum skema database final dibuat. Keputusan lain dapat memakai usulan bawaan dan diubah kemudian.

| No | Keputusan | Usulan bawaan | Sifat |
|---|---|---|---|
| 1 | Cakupan akses role: apakah Pengelola Pelatihan dan Viewer dibatasi ke tim kerjanya | Ya, dibatasi per tim kerja melalui RLS; Admin dan Pengelola PK lintas tim | Penghambat |
| 2 | Identitas peserta lintas pelatihan: apakah `NO REGISTRASI` unik per pendaftaran atau per orang | Diperlakukan per pendaftaran; peserta tidak digabung lintas pelatihan (minimisasi data) | Penghambat |
| 3 | Masa simpan data peserta dan snapshot, terutama data anak | Data identitas dianonimkan 12 bulan setelah tahun anggaran berakhir; agregat disimpan | Penghambat |
| 4 | Indikator PK, target, dan pemetaannya ke tim kerja | **Ditetapkan dari PK 2026 (§8.7).** Sisa: lengkapi spreadsheet PK untuk semua indikator dan setujui pemetaan | Sebagian selesai |
| 5 | Definisi lulus dan "mengikuti" | **Mengikuti definisi PK per indikator (§8.7).** Sisa: format sheet GTA dan KDD, serta nilai `STATUS` selama pelatihan berjalan | Sebagian selesai |
| 6 | Metode login | **Ditetapkan:** Supabase Auth dengan email dan kata sandi; akun didaftarkan manual oleh Admin; MFA belum diwajibkan (dicatat sebagai risiko RR-04 di dokumen hardening) | Selesai |
| 7 | Topologi produksi (§12.5) | Prototipe: Vercel + Supabase Cloud dengan data sintetis; produksi: pilihan A | Penghambat untuk data riil |
| 8 | Akun dan akses: organisasi GitHub, tim Vercel, proyek Google Cloud, service account, Shared Drive | Disiapkan atas nama instansi, bukan akun pribadi | Penghambat untuk deploy |
| 9 | Provider AI pertama dan batas biaya | Satu provider dulu, misalnya Gemini, dengan batas biaya bulanan | Bawaan |
| 10 | Sumber rencana belajar (tenggat item, item wajib) | Diisi Pengelola Pelatihan; saran AI perlu persetujuan | Bawaan |
| 11 | Template laporan per pelatihan | Belum dibuat; cukup laporan bulanan dan tahunan pada MVP | Bawaan |
| 12 | Bentuk aplikasi mobile | Web responsif (PWA) dari kode yang sama, bukan aplikasi native | Bawaan |
| 13 | Notifikasi otomatis (email/pesan) | Di luar MVP | Bawaan |
| 14 | Zona waktu dan format | WIB (Asia/Jakarta), format tanggal Indonesia, antarmuka bahasa Indonesia | Bawaan |
| 15 | Desain kanvas sebagai acuan UI | Disetujui sebagai acuan; perubahan dicatat di riwayat desain | Bawaan |

Setelah PDF PK dan template laporan tersedia, spesifikasi ini dapat diturunkan menjadi migration SQL lengkap, pemetaan indikator PK, OpenAPI, test cases rules engine, konfigurasi provider, dan workflow CI/CD yang siap diimplementasikan.

**Prioritas pertama bukan mengaktifkan AI, melainkan memastikan data, definisi capaian PK, dan perhitungan risiko benar.** AI Agent akan memberi nilai terbesar setelah fondasi tersebut dapat dipercaya.

## 16. Riwayat perubahan

| Versi | Perubahan |
|---|---|
| 1.0 | Rancangan awal |
| 1.1 | Verifikasi template sheet peserta dari dua sheet contoh (§3.2); kontrak data dan aturan normalisasi format lebar (§3.3); pipeline impor dan sinkronisasi terjadwal (§3.4); route `trainings/[id]` (§4); konfigurasi sumber dipindah dari env ke tabel `data_sources` (§5.1, §6.1); tabel `training_learning_plans` dan kolom status item (§6); endpoint `GET /api/v1/trainings/:id/modules` (§7.1); rule `NOT_STARTED` dan catatan rule berbasis jadwal (§8.2); pemantauan detail per pelatihan dan item modul (§8.6); pseudonim peserta untuk provider AI (§9); catatan akses publik sheet dan data anak (§3.2.4, §11) |
| 1.2 | Laporan periodik bulanan dan tahunan untuk beberapa pelatihan sekaligus (§10.2); placeholder laporan periodik (§10.3); tabel `report_trainings` dan kolom periode pada `generated_reports` (§6); endpoint `GET /api/v1/reports/coverage` (§7.1); modul `reporting/coverage` (§4) |
| 1.3 | Kolom dikenali dari nama header dan rentang item dideteksi sampai `Cek Sync` (§3.2, §3.3); saran katalog item oleh AI dengan persetujuan (§3.3, §9.3); tiga waktu pembaruan dan sinkronisasi manual (§3.5); tautan halaman pelatihan, hasil analisis portal Digitalent, dan validasi jadwal (§3.6); kolom jadwal dan portal pada `trainings` (§6); endpoint pendaftaran pelatihan, jadwal, dan katalog item (§7.1); `DATA_STALE` memakai waktu perubahan (§8.2); pernyataan kepatuhan dan `{{disclaimer}}` (§10.3, §11.3) |
| 1.4 | Tahun dan tim kerja (GTA, KDD, DTA) sebagai induk pelatihan, parsing ID dengan konfirmasi admin (§3.7); tabel `work_teams`, `work_team_years`, `report_assets` (§6); endpoint tim kerja dan parsing sumber (§7.1); laporan periodik per tim kerja (§10.2); template bulanan dan tahunan, isi `{{Detail_Laporan}}` dengan tabel dan gambar, mekanisme salin dan isi Google Docs (§10.3); Shared Drive dan scope minimum (§10.4); topologi Vercel dan Supabase (§2, §5.1, §12.5) |
| 1.5 | Clean architecture empat lapisan (§4.2); batas panjang dan kompleksitas kode beserta konfigurasi ESLint (§4.3); pipeline dan workflow CI, security, dan deploy (§12.1, §12.2); keamanan repositori GitHub (§12.6); strategi pengujian unit, integration, dan E2E sesuai cakupan perubahan (§12.7); keputusan yang perlu dikonfirmasi (§15.1) |
| 1.6 | Security hardening berbasis OWASP ASVS Level 2, API Top 10, Top 10, dan LLM Top 10 dipisah ke `security_hardening_ews_ai_agent.md`; tautan di §11.4, template PR, dan kriteria penerimaan |
| 1.7 | Indikator PK 2026 asli (IKSK 1.1, 2.1, 3.1, 3.2) dan pemetaannya ke tim kerja; rumus persentase dengan penyebut peserta yang mengikuti; target antara bulanan; level, metode, dan jenis sertifikasi pelatihan; rule `PASS_PENDING`; pencocokan dengan Metabase (§8.1, §8.2, §8.7); pembacaan folder PK per tahun (§9.4); tabel `pk_indicator_targets` dan kolom indikator baru (§6.1); keputusan §15.1 no. 4 dan 5 |
