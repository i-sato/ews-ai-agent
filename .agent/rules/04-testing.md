---
trigger: always_on
---

# Pengujian (spesifikasi §12.7)

| Level | Alat | Lokasi |
|---|---|---|
| Unit | Vitest | `src/**/*.test.ts` atau `tests/unit/` |
| Integration | Vitest + Supabase lokal + MSW | `tests/integration/` |
| Database | pgTAP | `supabase/tests/` |
| E2E/UI | Playwright | `tests/e2e/` |

- Coverage minimum: domain 90% baris dan cabang, application 80%, keseluruhan 70%.
- Tes rules engine wajib deterministik: input, snapshot, dan versi aturan yang sama menghasilkan output yang sama.
- Golden dataset di `tests/fixtures/` meniru dua sheet contoh (baris tanpa identitas, slot kosong, `#REF!`, `Pembatalan`, judul ganda, `&AMP;`). Data sintetis saja.
- Setiap tes Playwright memakai tag fitur, misalnya `test("…", { tag: ["@laporan"] }, …)`. Tag baru wajib didaftarkan di `tests/e2e/scope-map.json`.
- E2E pada PR hanya menjalankan tag yang terdampak (`scripts/affected-e2e.mjs`). Suite penuh bila menyentuh bagian bersama, label `e2e:full`, malam hari, atau sebelum rilis.
- Google API dan provider AI selalu di-mock di CI.
- Daftar kasus wajib rules engine: spesifikasi §8.5.
