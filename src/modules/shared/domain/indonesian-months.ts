export const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

const ABBREVIATIONS: Readonly<Record<string, number>> = {
  jan: 1,
  feb: 2,
  peb: 2,
  mar: 3,
  apr: 4,
  mei: 5,
  jun: 6,
  jul: 7,
  agu: 8,
  agt: 8,
  ags: 8,
  sep: 9,
  okt: 10,
  nov: 11,
  nop: 11,
  des: 12,
};

/** Nama bulan Indonesia untuk `{{MM_month}}`; bulan 1–12. */
export function monthName(month: number): string {
  const name = MONTH_NAMES[month - 1];
  if (!name) throw new RangeError(`Bulan tidak valid: ${month}`);
  return name;
}

/** Nomor bulan dari nama atau singkatan ("Sept", "AGUSTUS", "Okt"); null bila tidak dikenal. */
export function parseMonth(token: string): number | null {
  const key = token.trim().toLowerCase().replace(/\.$/, "");
  if (key.length < 3) return null;
  const full = MONTH_NAMES.findIndex((m) => m.toLowerCase() === key);
  if (full >= 0) return full + 1;
  return ABBREVIATIONS[key.slice(0, 3)] ?? null;
}
