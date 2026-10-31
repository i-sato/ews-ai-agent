---
trigger: glob
globs: src/**/*.ts, src/**/*.tsx, tests/**/*.ts
---

# Batas panjang dan kompleksitas kode (spesifikasi §4.3)

| Ukuran | Batas |
|---|---|
| Panjang baris | 100 karakter (URL, string, regex dikecualikan) |
| File `.ts` | 300 baris (tanpa baris kosong dan komentar) |
| File `.tsx` | 200 baris |
| `route.ts` | 60 baris |
| File tes | 400 baris |
| Fungsi | 40 baris; komponen React 80 baris |
| Kompleksitas siklomatik | 10 |
| Kedalaman blok | 3 |
| Parameter | 3; lebih dari itu pakai satu objek |
| Callback bersarang | 3 |
| Duplikasi | ≤ 3% (`jscpd`) |

- Bila mendekati batas, pecah menjadi fungsi atau file baru di lapisan yang sama, jangan menaikkan batas.
- `eslint-disable-next-line` hanya dengan alasan tertulis di baris yang sama.
- TypeScript strict; hindari `any`. Gunakan tipe hasil (`Result`) atau galat domain bernama, bukan string bebas.
- Nama dalam bahasa Inggris; teks yang dilihat pengguna dalam bahasa Indonesia.
