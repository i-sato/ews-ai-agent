---
description: Tinjau perubahan saat ini terhadap kontrol SH-* dan perbarui dokumen hardening.
---

1. Lihat diff terhadap `main`.
2. Untuk setiap file yang berubah, cocokkan dengan bagian kontrol di `docs/security_hardening_ews_ai_agent.md` §4 (auth, authz, input, upload, API, header, secret, PDP, log, supply chain, LLM, platform).
3. Periksa khusus: role dari server, RLS, Zod `.strict()`, tanpa secret `NEXT_PUBLIC_`, tanpa PII di log/prompt/fixture, allowlist host, output AI divalidasi.
4. Jalankan pencarian pola nomor registrasi riil:
   // turbo
   `git grep -nE '[0-9]{12}-[0-9]{1,2}' -- ':!tests/fixtures/**' || true`
5. Laporkan temuan dengan file:baris dan kontrol `SH-*` yang terkait.
6. Perbarui status kontrol dan tambahkan baris log hardening (§8) untuk perubahan yang diterapkan.
