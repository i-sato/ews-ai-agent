Hanya data **sintetis**. Jangan menyalin nama atau `NO REGISTRASI` peserta riil.

## Golden dataset (F2-05)

`sheets/golden-1.csv` dan `sheets/golden-2.csv` meniru struktur dua sheet contoh di spesifikasi §3.2.3, seperti ekspor CSV tab `ALL PENDAFTAR WEB`. Angka acuan untuk tes ada di `sheets/*.expected.json`.

File di `sheets/` dibangkitkan oleh `golden/golden-sheets.ts`; jangan disunting langsung. Ubah generatornya, lalu jalankan:

```bash
pnpm fixtures:golden
```

`tests/unit/golden-dataset.test.ts` gagal bila file berbeda dari keluaran generator atau bila isi CSV tidak sesuai angka §3.2.3.

| Aspek | golden-1 (contoh 1) | golden-2 (contoh 2) |
|---|---|---|
| Judul (fiktif) | `Mirror DTA VBL 90109 SNWD 23 - 30 Sept` | `MIRROR - DTA VBL 90107 SNAT 10 -31 Agustus` |
| Peserta | 41: 33 lulus, 8 tidak lulus | 51: 45 lulus, 5 tidak lulus, 1 `Pembatalan` |
| Tidak lulus: belum mulai / berhenti | 6 / 2 (berhenti di item ke-15 `KUIS 1` dan ke-17) | 4 / 1 (berhenti di item ke-3) |
| Item / slot kosong (J–AY, `Cek Sync` di AZ) | 34 / 8 | 28 / 14 |
| Jenis item | 1 overview, 24 materi, 5 video, 3 kuis, 1 final assessment | 24 materi, 3 kuis, 1 final assessment |
| Kasus khusus | 2 judul `&AMP;`, judul berkoma, judul 103 karakter, 1 `Cek Sync` = `#REF!` | Judul ganda di AE dan AF, judul 164 karakter, baris `Pembatalan` dengan `ONBOARDING` kosong, LMS 100 tetapi 0 item, `Error Sync` |
| Baris tanpa identitas | 25 | 25 |

Perbedaan yang disengaja dari sheet asli:

- **Baris tanpa identitas** dikurangi dari 1.996 dan 1.986 menjadi 25 per sheet agar fixture kecil. Isinya tetap nilai bawaan formula (`FALSE`, `0`, `Belum Mengerjakan`, `OK`).
- **Nomor registrasi** berformat `SINT1-001` dan `SINT2-001`, bukan pola asli 12 digit-1/2 digit. Nama `Peserta Sintetis 1-001`. Instansi, judul item, dan ID pelatihan (`90109`, `90107`) fiktif.
- **Baris 1** (asumsi, belum diverifikasi dengan sheet asli): A1 berisi `UPDATE TERAKHIR: …`, lalu pasangan label dan angka di sel terpisah (B1 `TOTAL PENDAFTAR`, C1 angka, … sampai I1), dan jumlah peserta `Selesai` di atas setiap kolom item (0 untuk slot kosong). `TOTAL PENDAFTAR` tidak menghitung `Pembatalan`; `TOTAL ONBOARDING` = peserta `Onboarding`; `TOTAL SELESAI` = peserta lulus; `TOTAL DITERIMA` disamakan dengan `TOTAL PENDAFTAR` karena artinya belum dikonfirmasi.
- **Slot item kosong** pada baris data berisi `Belum Mengerjakan` agar tes membuktikan slot tanpa judul diabaikan walaupun berisi nilai.
- Kolom `JENIS KELAMIN`, `USIA`, dan `ADA DI USULAN MITRA` tetap ada (nilai sintetis) supaya tes dapat membuktikan kolom itu tidak diimpor.
