import { monthName } from "@/modules/shared/domain/indonesian-months";

/** Cakupan laporan per pelatihan, bulanan, atau tahunan (spesifikasi §10.2). */

export type ReportScope = "monthly" | "annual";
export type StatusAtCutoff = "completed" | "in_progress" | "planned" | "cancelled";

export interface ReportPeriod {
  scope: ReportScope;
  start: string; // YYYY-MM-DD
  end: string;
  label: string;
}

export interface TrainingForCoverage {
  id: string;
  startDate: string | null;
  endDate: string | null;
  cancelled: boolean;
  hasValidSnapshot: boolean;
  allEnrollmentStatusesFilled: boolean;
}

export interface CoverageEntry {
  trainingId: string;
  statusAtCutoff: StatusAtCutoff;
  countsTowardTotals: boolean;
  provisional: boolean;
  notes: Array<"NO_VALID_SNAPSHOT" | "AWAITING_PASS_STATUS" | "NOT_COUNTED">;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function reportPeriod(scope: ReportScope, year: number, month?: number): ReportPeriod {
  if (scope === "annual") {
    return { scope, start: `${year}-01-01`, end: `${year}-12-31`, label: `TA. ${year}` };
  }
  if (!month || month < 1 || month > 12) throw new RangeError("Bulan wajib 1–12");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    scope,
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(lastDay)}`,
    label: `${monthName(month)} TA. ${year}`,
  };
}

/** Tanggal batas data: akhir periode, atau hari ini bila periode belum berakhir. */
export function dataCutoff(
  period: ReportPeriod,
  today: string,
): { cutoff: string; provisional: boolean } {
  return today < period.end
    ? { cutoff: today, provisional: true }
    : { cutoff: period.end, provisional: false };
}

export function overlaps(t: TrainingForCoverage, period: ReportPeriod): boolean {
  if (!t.startDate || !t.endDate) return false;
  return t.startDate <= period.end && t.endDate >= period.start;
}

export function statusAtCutoff(t: TrainingForCoverage, cutoff: string): StatusAtCutoff {
  if (t.cancelled) return "cancelled";
  if (!t.startDate || t.startDate > cutoff) return "planned";
  return t.endDate && t.endDate <= cutoff ? "completed" : "in_progress";
}

function entryFor(t: TrainingForCoverage, cutoff: string): CoverageEntry {
  const status = statusAtCutoff(t, cutoff);
  const counted = status === "completed" || status === "in_progress";
  const notes: CoverageEntry["notes"] = [];
  if (!counted) notes.push("NOT_COUNTED");
  if (counted && !t.hasValidSnapshot) notes.push("NO_VALID_SNAPSHOT");
  if (status === "completed" && !t.allEnrollmentStatusesFilled) notes.push("AWAITING_PASS_STATUS");
  return {
    trainingId: t.id,
    statusAtCutoff: status,
    countsTowardTotals: counted,
    provisional: status === "in_progress",
    notes,
  };
}

/**
 * Semua pelatihan tim kerja yang periodenya beririsan dengan periode laporan, termasuk yang tidak
 * dihitung (direncanakan/dibatalkan) agar tercantum di catatan cakupan, bukan dibuang diam-diam.
 */
export function buildCoverage(
  trainings: readonly TrainingForCoverage[],
  period: ReportPeriod,
  today: string,
): { cutoff: string; provisional: boolean; entries: CoverageEntry[] } {
  const { cutoff, provisional } = dataCutoff(period, today);
  const entries = trainings.filter((t) => overlaps(t, period)).map((t) => entryFor(t, cutoff));
  return { cutoff, provisional, entries };
}

/** Agregat lintas pelatihan dari jumlah, bukan rata-rata persentase per pelatihan. */
export function aggregateRate(
  rows: ReadonlyArray<{ numerator: number; denominator: number }>,
): number | null {
  const num = rows.reduce((a, r) => a + r.numerator, 0);
  const den = rows.reduce((a, r) => a + r.denominator, 0);
  return den > 0 ? Math.round((num / den) * 1000) / 10 : null;
}
