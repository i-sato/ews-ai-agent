/**
 * DATA_STALE (spesifikasi §8.2, §3.5): waktu perubahan terakhir (isi atau `modifiedTime` Drive)
 * melewati batas kesegaran selama periode pelatihan. `fetched_at` dan label `UPDATE TERAKHIR`
 * bukan acuan. Ambang dari versi aturan (`freshness_threshold_hours`, keputusan F3-05).
 */
import { assessFreshness } from "@/modules/ingestion/domain/freshness";

export interface StaleInput {
  period: { startDate: string | null; endDate: string | null };
  /** Tanggal hari ini menurut WIB (`YYYY-MM-DD`). */
  today: string;
  now: string;
  /** Waktu dari snapshot valid terakhir; null bila belum pernah ada impor. */
  source: {
    fetchedAt: string;
    contentChangedAt: string | null;
    driveModifiedAt: string | null;
    labelUpdatedAt: string | null;
  } | null;
}

export interface StaleResult {
  outcome: "triggered" | "clear" | "not_applicable" | "not_assessable";
  reason?: "NO_DATA" | "NO_TRAINING_PERIOD" | "NO_RULE_CONFIG";
  referenceAt: string | null;
  ageHours: number | null;
}

const empty = { referenceAt: null, ageHours: null };

export function assessDataStale(input: StaleInput, thresholdHours: number | null): StaleResult {
  const { startDate, endDate } = input.period;
  if (!startDate || !endDate) {
    return { outcome: "not_assessable", reason: "NO_TRAINING_PERIOD", ...empty };
  }
  if (input.today < startDate || input.today > endDate) {
    return { outcome: "not_applicable", ...empty };
  }
  if (thresholdHours === null)
    return { outcome: "not_assessable", reason: "NO_RULE_CONFIG", ...empty };
  if (!input.source) return { outcome: "triggered", reason: "NO_DATA", ...empty };
  const result = assessFreshness({ ...input.source, thresholdHours, now: input.now });
  const ageHours = result.referenceAt
    ? Math.round((Date.parse(input.now) - Date.parse(result.referenceAt)) / 360_000) / 10
    : null;
  return {
    outcome: result.isStale ? "triggered" : "clear",
    referenceAt: result.referenceAt,
    ageHours,
  };
}
