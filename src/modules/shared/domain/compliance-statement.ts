import { monthName } from "./indonesian-months";

// Spesifikasi §11.3. Teks berversi: setiap perubahan menaikkan `version`, memperbarui
// `effectiveDate`, dan tercatat lewat PR (keputusan di docs/decisions.md).
export type ComplianceStatement = {
  version: string;
  /** Tanggal berlaku, format ISO `YYYY-MM-DD` (WIB). */
  effectiveDate: string;
  /** `draft` sampai ditinjau fungsi hukum dan pengelola data instansi. */
  status: "draft" | "approved";
  text: string;
};

export const COMPLIANCE_STATEMENT: ComplianceStatement = {
  version: "0.1",
  effectiveDate: "2026-10-31",
  status: "draft",
  text:
    "Aplikasi ini dirancang dan dioperasikan dengan mengacu pada UU No. 27 Tahun 2022 tentang " +
    "Pelindungan Data Pribadi, PP No. 71 Tahun 2019 tentang Penyelenggaraan Sistem dan " +
    "Transaksi Elektronik, Perpres No. 95 Tahun 2018 tentang Sistem Pemerintahan Berbasis " +
    "Elektronik, Perpres No. 39 Tahun 2019 tentang Satu Data Indonesia, serta kebijakan " +
    "internal instansi. Data peserta hanya digunakan untuk pemantauan dan pelaporan pelatihan, " +
    "diakses sesuai kewenangan, dan tidak dikirim ke penyedia AI dalam bentuk yang " +
    "mengidentifikasi peserta. Status risiko dan rekomendasi AI adalah alat bantu; keputusan " +
    "tetap berada pada petugas yang berwenang.",
};

/** `2026-10-31` → `31 Oktober 2026`. */
export function formatIndonesianDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new RangeError(`Tanggal tidak valid: ${isoDate}`);
  const [, year, month, day] = match;
  return `${Number(day)} ${monthName(Number(month))} ${year}`;
}
