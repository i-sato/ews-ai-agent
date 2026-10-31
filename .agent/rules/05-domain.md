---
trigger: model_decision
description: Terapkan saat mengerjakan impor sheet, rules engine, indikator PK, atau laporan.
---

# Aturan domain kunci

Impor sheet template (`ALL PENDAFTAR WEB`, spesifikasi §3.2–§3.5):

- Baris 1 metadata (`UPDATE TERAKHIR`, total), baris 2 header, data mulai baris 3.
- Kolom dikenali dari nama header (dirapikan, tanpa peka huruf besar/kecil, boleh alias).
- Item modul: semua kolom setelah `PERSENTASE LMS` sampai sebelum header pertama yang cocok `cek sync`. Berhenti dan lapor bila `Cek Sync` tidak ada, ganda, atau sebelum `PERSENTASE LMS`, atau rentang kosong.
- Baris tanpa `NO REGISTRASI` diabaikan dan dihitung sebagai `ignored_rows`. Slot item tanpa judul diabaikan.
- `STATUS`: `Lulus Pelatihan - Nilai` → `passed`, `Tidak Lulus Pelatihan - Nilai` → `not_passed`, `Pembatalan` → `cancelled`, lainnya → `unmapped`.
- `PERSENTASE LMS` harus cocok dengan rasio item selesai (toleransi 1 poin), bila tidak `DATA_INVALID`.
- Tiga waktu: `fetched_at`, `content_changed_at`, `source_updated_at`. Sistem tidak pernah menulis ke sheet sumber.
- Hasil parsing judul (tim, ID, skema, periode) hanya usulan; Admin wajib mengonfirmasi.
- Pemetaan item deterministik. AI hanya memberi saran untuk hal ambigu, dari judul item saja, sebagai draf.

Indikator PK 2026 (spesifikasi §8.1, §8.7):

- Persentase: `P = Σ lulus ÷ Σ peserta yang mengikuti × 100`; capaian `A = P ÷ T × 100`.
- Jumlah kumulatif (IKSK 3.2): baseline 54.969 + peserta yang menyelesaikan pelatihan 2026; target 78.319.
- Target antara bulanan dari `pk_indicator_targets` dipakai sebagai rencana kumulatif untuk `TARGET_GAP` dan `TARGET_UNLIKELY`.
- IKSK 1.1 hanya level Basic dan VBL non-sertifikasi.
- Kriteria lulus dan penyebut adalah data berversi yang disetujui Pengelola PK, **bukan konstanta di kode**.
- Angka EWS adalah estimasi dini; realisasi resmi dicocokkan dengan Metabase.

Rule risiko: `DATA_INVALID`, `DATA_STALE`, `NOT_STARTED`, `PASS_PENDING`, `PROGRESS_STAGNANT`, `BEHIND_SCHEDULE`, `COMPLETION_AT_RISK`, `MODULE_INCOMPLETE`, `TARGET_GAP`, `TARGET_UNLIKELY`. Rule berbasis jadwal menghasilkan "tidak dapat dinilai" bila rencana belajar belum disetujui. Setiap assessment menyimpan rule code, metrik, snapshot, versi aturan, dan penjelasan.

Laporan (spesifikasi §10): salin template dengan `drive.files.copy`, isi `{{...}}` dengan `replaceAllText`, `{{Detail_Laporan}}` bagian A–G berisi tabel dan gambar agregat; tidak boleh ada `{{` tersisa. Agregat lintas pelatihan dari jumlah, bukan rata-rata persentase.
