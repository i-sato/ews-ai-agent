# AGENTS.md — EWS AI Agent

Panduan untuk agen koding (Antigravity, atau agen lain yang membaca `AGENTS.md`). Baca file ini sebelum mengubah kode apa pun.

## Sumber kebenaran

Urutan prioritas bila ada pertentangan:

1. `docs/spesifikasi_teknis_ews_ai_agent.md` (v1.7): fitur, skema, API, rules engine, CI/CD.
2. `docs/security_hardening_ews_ai_agent.md` (v0.1): kontrol `SH-*`, gerbang rilis, log hardening.
3. `docs/design/`: desain UI web dan mobile. Menu dan layar **tidak boleh ditambah** di luar desain.
4. `docs/decisions.md`: keputusan yang sudah dan belum dikonfirmasi.
5. File ini dan `.agent/rules/*.md`.

Jangan mengarang fitur, menu, indikator, target, atau angka. Bila spesifikasi tidak menjawab, berhenti dan tanyakan, lalu catat jawabannya di `docs/decisions.md`.

## Ringkasan produk

Early Warning System pelatihan BPSDM Komdigi Yogyakarta: impor progres peserta dari Google Sheets/CSV/XLSX, hitung capaian indikator PK 2026 (IKSK 1.1 DTA, 2.1 GTA, 3.1 KDD, 3.2 lintas tim) dengan **rules engine deterministik**, tampilkan risiko individu dan risiko capaian, AI Agent multi-provider untuk penjelasan dan draf, serta laporan bulanan/tahunan per tim kerja melalui salinan template Google Docs.

## Stack

Next.js App Router + TypeScript strict, Supabase (Postgres, Auth, RLS, Storage), Zod, Vitest, Playwright, pgTAP, ESLint + Prettier, pnpm, GitHub Actions, Vercel (region `sin1`). Node 22 LTS di CI (`.nvmrc`); Node 24 juga didukung.

## Perintah

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm lint && pnpm typecheck
pnpm test:unit            # Vitest, lapisan domain dan application
pnpm test:integration     # butuh `supabase start`
pnpm test:e2e --grep @tag # Playwright per fitur
pnpm check:duplication
supabase db reset && supabase test db
```

Sebelum menyatakan pekerjaan selesai: `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, dan tes lain yang relevan harus lulus. Laporkan hasilnya apa adanya.

## Aturan inti (detail di `.agent/rules/`)

- **Clean architecture:** `src/modules/<modul>/{domain,application,infrastructure}`; domain tanpa Next.js, Supabase, Google, atau SDK AI. Adapter dirakit di `src/lib/container.ts`. `route.ts` hanya parse Zod, cek otorisasi, panggil satu use case.
- **Batas kode:** baris 100, file `.ts` 300, `.tsx` 200, `route.ts` 60, fungsi 40 (komponen 80), kompleksitas 10, kedalaman 3, parameter 3, duplikasi ≤ 3%.
- **Angka resmi hanya dari rules engine.** AI tidak pernah menetapkan capaian, status risiko, atau target.
- **Data peserta:** tidak ada data riil di repositori, log, prompt AI, atau fixture. Ke provider AI hanya pseudonim.
- **Keamanan:** setiap perubahan yang menyentuh auth, RLS, input, upload, secret, AI, atau integrasi Google memperbarui status kontrol `SH-*` dan log hardening.
- **Database:** semua perubahan skema lewat migration baru di `supabase/migrations/`; RLS aktif di setiap tabel; tes pgTAP ikut diperbarui.
- **Tes:** domain ≥ 90% coverage; setiap tes Playwright diberi tag fitur yang terdaftar di `tests/e2e/scope-map.json`.
- **Bahasa:** antarmuka, pesan galat untuk pengguna, dan dokumen dalam bahasa Indonesia; kode, nama variabel, dan commit dalam bahasa Inggris. Zona waktu WIB (`Asia/Jakarta`).

## Cara bekerja

1. Ambil satu tugas dari `docs/implementation-plan.md` sesuai urutan fase.
2. Buat rencana singkat, sebut bagian spesifikasi dan kontrol `SH-*` yang terkait.
3. Tulis tes domain lebih dulu bila menyentuh aturan bisnis.
4. Implementasikan dalam perubahan kecil; satu PR per tugas.
5. Jalankan pemeriksaan, perbarui dokumen terkait, centang tugas di rencana implementasi.
