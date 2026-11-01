---
trigger: always_on
---

# Git dan branch (spesifikasi §12.6)

- Setiap perubahan dikerjakan di branch baru. Jangan commit langsung ke `main`; `main` hanya berubah
  lewat PR sesuai ruleset §12.6.
- Satu branch = satu tugas atau satu perubahan, lalu satu PR.
- Nama branch: `<jenis>/<id-tugas-atau-topik>` dalam bahasa Inggris, huruf kecil, dipisah tanda
  hubung. Jenis: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `security`. Contoh:
  `feat/f2-04-participant-rows`, `docs/branch-per-change-rule`.
- Buat branch dari `main` terbaru. Bila perubahan bergantung pada branch lain yang belum di-merge,
  buat branch dari branch tersebut dan sebutkan ketergantungannya di deskripsi PR.
- Bila ada perubahan yang belum di-commit saat akan berpindah branch, commit dulu di branch yang
  sesuai; jangan membawa perubahan lintas tugas.
- Pesan commit dalam bahasa Inggris dengan awalan jenis yang sama (`feat: …`, `chore: …`).
- Jangan force push ke branch bersama dan jangan menghapus riwayat orang lain.
