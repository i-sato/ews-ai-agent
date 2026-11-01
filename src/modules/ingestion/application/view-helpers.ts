import { assessFreshness } from "../domain/freshness";
import type { ProgressSnapshot } from "./view-ports";

/** Tanggal hari ini (YYYY-MM-DD) di zona WIB. */
export function todayWib(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(now);
}

export interface FreshnessView {
  checkedAt: string;
  contentChangedAt: string | null;
  labelUpdatedAt: string | null;
  labelNotUpdated: boolean;
  stale: boolean;
}

/**
 * Dua waktu kesegaran untuk tampilan (§3.5): kapan dicek dan kapan isi berubah. Acuan kedaluwarsa
 * adalah perubahan isi atau `modifiedTime` Drive; label UPDATE TERAKHIR hanya pembanding.
 */
export function freshnessOf(snapshot: ProgressSnapshot, now: Date): FreshnessView {
  const checkedAt = snapshot.lastCheckedAt ?? snapshot.fetchedAt;
  const drive =
    snapshot.sourceUpdatedAt === snapshot.labelUpdatedAt ? null : snapshot.sourceUpdatedAt;
  const result = assessFreshness({
    fetchedAt: checkedAt,
    contentChangedAt: snapshot.contentChangedAt,
    driveModifiedAt: drive,
    labelUpdatedAt: snapshot.labelUpdatedAt,
    thresholdHours: snapshot.freshnessThresholdHours,
    now: now.toISOString(),
  });
  return {
    checkedAt,
    contentChangedAt: snapshot.contentChangedAt,
    labelUpdatedAt: snapshot.labelUpdatedAt,
    labelNotUpdated: result.labelNotUpdated,
    stale: result.isStale,
  };
}
