# EWS AI Agent — Starter Pack

Early Warning System pelatihan BPSDM Komdigi Yogyakarta: Next.js + Supabase + Google APIs + AI Agent multi-provider. Starter pack ini disiapkan untuk dilanjutkan dengan Google Antigravity (atau agen koding lain yang membaca `AGENTS.md`).

## Isi

| Lokasi | Isi |
|---|---|
| `AGENTS.md` | Aturan utama untuk agen: sumber kebenaran, perintah, batasan |
| `.agent/rules/` | Aturan Antigravity: arsitektur, batas kode, keamanan, pengujian, domain, UI |
| `.agent/workflows/` | Workflow Antigravity: `/kerjakan-tugas`, `/migration-baru`, `/cek-keamanan`, `/siap-rilis` |
| `docs/spesifikasi_teknis_ews_ai_agent.md` | Spesifikasi teknis v1.7 |
| `docs/security_hardening_ews_ai_agent.md` | Kontrol OWASP `SH-*`, gerbang rilis, log hardening |
| `docs/implementation-plan.md` | Tugas per fase (F0–F6) dengan ID untuk diberikan ke agen |
| `docs/decisions.md` | Keputusan yang sudah dan belum dikonfirmasi |
| `docs/design/` | Sumber desain UI web dan mobile + indeks layar → rute |
| `supabase/migrations/` | Skema inti (29 tabel) dan RLS per role dan tim kerja |
| `supabase/seed.sql` | Tim kerja, template laporan, indikator PK 2026 dan target antara |
| `supabase/tests/rls.test.sql` | pgTAP: RLS aktif, akses lintas tim ditolak |
| `src/modules/*/domain/` | Logika murni yang sudah teruji: deteksi kolom sampai `Cek Sync`, parser judul dan URL portal, `UPDATE TERAKHIR`, kesegaran data, capaian IKSK, proyeksi, rule peserta, cakupan laporan |
| `.github/` | CI, security, deploy migration, CODEOWNERS, Dependabot, template PR |

## Status saat diserahkan

Sudah diperiksa di mesin pembuat (Node 24, pnpm 10.34.9):

- `pnpm test:unit`: 98 tes lulus; coverage domain 100% baris, ≥ 92% cabang.
- `pnpm lint`, `pnpm typecheck`, `pnpm check:duplication` (0 duplikasi), `pnpm build`: lulus.
- Lint menolak impor lintas lapisan yang salah (domain → infrastructure, UI → infrastructure) dan SDK di lapisan domain.
- Migration + seed diterapkan di PGlite (Postgres WASM) dengan stub skema `auth`; skenario RLS diuji: pengelola DTA melihat data DTA, viewer GTA tidak melihat pelatihan DTA atau data peserta, audit log tidak dapat ditulis klien, insert pelatihan ke tim lain ditolak.

Belum diperiksa: `supabase db reset` / `supabase test db` dengan Supabase CLI asli, tes E2E Playwright (browser belum dipasang), dan workflow GitHub Actions (nilai `<SHA>` masih placeholder).

## Mulai

```bash
corepack enable
pnpm install
cp .env.example .env.local
supabase init        # membuat supabase/config.toml; migration dan seed yang ada tetap dipakai
supabase start
supabase db reset
supabase test db
pnpm test:unit
pnpm dev
```

Butuh Node 22 atau 24, Docker (untuk Supabase lokal), dan Supabase CLI.

## Memakai di Antigravity

1. Buka folder ini sebagai workspace di Antigravity.
2. Periksa panel Customizations: aturan di `.agent/rules/` dan workflow di `.agent/workflows/` harus terbaca. Bila versi Antigravity Anda memakai lokasi atau format frontmatter berbeda, pindahkan isinya ke lokasi yang diminta; isinya tetap berlaku.
3. Isi keputusan penghambat di `docs/decisions.md` (no. 1, 2, 3, 7, 8) sebelum agen membuat skema atau fitur yang bergantung padanya.
4. Beri tugas satu per satu, misalnya:
   - `Jalankan /kerjakan-tugas untuk F1-03.`
   - `Kerjakan F2-04 sesuai spesifikasi §3.3; tulis tes dulu.`
   - `Jalankan /cek-keamanan pada perubahan ini.`
5. Pakai mode yang meminta persetujuan rencana untuk tugas yang menyentuh migration, auth, atau integrasi Google.
6. Untuk acuan visual, ekspor tangkapan layar dari kanvas desain ke `docs/design/screenshots/` (lihat `docs/design/README.md`).

## Catatan

- Data peserta riil tidak boleh masuk repositori, fixture, log, atau prompt AI. Gitleaks memblokir pola `NO REGISTRASI`.
- Nilai ambang rule di `risk_rule_versions` dan indikator di seed berstatus contoh/draft; Pengelola PK yang menyetujui.
- Target antara IKSK 3.2 baru terisi Oktober–Desember; lengkapi dari Manual PK 2026 hlm. 8–10.
- `vercel.json` menjadwalkan sinkronisasi tiap 3 jam; paket Vercel Hobby hanya mengizinkan cron harian.
- Ganti setiap `<SHA>` di `.github/workflows/` dengan commit SHA rilis action sebelum CI dijalankan, dan ganti `@org/ews-maintainers` di `CODEOWNERS`.
