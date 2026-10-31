/** Tiga waktu kesegaran (spesifikasi §3.5). Semua dalam ISO 8601. */
export interface FreshnessInput {
  fetchedAt: string;
  contentChangedAt: string | null;
  driveModifiedAt: string | null;
  labelUpdatedAt: string | null;
  thresholdHours: number;
  now: string;
}

export interface FreshnessResult {
  referenceAt: string | null;
  isStale: boolean;
  labelNotUpdated: boolean;
}

const ms = (iso: string) => new Date(iso).getTime();

function latest(values: Array<string | null>): string | null {
  const present = values.filter((v): v is string => v !== null);
  if (present.length === 0) return null;
  return present.reduce((a, b) => (ms(b) > ms(a) ? b : a));
}

/**
 * Acuan = terbaru dari perubahan isi dan `modifiedTime` Drive.
 * Sel `UPDATE TERAKHIR` hanya pembanding.
 * `fetchedAt` tidak pernah dipakai sebagai bukti data baru.
 */
export function assessFreshness(input: FreshnessInput): FreshnessResult {
  const referenceAt = latest([input.contentChangedAt, input.driveModifiedAt]);
  const ageHours = referenceAt ? (ms(input.now) - ms(referenceAt)) / 3_600_000 : Infinity;
  const labelNotUpdated =
    input.contentChangedAt !== null &&
    input.labelUpdatedAt !== null &&
    ms(input.contentChangedAt) > ms(input.labelUpdatedAt);
  return { referenceAt, isStale: ageHours > input.thresholdHours, labelNotUpdated };
}
