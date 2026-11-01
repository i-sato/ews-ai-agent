import type { ItemType } from "./item-type";
import type { EnrollmentStatus, ItemStatus } from "./status-mapping";

// Pemantauan detail per pelatihan dan item (spesifikasi §8.6). Indikator awal, bukan realisasi PK.

export type Category = "not_started" | "partial" | "completed" | "check";

export interface ProgressRow {
  enrollmentStatus: EnrollmentStatus;
  onboardingStatus: boolean | null;
  completionPercentage: number | null;
  qualityFlags: readonly string[];
  /** Status per item sesuai urutan katalog. */
  statuses: readonly ItemStatus[];
}

export interface SummaryItem {
  sequence: number;
  code: string;
  name: string;
  type: ItemType;
}

/** Bendera yang setara `DATA_INVALID` (rules engine F3-03): "perlu dicek", keluar dari penyebut. */
const CHECK_FLAGS = ["formula_error", "lms_mismatch", "lms_invalid"];

/** Pendaftar dalam seleksi dan yang batal bukan peserta yang dinilai penyelesaiannya. */
const OUTSIDE = new Set<EnrollmentStatus>(["cancelled", "in_selection"]);

const doneCount = (statuses: readonly ItemStatus[]) =>
  statuses.filter((s) => s === "completed").length;

export function categoryOf(row: ProgressRow): Category {
  if (row.qualityFlags.some((f) => CHECK_FLAGS.includes(f))) return "check";
  const done = doneCount(row.statuses);
  if (done === 0) return "not_started";
  return done === row.statuses.length ? "completed" : "partial";
}

/** Item pertama yang belum selesai; `skipped` = item sesudahnya yang sudah selesai. */
export function stopPoint(
  statuses: readonly ItemStatus[],
): { index: number; skipped: number } | null {
  const done = doneCount(statuses);
  if (done === 0 || done === statuses.length) return null;
  const index = statuses.findIndex((s) => s !== "completed");
  return { index, skipped: doneCount(statuses.slice(index + 1)) };
}

export interface ItemSummary extends SummaryItem {
  done: number;
  notDone: number;
  stopHere: number;
}

export interface ProgressSummary {
  funnel: {
    registered: number;
    accepted: number;
    onboarded: number;
    started: number;
    completedAll: number;
    passed: number;
  };
  categories: Record<Category, number>;
  denominator: number;
  items: ItemSummary[];
  topStops: { code: string; name: string; type: ItemType; count: number }[];
  otherStops: { participants: number; items: number };
  averageLms: number | null;
}

function funnelOf(rows: readonly ProgressRow[]): ProgressSummary["funnel"] {
  const registered = rows.filter((r) => r.enrollmentStatus !== "cancelled");
  const started = registered.filter((r) => doneCount(r.statuses) > 0);
  return {
    registered: registered.length,
    accepted: registered.filter((r) => r.enrollmentStatus !== "in_selection").length,
    onboarded: registered.filter((r) => r.onboardingStatus === true).length,
    started: started.length,
    completedAll: started.filter((r) => doneCount(r.statuses) === r.statuses.length).length,
    passed: registered.filter((r) => r.enrollmentStatus === "passed").length,
  };
}

function itemSummaries(
  valid: readonly ProgressRow[],
  items: readonly SummaryItem[],
): ItemSummary[] {
  const stops = new Map<number, number>();
  for (const r of valid) {
    const stop = stopPoint(r.statuses);
    if (stop) stops.set(stop.index, (stops.get(stop.index) ?? 0) + 1);
  }
  return items.map((item, i) => {
    const done = valid.filter((r) => r.statuses[i] === "completed").length;
    return { ...item, done, notDone: valid.length - done, stopHere: stops.get(i) ?? 0 };
  });
}

const TOP_STOPS = 2;

function stopRanking(items: readonly ItemSummary[]) {
  const ranked = items
    .filter((i) => i.stopHere > 0)
    .sort((a, b) => b.stopHere - a.stopHere || a.sequence - b.sequence);
  const rest = ranked.slice(TOP_STOPS);
  return {
    topStops: ranked
      .slice(0, TOP_STOPS)
      .map((i) => ({ code: i.code, name: i.name, type: i.type, count: i.stopHere })),
    otherStops: { participants: rest.reduce((n, i) => n + i.stopHere, 0), items: rest.length },
  };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

export function summarizeProgress(
  rows: readonly ProgressRow[],
  items: readonly SummaryItem[],
): ProgressSummary {
  const participants = rows.filter((r) => !OUTSIDE.has(r.enrollmentStatus));
  const categories: Record<Category, number> = {
    not_started: 0,
    partial: 0,
    completed: 0,
    check: 0,
  };
  for (const r of participants) categories[categoryOf(r)]++;
  const valid = participants.filter((r) => categoryOf(r) !== "check");
  const itemStats = itemSummaries(valid, items);
  const lms = valid.map((r) => r.completionPercentage).filter((v): v is number => v !== null);
  return {
    funnel: funnelOf(rows),
    categories,
    denominator: valid.length,
    items: itemStats,
    ...stopRanking(itemStats),
    averageLms: average(lms),
  };
}
