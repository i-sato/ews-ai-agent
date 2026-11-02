/** Target antara bulanan sebagai rencana kumulatif T_t (spesifikasi §8.1, §8.7). */
export interface MonthlyTarget {
  month: number;
  value: number | null;
}

/**
 * Target antara untuk bulan dari `today` (tanggal WIB `YYYY-MM-DD`). Null bila tanggal di luar
 * periode PK, bulan tersebut belum punya target, atau nilainya tidak valid: TARGET_GAP lalu
 * tidak dapat dinilai, bukan normal.
 */
export function plannedTargetFor(
  targets: readonly MonthlyTarget[],
  today: string,
  period: { start: string; end: string },
): number | null {
  if (today < period.start || today > period.end) return null;
  const month = Number(today.slice(5, 7));
  const value = targets.find((t) => t.month === month)?.value ?? null;
  return value === null || value < 0 ? null : value;
}
