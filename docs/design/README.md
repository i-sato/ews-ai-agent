# Desain UI

Acuan visual: kanvas desain EWS AI Agent (artifact claude.ai, privat milik pemilik proyek). File `*.dc.html` di folder ini adalah sumber kanvas tersebut. File ini memuat `support.js` dari runtime kanvas, sehingga tidak tampil sempurna bila dibuka langsung, tetapi struktur, teks, warna, dan data contohnya dapat dibaca agen sebagai acuan.

Untuk acuan visual di Antigravity, ekspor tangkapan layar setiap layar dari kanvas ke folder `docs/design/screenshots/` dengan nama file yang sama (mis. `Main.png`).

| File | Layar | Rute aplikasi |
|---|---|---|
| `Main.dc.html` | Web · Dashboard | `/dashboard` |
| `Web-Pelatihan.dc.html` | Web · Pelatihan | `/trainings` |
| `Web-PelatihanTambah.dc.html` | Web · Tambah pelatihan (parsing + konfirmasi admin) | `/trainings/new` |
| `Web-PelatihanDetail.dc.html` | Web · Detail pelatihan (modul & peserta) | `/trainings/[id]` |
| `Web-Impor.dc.html` | Web · Impor & sinkronisasi | `/trainings/[id]/import` |
| `Web-Peserta.dc.html` | Web · Peserta | `/participants` |
| `Web-Risiko.dc.html` | Web · Pemantauan risiko | `/risk-monitoring` |
| `Web-IndikatorPK.dc.html` | Web · Indikator PK | `/pk-indicators` |
| `Web-Laporan.dc.html` | Web · Laporan (per pelatihan, bulanan, tahunan) | `/reports` |
| `Web-Pengaturan.dc.html` | Web · Pengaturan | `/settings` |
| `Web-AgenAI.dc.html` | Web · Panel AI Agent (laci kanan) | komponen global |
| `Web-Login.dc.html` | Web · Login | `/login` |
| `M-Lainnya.dc.html` | Mobile · Menu Lainnya | `/more` (khusus mobile) |
| `M-*.dc.html` | Versi mobile layar di atas | rute yang sama, tata letak responsif |

Angka pada desain (mis. IKSK 3.2 74.210 dari 78.319) adalah ilustrasi, bukan data resmi.

Token warna utama yang dipakai desain: primer `#1F4FD1`, teks `#1B2430`, teks sekunder `#5B6573`, garis `#E2E5EA`, latar `#F5F6F8`; status Kritis `#FEE4E2`/`#B42318`, Waspada `#FEF0C7`/`#93370D`, Normal `#DCFAE6`/`#085D3A`, netral `#EAECF0`/`#344054`. Huruf: Plus Jakarta Sans, angka/kode JetBrains Mono.
