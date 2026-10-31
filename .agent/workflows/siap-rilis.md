---
description: Periksa gerbang rilis sebelum deploy preview, prototipe, atau produksi.
---

1. Tanyakan tahap tujuan: preview (data sintetis), prototipe terbatas, atau produksi (data riil).
2. Baca gerbang rilis di `docs/security_hardening_ews_ai_agent.md` §6 untuk tahap itu.
3. Jalankan suite lengkap:
   `pnpm lint && pnpm typecheck && pnpm test:unit --coverage && pnpm test:integration && pnpm build && pnpm test:e2e`
4. Periksa kriteria penerimaan spesifikasi §14 satu per satu; tandai yang terpenuhi dengan bukti.
5. Untuk data riil: pastikan keputusan §15.1 no. 3, 7, 8 sudah dikonfirmasi dan penilaian fungsi hukum ada.
6. Tulis ringkasan kesiapan: lulus, belum, dan risiko tersisa (RR-*).
