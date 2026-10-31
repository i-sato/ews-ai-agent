import { parseMonth } from "@/modules/shared/domain/indonesian-months";

export interface TrainingPeriod {
  start: string; // YYYY-MM-DD
  end: string;
}

export type UpdateLabelResult =
  | { ok: true; sourceUpdatedAt: string; yearUncertain: boolean }
  | { ok: false; reason: "UNPARSEABLE" | "YEAR_UNKNOWN" };

const LABEL = /UPDATE\s+TERAKHIR\s*:?\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{1,2})[:.](\d{2})/i;

const pad = (n: number) => String(n).padStart(2, "0");

function inferYear(month: number, period: TrainingPeriod): { year: number; uncertain: boolean } {
  const startYear = Number(period.start.slice(0, 4));
  const endYear = Number(period.end.slice(0, 4));
  if (startYear === endYear) return { year: startYear, uncertain: false };
  const startMonth = Number(period.start.slice(5, 7));
  return { year: month >= startMonth ? startYear : endYear, uncertain: true };
}

/**
 * Urai sel `UPDATE TERAKHIR: 13 OKTOBER 11:43 WIB`. Sel tidak memuat tahun, sehingga tahun
 * diambil dari periode pelatihan; periode lintas tahun ditandai tidak pasti (spesifikasi §3.3).
 */
export function parseUpdateLabel(label: string, period: TrainingPeriod | null): UpdateLabelResult {
  const m = LABEL.exec(label);
  const month = m ? parseMonth(m[2] as string) : null;
  if (!m || !month) return { ok: false, reason: "UNPARSEABLE" };
  if (!period) return { ok: false, reason: "YEAR_UNKNOWN" };
  const { year, uncertain } = inferYear(month, period);
  const iso = `${year}-${pad(month)}-${pad(Number(m[1]))}T${pad(Number(m[3]))}:${m[4]}:00+07:00`;
  return { ok: true, sourceUpdatedAt: iso, yearUncertain: uncertain };
}
