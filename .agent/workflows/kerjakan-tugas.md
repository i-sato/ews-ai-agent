---
description: Kerjakan satu tugas berikutnya dari docs/implementation-plan.md sampai lulus pemeriksaan.
---

1. Buka `docs/implementation-plan.md`, ambil tugas pertama yang belum dicentang pada fase aktif. Bila pengguna menyebut ID tugas (mis. `F2-03`), ambil tugas itu.
2. Baca bagian spesifikasi yang dirujuk tugas, `AGENTS.md`, dan kontrol `SH-*` terkait di `docs/security_hardening_ews_ai_agent.md`.
3. Bila ada keputusan yang belum ada di `docs/decisions.md`, berhenti dan tanyakan ke pengguna.
4. Tulis rencana singkat sebagai artifact: file yang dibuat/diubah, tes yang ditambahkan, kontrol `SH-*` yang terdampak. Tunggu persetujuan.
5. Buat branch baru sesuai `.agent/rules/07-git.md` (mis. `feat/f2-03-update-terakhir`). Bila ada perubahan belum di-commit dari pekerjaan lain, commit dulu di branch-nya.
6. Tulis tes lebih dulu untuk logika domain, lalu implementasi.
7. Jalankan:
   // turbo
   `pnpm lint && pnpm typecheck && pnpm test:unit`
8. Bila menyentuh database: `supabase db reset && supabase test db`. Bila menyentuh UI: `pnpm test:e2e --grep <tag fitur>`.
9. Perbarui dokumen: centang tugas, status `SH-*`, log hardening, dan `docs/decisions.md` bila ada keputusan baru.
10. Commit di branch tugas, lalu ringkas hasil: nama branch, apa yang selesai, hasil tes apa adanya, dan apa yang belum.
