/** Perhitungan capaian indikator PK (spesifikasi §8.1, §8.7). Murni dan deterministik. */

export type IndicatorStatus = "critical" | "warning" | "normal" | "not_assessable";

const round = (value: number, digits = 1) => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

/** P = Σ lulus ÷ Σ peserta yang mengikuti × 100. Null bila penyebut nol. */
export function percentageRealization(passed: number, participating: number): number | null {
  if (participating <= 0) return null;
  if (passed < 0 || passed > participating) throw new RangeError("passed di luar 0..participating");
  return round((passed / participating) * 100);
}

/** Jumlah kumulatif IKSK 3.2: baseline tahun lalu + peserta yang menyelesaikan tahun ini. */
export function cumulativeRealization(baseline: number, completedThisYear: number): number {
  if (baseline < 0 || completedThisYear < 0) throw new RangeError("nilai negatif");
  return baseline + completedThisYear;
}

/** A = R ÷ T × 100. Null bila target tidak tersedia atau tidak positif. */
export function achievementRate(realization: number, target: number | null): number | null {
  if (target === null || target <= 0) return null;
  return round((realization / target) * 100);
}

/** G = R − T_rencana. Negatif berarti tertinggal dari target antara. */
export function gap(realization: number, plannedTarget: number | null): number | null {
  if (plannedTarget === null) return null;
  return round(realization - plannedTarget);
}

export interface IndicatorAssessmentInput {
  realization: number | null;
  plannedTarget: number | null; // target antara bulan berjalan
  finalTarget: number | null;
  projectedFinal: number | null;
}

export interface IndicatorAssessment {
  status: IndicatorStatus;
  triggeredRules: Array<"TARGET_GAP" | "TARGET_UNLIKELY">;
  gap: number | null;
  achievementRate: number | null;
}

/**
 * `TARGET_GAP` (waspada) bila di bawah target antara;
 * `TARGET_UNLIKELY` (kritis) bila proyeksi akhir di bawah target resmi.
 */
export function assessIndicator(input: IndicatorAssessmentInput): IndicatorAssessment {
  const { realization, plannedTarget, finalTarget, projectedFinal } = input;
  if (realization === null) {
    return { status: "not_assessable", triggeredRules: [], gap: null, achievementRate: null };
  }
  const g = gap(realization, plannedTarget);
  const rules: IndicatorAssessment["triggeredRules"] = [];
  if (g !== null && g < 0) rules.push("TARGET_GAP");
  if (projectedFinal !== null && finalTarget !== null && projectedFinal < finalTarget) {
    rules.push("TARGET_UNLIKELY");
  }
  const status = rules.includes("TARGET_UNLIKELY")
    ? "critical"
    : rules.length
      ? "warning"
      : "normal";
  return {
    status,
    triggeredRules: rules,
    gap: g,
    achievementRate: achievementRate(realization, finalTarget),
  };
}
