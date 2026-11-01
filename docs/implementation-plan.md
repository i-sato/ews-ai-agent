# Rencana Implementasi

Turunan dari spesifikasi §13. Satu tugas = satu PR. Kerjakan berurutan per fase; tugas bertanda ⇄ dapat paralel. Centang `[x]` setelah tes lulus dan dokumen diperbarui.

Status awal starter pack: tugas bertanda **(starter)** sudah tersedia dalam bentuk awal dan perlu ditinjau, bukan ditulis ulang.

## Fase 0 — Persiapan akun (manual, oleh pengguna)

- [ ] F0-01 Organisasi GitHub instansi, repositori privat, ruleset `main` sesuai spesifikasi §12.6.
- [ ] F0-02 Dua proyek Supabase (dev/preview dan prototipe), region `ap-southeast-1`; matikan sign-up; buat akun Admin manual.
- [ ] F0-03 Proyek Vercel terhubung ke repositori, region fungsi `sin1`, Deployment Protection untuk preview.
- [ ] F0-04 Proyek Google Cloud, service account, aktifkan Sheets/Drive/Docs API; Shared Drive laporan dengan folder per tahun dan tim kerja; bagikan template dan folder `PK/2026` ke service account.
- [ ] F0-05 Kunci API satu provider AI (usulan: Gemini) dengan batas biaya bulanan.
- [ ] F0-06 Jawab keputusan penghambat di `docs/decisions.md` (no. 1, 2, 3, 7, 8).

## Fase 1 — Fondasi (spesifikasi §4, §5, §12)

- [x] F1-01 Instal dependensi dan pastikan `pnpm lint`, `pnpm typecheck`, `pnpm test:unit` lulus. **(starter)**
- [x] F1-02 `supabase init` (membuat `supabase/config.toml`), jalankan `supabase start`, terapkan migration awal. **(starter: migration)**
- [x] F1-03 Kerangka App Router: grup `(auth)` dan `(dashboard)`, layout dengan navigasi sesuai desain, halaman kosong per menu.
- [x] F1-04 Login Supabase Auth (email + kata sandi) dengan `@supabase/ssr`, middleware sesi, logout server-side. SH-AUTH-01/03, SH-SESS-01/03.
- [x] F1-05 Role dari `profiles`, helper `requireRole`, RLS per tim kerja. SH-AUTHZ-01/02. **(starter: policy awal)**
- [x] F1-06 Header keamanan dan CSP nonce di `src/proxy.ts` (pengganti middleware di Next 16). SH-HDR-01..04.
- [ ] F1-07 CI hijau di GitHub: ganti `<SHA>` pada workflow dengan SHA rilis yang dipin. **(starter: workflow)** SHA sudah dipin (1 Nov 2026); centang setelah run CI pertama hijau.
- [x] F1-08 `GET /api/health`, halaman pernyataan kepatuhan, footer tautan kepatuhan. **(starter: health)**

## Fase 2 — Ingestion (spesifikasi §3)

- [ ] F2-01 Domain: normalisasi header, deteksi rentang item sampai `Cek Sync`, pemetaan status, jenis item. **(starter)**
- [ ] F2-02 Domain: parser judul spreadsheet dan URL portal. **(starter)**
- [ ] F2-03 Domain: parser `UPDATE TERAKHIR` dan tiga waktu kesegaran. **(starter)**
- [x] F2-04 Domain: normalisasi baris peserta (format lebar → panjang), baris tanpa identitas, galat formula, konsistensi `PERSENTASE LMS`, rekonsiliasi baris 1.
- [x] F2-05 Golden dataset sintetis di `tests/fixtures/` meniru dua sheet contoh (§3.2.3).
- [x] F2-06 Application: use case `ParseTrainingSource`, `RegisterTraining` (konfirmasi admin wajib), `PreviewImport`, `CommitImport`, `SyncSheet` + port.
- [x] F2-07 Infrastructure: adapter Google Sheets (service account) + Drive `modifiedTime`; adapter CSV/XLSX; repository Supabase.
- [x] F2-08 API: `/trainings/parse-source`, `/trainings`, `/trainings/:id/schedule`, `/imports/preview`, `/imports/commit`, `/sync/google-sheets`, `/sync/runs/:id`.
- [ ] F2-09 UI: Pelatihan (daftar, tambah, detail tab Modul/Peserta), Impor & Sinkronisasi. Tag E2E `@pelatihan`, `@impor`.
  - [x] F2-09a Daftar dan detail pelatihan (funnel, kategori, titik berhenti, tab Modul/Peserta, ubah jadwal), web dan mobile, E2E `@pelatihan`.
  - [ ] F2-09b Impor & Sinkronisasi (pratinjau, rekonsiliasi, sinkron manual, dua waktu kesegaran, SH-PDP-04), E2E `@impor`.
  - [ ] F2-09c Tambah pelatihan (cek sheet, konfirmasi Admin, validasi jadwal §3.6, SH-PDP-04).
