---
trigger: always_on
---

# Arsitektur (spesifikasi §2, §4, §4.2)

- Monolit modular Next.js + Supabase. Bukan microservices.
- Modul: `ingestion`, `risk-engine`, `pk`, `agent`, `reporting`, `audit` di `src/modules/`.
- Lapisan per modul dan arah ketergantungan (hanya ke dalam):

| Lapisan | Lokasi | Boleh impor |
|---|---|---|
| domain | `src/modules/<m>/domain/` | tidak ada (hanya TypeScript murni) |
| application | `src/modules/<m>/application/` | domain, `zod` |
| infrastructure | `src/modules/<m>/infrastructure/` | application, domain, SDK eksternal |
| interface | `src/app/`, `src/components/` | application (lewat `src/lib/container.ts`) |

- Use case menerima port (interface) lewat konstruktor/objek parameter, bukan membuat client sendiri.
- `src/lib/container.ts` adalah satu-satunya tempat merakit adapter Supabase, Google, dan provider AI.
- `route.ts`: parse input dengan Zod `.strict()`, cek sesi dan role dari server, panggil satu use case, petakan hasil ke response/galat §7.3. Tanpa logika bisnis.
- Komponen klien tidak mengakses database. Data lewat Server Component atau route handler.
- Operasi panjang (sinkronisasi besar, pembuatan laporan) mengembalikan `202` + `job_id`.
- Prefix API `/api/v1`. Daftar endpoint di spesifikasi §7.1; jangan menambah endpoint di luar daftar tanpa keputusan tercatat.
- Pelanggaran arah lapisan menggagalkan lint (`eslint-plugin-boundaries`).
