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

export type IndicatorRule = "TARGET_GAP" | "TARGET_UNLIKELY";

export interface IndicatorAssessmentInput {
  realization: number | null;
  /** Target antara bulan berjalan (`plannedTargetFor`); null bila tidak tersedia. */
  plannedTarget: number | null;
  finalTarget: number | null;
  /** Proyeksi akhir periode (`projectIndicator`); null bila tidak tersedia. */
  projectedFinal: number | null;
}

export interface IndicatorRuleOutcome {
  rule: IndicatorRule;
  outcome: "triggered" | "clear" | "not_assessable";
  reason?: "NO_PLANNED_TARGET" | "NO_TARGET" | "NO_PROJECTION";
}

export interface IndicatorAssessment {
  status: IndicatorStatus;
  triggeredRules: IndicatorRule[];
  outcomes: IndicatorRuleOutcome[];
  gap: number | null;
  achievementRate: number | null;
}

function targetGap(realization: number, plannedTarget: number | null): IndicatorRuleOutcome {
  const rule = "TARGET_GAP";
  if (plannedTarget === null)
    return { rule, outcome: "not_assessable", reason: "NO_PLANNED_TARGET" };
  return { rule, outcome: realization < plannedTarget ? "triggered" : "clear" };
}

function targetUnlikely(input: IndicatorAssessmentInput): IndicatorRuleOutcome {
  const rule = "TARGET_UNLIKELY";
  const { finalTarget, projectedFinal } = input;
  if (finalTarget === null || finalTarget < 0) {
    return { rule, outcome: "not_assessable", reason: "NO_TARGET" };
  }
  if (projectedFinal === null) return { rule, outcome: "not_assessable", reason: "NO_PROJECTION" };
  return { rule, outcome: projectedFinal < finalTarget ? "triggered" : "clear" };
}

function statusOf(outcomes: IndicatorRuleOutcome[]): IndicatorStatus {
  const hit = (rule: IndicatorRule) =>
    outcomes.some((o) => o.rule === rule && o.outcome === "triggered");
  if (hit("TARGET_UNLIKELY")) return "critical";
  if (hit("TARGET_GAP")) return "warning";
  if (outcomes.some((o) => o.outcome === "not_assessable")) return "not_assessable";
  return "normal";
}

/**
 * `TARGET_GAP` (waspada) bila di bawah target antara bulan berjalan; `TARGET_UNLIKELY` (kritis)
 * bila proyeksi akhir di bawah target resmi. Target atau proyeksi yang tidak tersedia membuat
 * rule-nya tidak dapat dinilai; tanpa rule terpicu, status `not_assessable`, bukan `normal`.
 */
export function assessIndicator(input: IndicatorAssessmentInput): IndicatorAssessment {
  const { realization, plannedTarget, finalTarget } = input;
  if (realization === null) {
    const outcomes: IndicatorRuleOutcome[] = [];
    const base = { triggeredRules: [], outcomes, gap: null, achievementRate: null };
    return { status: "not_assessable", ...base };
  }
  const outcomes = [targetGap(realization, plannedTarget), targetUnlikely(input)];
  return {
    status: statusOf(outcomes),
    triggeredRules: outcomes.filter((o) => o.outcome === "triggered").map((o) => o.rule),
    outcomes,
    gap: gap(realization, plannedTarget),
    achievementRate: achievementRate(realization, finalTarget),
  };
}