- [ ] F2-10 Katalog item: versi, persetujuan, saran AI (setelah Fase 5).

## Fase 3 — PK dan rules engine (spesifikasi §8)

- [ ] F3-01 Domain: perhitungan persentase, capaian, gap, jumlah kumulatif. **(starter)**
- [ ] F3-02 Domain: proyeksi peserta dan proyeksi indikator. **(starter: proyeksi peserta)**
- [ ] F3-03 Domain: rule individu `DATA_INVALID`, `NOT_STARTED`, `PASS_PENDING`, `PROGRESS_STAGNANT`. **(starter)**
- [ ] F3-04 Domain: rule berbasis jadwal (`BEHIND_SCHEDULE`, `COMPLETION_AT_RISK`, `MODULE_INCOMPLETE`) dengan status "tidak dapat dinilai".
- [ ] F3-05 Domain: `DATA_STALE`, `TARGET_GAP`, `TARGET_UNLIKELY` memakai target antara bulanan.
- [ ] F3-06 Seed indikator PK 2026 dan target antara; lengkapi bulan IKSK 3.2 dari Manual PK. **(starter: seed sebagian)**
- [ ] F3-07 Application: `RecalculateRisks`, assessment berversi dengan bukti (§8.4); pemetaan pelatihan ↔ indikator dengan persetujuan.
- [ ] F3-08 Pembacaan folder `PK/<tahun>`: spreadsheet deterministik, checksum, versi dokumen (§9.4).
- [ ] F3-09 API + UI: Dashboard, Pemantauan Risiko, Indikator PK, Peserta. Tag `@dashboard`, `@risiko`, `@pk`, `@peserta`.

## Fase 4 — Laporan Google Docs (spesifikasi §10)

- [ ] F4-01 Domain: cakupan laporan bulanan/tahunan, nama bulan Indonesia, status per tanggal batas data. **(starter: cakupan)**
- [ ] F4-02 Domain: objek data laporan bagian A–G dan validator (tanpa `{{` tersisa, total = jumlah per pelatihan).
- [ ] F4-03 Infrastructure: `files.copy` ke Shared Drive, `replaceAllText`, penyusun `batchUpdate` untuk `{{Detail_Laporan}}` (heading, paragraf, `insertTable`, `insertInlineImage`).
- [ ] F4-04 Grafik agregat PNG ke Storage privat + signed URL 5 menit.
- [ ] F4-05 API + UI Laporan: coverage, draf, validasi, persetujuan, publikasi, arsip PDF. Tag `@laporan`.

## Fase 5 — AI Agent (spesifikasi §9)

- [ ] F5-01 Kontrak provider, factory, satu adapter (Gemini), timeout/retry, log pemakaian.
- [ ] F5-02 Tool §9.3 dengan validasi argumen dan otorisasi; pseudonim peserta. SH-PDP-02, SH-LLM-05.
- [ ] F5-03 Guardrail: data tidak tepercaya dibungkus, output divalidasi skema, angka wajib merujuk bukti. SH-LLM-01/04/08.
- [ ] F5-04 Usulan pemetaan PK dari manual dengan rujukan halaman; persetujuan Pengelola PK.
- [ ] F5-05 Panel AI Agent web dan mobile; Pengaturan provider (tanpa menampilkan key). Tag `@agen`, `@pengaturan`.

## Fase 6 — Hardening dan UAT (spesifikasi §11, §14)

- [ ] F6-01 Tes BOLA/BFLA untuk semua endpoint berparameter ID. SH-AUTHZ-03/04.
- [ ] F6-02 Rate limit, batas upload, CSV injection, SSRF. SH-API-01/02, SH-UPLOAD-*, SH-INPUT-04.
- [ ] F6-03 Audit log lengkap dan redaksi log. SH-LOG-01/02.
- [ ] F6-04 E2E penuh, kriteria penerimaan §14, gerbang rilis hardening §6.
- [ ] F6-05 Dokumen `docs/deployment.md` dan prosedur backup/pemulihan.

## Contoh prompt untuk Antigravity

- "Jalankan /kerjakan-tugas untuk F1-01."
- "Kerjakan F2-04. Gunakan fixture sintetis dari F2-05, ikuti spesifikasi §3.3, dan jangan menambah kolom yang tidak ada di §3.2.2."
- "Jalankan /migration-baru untuk menambah tabel `followup_actions` sesuai §6.1."
- "Jalankan /cek-keamanan pada branch ini."
