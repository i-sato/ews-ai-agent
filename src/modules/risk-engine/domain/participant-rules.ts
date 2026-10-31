/**
 * Rule risiko individu yang tidak memerlukan rencana belajar (spesifikasi §8.2):
 * DATA_INVALID, NOT_STARTED, PASS_PENDING, PROGRESS_STAGNANT.
 * Ambang berasal dari `risk_rule_versions.configuration` yang disetujui, bukan konstanta di sini.
 */

export type ParticipantRule = "DATA_INVALID" | "NOT_STARTED" | "PASS_PENDING" | "PROGRESS_STAGNANT";
export type ParticipantStatus = "critical" | "warning" | "normal" | "invalid";

export interface RuleConfig {
  notStartedDays: number;
  notStartedCriticalRemainingDays: number;
  stagnantDays: number;
  passPendingDaysBeforeEnd: number;
  lmsConsistencyTolerancePp: number;
}

export interface ParticipantSnapshot {
  completedItems: number;
  totalItems: number;
  lmsPercentage: number | null;
  qualityFlags: string[];
  enrollmentStatus: "passed" | "not_passed" | "cancelled" | "in_progress" | "unmapped";
  /** Sudah masuk penyebut indikator persentase (mis. progres ≥ 90%). */
  inDenominator: boolean;
  /** Hari sejak jumlah item selesai terakhir berubah; null bila belum ada snapshot sebelumnya. */
  daysSinceLastChange: number | null;
}

export interface TrainingClock {
  daysSinceStart: number;
  daysUntilEnd: number;
}

export interface ParticipantAssessment {
  status: ParticipantStatus;
  rules: ParticipantRule[];
}

export function lmsInconsistent(s: ParticipantSnapshot, tolerancePp: number): boolean {
  if (s.lmsPercentage === null || s.totalItems === 0) return false;
  const ratio = (s.completedItems / s.totalItems) * 100;
  return Math.abs(ratio - s.lmsPercentage) > tolerancePp;
}

function isInvalid(s: ParticipantSnapshot, cfg: RuleConfig): boolean {
  const outOfRange = s.lmsPercentage !== null && (s.lmsPercentage < 0 || s.lmsPercentage > 100);
  return (
    outOfRange ||
    s.qualityFlags.includes("formula_error") ||
    lmsInconsistent(s, cfg.lmsConsistencyTolerancePp)
  );
}

function notStartedStatus(s: ParticipantSnapshot, clock: TrainingClock, cfg: RuleConfig) {
  if (s.completedItems > 0 || clock.daysSinceStart < cfg.notStartedDays) return null;
  return clock.daysUntilEnd < cfg.notStartedCriticalRemainingDays ? "critical" : "warning";
}

function isPassPending(s: ParticipantSnapshot, clock: TrainingClock, cfg: RuleConfig): boolean {
  return s.inDenominator && clock.daysUntilEnd <= cfg.passPendingDaysBeforeEnd;
}

function isStagnant(s: ParticipantSnapshot, cfg: RuleConfig): boolean {
  const partial = s.completedItems > 0 && s.completedItems < s.totalItems;
  return partial && (s.daysSinceLastChange ?? 0) >= cfg.stagnantDays;
}

export function assessParticipant(
  s: ParticipantSnapshot,
  clock: TrainingClock,
  cfg: RuleConfig,
): ParticipantAssessment {
  if (s.enrollmentStatus === "cancelled" || s.enrollmentStatus === "passed") {
    return { status: "normal", rules: [] };
  }
  if (isInvalid(s, cfg)) return { status: "invalid", rules: ["DATA_INVALID"] };
  const notStarted = notStartedStatus(s, clock, cfg);
  const checks: Array<[boolean, ParticipantRule]> = [
    [notStarted !== null, "NOT_STARTED"],
    [isPassPending(s, clock, cfg), "PASS_PENDING"],
    [isStagnant(s, cfg), "PROGRESS_STAGNANT"],
  ];
  const rules = checks.filter(([hit]) => hit).map(([, rule]) => rule);
  const status = notStarted === "critical" ? "critical" : rules.length ? "warning" : "normal";
  return { status, rules };
}
