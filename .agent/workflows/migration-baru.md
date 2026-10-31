---
description: Tambah atau ubah skema database Supabase dengan migration, RLS, dan tes pgTAP.
---

1. Jangan mengubah migration yang sudah ada. Buat file baru: `supabase migration new <nama_singkat>`.
2. Pola expand-contract: tambah kolom/tabel dulu, pindahkan data, baru hapus yang lama pada migration terpisah.
3. Setiap tabel baru di `public`: `enable row level security`, policy per role dan per tim kerja, grant minimum, trigger `updated_at` bila ada kolomnya.
4. Tambahkan constraint dari spesifikasi §6.2 dan indeks untuk kolom filter.
5. Tambahkan tes di `supabase/tests/` (pgTAP): tabel ada, RLS aktif, akses lintas tim ditolak.
6. Jalankan:
   // turbo
   `supabase db reset && supabase test db`
7. Regenerasi tipe: `supabase gen types typescript --local > src/types/database.ts`.
8. Perbarui SH-AUTHZ-02 di dokumen hardening bila policy berubah.
