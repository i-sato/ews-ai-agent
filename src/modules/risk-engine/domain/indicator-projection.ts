/**
 * Proyeksi indikator akhir periode (projection engine, §8): tren linear dari titik realisasi
 * terlama di dalam jendela sampai titik terbaru, diperpanjang ke akhir periode PK (keputusan
 * F3-05). Bukan kepastian; tidak tersedia bila data tidak memadai.
 */
import { calendarDaysBetween } from "./schedule-rules";

export interface RealizationPoint {
  /** Tanggal WIB `YYYY-MM-DD`. */
  date: string;
  value: number;
  /** Versi dokumen PK yang dipakai saat realisasi dihitung. */
  documentVersion: number;
}

export interface ProjectionOptions {
  kind: "percentage" | "cumulative_count";
  period: { start: string; end: string };
  /** `indicator_projection_window_days` dari versi aturan; null bila belum dikonfigurasi. */
  windowDays: number | null;
}

export type ProjectionUnavailable =
  | "INSUFFICIENT_DATA"
  | "NON_POSITIVE_INTERVAL"
  | "DOCUMENT_CHANGED"
  | "NEGATIVE_TREND"
  | "NO_RULE_CONFIG";

export type IndicatorProjection =
  | {
      available: true;
      projectedFinal: number;
      velocityPerDay: number;
      basis: { from: string; to: string };
    }
  | { available: false; reason: ProjectionUnavailable };

const unavailable = (reason: ProjectionUnavailable) => ({ available: false as const, reason });

function finalValue(kind: ProjectionOptions["kind"], raw: number): number {
  if (kind === "cumulative_count") return Math.round(raw);
  return Math.min(100, Math.max(0, Math.round(raw * 10) / 10));
}

/** Titik dalam jendela dengan versi dokumen yang sama dengan titik terbaru, terurut tanggal. */
function windowPoints(points: readonly RealizationPoint[], opts: ProjectionOptions, days: number) {
  const inPeriod = points
    .filter((p) => p.date >= opts.period.start && p.date <= opts.period.end)
    .sort((a, b) => a.date.localeCompare(b.date));
  const latest = inPeriod.at(-1);
  if (!latest) return { latest, window: [], otherVersion: false };
  const inWindow = inPeriod.filter((p) => calendarDaysBetween(p.date, latest.date) <= days);
  const window = inWindow.filter((p) => p.documentVersion === latest.documentVersion);
  return { latest, window, otherVersion: window.length < inWindow.length };
}

export function projectIndicator(
  points: readonly RealizationPoint[],
  opts: ProjectionOptions,
): IndicatorProjection {
  if (opts.windowDays === null) return unavailable("NO_RULE_CONFIG");
  const { latest, window, otherVersion } = windowPoints(points, opts, opts.windowDays);
  if (!latest || window.length < 2) {
    return unavailable(otherVersion ? "DOCUMENT_CHANGED" : "INSUFFICIENT_DATA");
  }
  const first = window[0] as RealizationPoint;
  const days = calendarDaysBetween(first.date, latest.date);
  if (days <= 0) return unavailable("NON_POSITIVE_INTERVAL");
  const velocity = (latest.value - first.value) / days;
  if (opts.kind === "cumulative_count" && velocity < 0) return unavailable("NEGATIVE_TREND");
  const remaining = Math.max(0, calendarDaysBetween(latest.date, opts.period.end));
  return {
    available: true,
    projectedFinal: finalValue(opts.kind, latest.value + velocity * remaining),
    velocityPerDay: Math.round(velocity * 1000) / 1000,
    basis: { from: first.date, to: latest.date },
  };
}
