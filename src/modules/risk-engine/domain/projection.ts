/** Proyeksi peserta linear dari dua snapshot (spesifikasi §8.3). Bukan kepastian. */
export interface ProgressPoint {
  percentage: number;
  capturedAt: string;
  catalogVersion: number;
}

export type ProjectionResult =
  | { available: true; velocityPerDay: number; remainingDays: number | null }
  | { available: false; reason: "INSUFFICIENT_DATA" | "CATALOG_CHANGED" | "NON_POSITIVE_INTERVAL" };

const DAY_MS = 86_400_000;

export function projectParticipant(
  earlier: ProgressPoint,
  latest: ProgressPoint,
): ProjectionResult {
  if (earlier.catalogVersion !== latest.catalogVersion) {
    return { available: false, reason: "CATALOG_CHANGED" };
  }
  const days =
    (new Date(latest.capturedAt).getTime() - new Date(earlier.capturedAt).getTime()) / DAY_MS;
  if (!(days > 0)) return { available: false, reason: "NON_POSITIVE_INTERVAL" };
  const velocity = (latest.percentage - earlier.percentage) / days;
  if (latest.percentage >= 100)
    return { available: true, velocityPerDay: velocity, remainingDays: 0 };
  const remaining = velocity > 0 ? (100 - latest.percentage) / velocity : null;
  return { available: true, velocityPerDay: velocity, remainingDays: remaining };
}
