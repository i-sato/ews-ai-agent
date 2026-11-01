/**
 * Rule risiko berbasis rencana belajar (spesifikasi §8.2): BEHIND_SCHEDULE, COMPLETION_AT_RISK,
 * MODULE_INCOMPLETE. Hanya dinilai bila rencana belajar disetujui; bila tidak, hasilnya
 * `not_assessable`, bukan `normal`. Ambang dari `risk_rule_versions.configuration`.
 * Tanggal adalah tanggal kalender WIB (`YYYY-MM-DD`); tenggat hari ini belum dianggap lewat.
 */
import { type ProgressPoint, projectParticipant } from "./projection";

export type ScheduleRule = "BEHIND_SCHEDULE" | "COMPLETION_AT_RISK" | "MODULE_INCOMPLETE";
export type ScheduleStatus = "critical" | "warning" | "normal" | "not_assessable";
export type ItemState = "completed" | "not_started" | "unknown";
export type NotAssessableReason =
  | "NO_APPROVED_PLAN"
  | "NO_RULE_CONFIG"
  | "PLAN_CATALOG_MISMATCH"
  | "NO_DUE_DATES"
  | "INSUFFICIENT_DATA"
  | "CATALOG_CHANGED"
  | "NON_POSITIVE_INTERVAL"
  | "NON_POSITIVE_VELOCITY";

export interface ScheduleRuleConfig {
  behindScheduleTolerancePp: number;
  moduleDueWarningDays: number;
}

export interface PlanItem {
  code: string;
  required: boolean;
  dueDate: string | null;
}

export interface ScheduleInput {
  /** Rencana belajar versi terbaru; `approved` hanya bila seluruh barisnya disetujui. */
  plan: { approved: boolean; items: PlanItem[] } | null;
  enrollmentStatus: string;
  items: Array<{ code: string; status: ItemState }>;
  earlier: ProgressPoint | null;
  latest: ProgressPoint;
  today: string;
}

export interface RuleOutcome {
  rule: ScheduleRule;
  outcome: "triggered" | "clear" | "not_assessable";
  severity?: "warning" | "critical";
  reason?: NotAssessableReason;
}

export interface ScheduleMetrics {
  plannedProgress: number | null;
  actualProgress: number | null;
  gapPp: number | null;
  deadline: string | null;
  availableDays: number | null;
  projectedRemainingDays: number | null;
  overdueRequired: string[];
  dueSoonRequired: string[];
  unknownItems: string[];
}

export interface ScheduleAssessment {
  status: ScheduleStatus;
  rules: ScheduleRule[];
  outcomes: RuleOutcome[];
  reason?: NotAssessableReason;
  metrics: ScheduleMetrics;
}

type Dated = PlanItem & { dueDate: string };
type Context = { input: ScheduleInput; cfg: ScheduleRuleConfig; dated: Dated[]; done: Set<string> };

const NOT_ASSESSED = ["passed", "cancelled", "in_selection"];
const DAY_MS = 86_400_000;
const round1 = (n: number) => Math.round(n * 10) / 10;

const EMPTY_METRICS: ScheduleMetrics = {
  plannedProgress: null,
  actualProgress: null,
  gapPp: null,
  deadline: null,
  availableDays: null,
  projectedRemainingDays: null,
  overdueRequired: [],
  dueSoonRequired: [],
  unknownItems: [],
};

/** Selisih hari kalender `to − from` untuk tanggal `YYYY-MM-DD` (tanpa jam dan zona waktu). */
export function calendarDaysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

function unassessable(reason: NotAssessableReason): ScheduleAssessment {
  return { status: "not_assessable", rules: [], outcomes: [], reason, metrics: EMPTY_METRICS };
}

function precondition(
  input: ScheduleInput,
  cfg: ScheduleRuleConfig | null,
): NotAssessableReason | null {
  const plan = input.plan;
  if (!plan || !plan.approved || plan.items.length === 0) return "NO_APPROVED_PLAN";
  if (!cfg) return "NO_RULE_CONFIG";
  const codes = new Set(input.items.map((i) => i.code));
  if (plan.items.some((p) => !codes.has(p.code))) return "PLAN_CATALOG_MISMATCH";
  if (plan.items.every((p) => p.dueDate === null)) return "NO_DUE_DATES";
  return null;
}

function behindSchedule(ctx: Context) {
  const { dated, done, input, cfg } = ctx;
  const due = dated.filter((p) => p.dueDate <= input.today).length;
  const completed = dated.filter((p) => done.has(p.code)).length;
  const planned = round1((due / dated.length) * 100);
  const actual = round1((completed / dated.length) * 100);
  const gapPp = round1(actual - planned);
  const hit = gapPp < -cfg.behindScheduleTolerancePp;
  const outcome: RuleOutcome = hit
    ? { rule: "BEHIND_SCHEDULE", outcome: "triggered", severity: "warning" }
    : { rule: "BEHIND_SCHEDULE", outcome: "clear" };
  return { outcome, metrics: { plannedProgress: planned, actualProgress: actual, gapPp } };
}

function projectionReason(input: ScheduleInput): NotAssessableReason | number {
  if (!input.earlier) return "INSUFFICIENT_DATA";
  const p = projectParticipant(input.earlier, input.latest);
  if (!p.available) return p.reason;
  return p.remainingDays === null ? "NON_POSITIVE_VELOCITY" : round1(p.remainingDays);
}

function completionAtRisk(ctx: Context) {
  const { input, dated } = ctx;
  const deadline = dated
    .map((p) => p.dueDate)
    .sort()
    .at(-1) as string;
  const availableDays = calendarDaysBetween(input.today, deadline) + 1;
  const metrics = { deadline, availableDays, projectedRemainingDays: null as number | null };
  const rule = "COMPLETION_AT_RISK" as const;
  const triggered: RuleOutcome = { rule, outcome: "triggered", severity: "critical" };
  const clear: RuleOutcome = { rule, outcome: "clear" };
  if (input.latest.percentage >= 100) return { outcome: clear, metrics };
  if (availableDays <= 0) return { outcome: triggered, metrics };
  const projected = projectionReason(input);
  if (typeof projected === "string") {
    const outcome: RuleOutcome = { rule, outcome: "not_assessable", reason: projected };
    return { outcome, metrics };
  }
  const outcome = projected > availableDays ? triggered : clear;
  return { outcome, metrics: { ...metrics, projectedRemainingDays: projected } };
}

function moduleIncomplete(ctx: Context) {
  const { dated, done, input, cfg } = ctx;
  const open = dated.filter((p) => p.required && !done.has(p.code));
  const daysLeft = (p: Dated) => calendarDaysBetween(input.today, p.dueDate);
  const overdueRequired = open.filter((p) => daysLeft(p) < 0).map((p) => p.code);
  const dueSoonRequired = open
    .filter((p) => daysLeft(p) >= 0 && daysLeft(p) <= cfg.moduleDueWarningDays)
    .map((p) => p.code);
  const rule = "MODULE_INCOMPLETE" as const;
  let outcome: RuleOutcome = { rule, outcome: "clear" };
  if (overdueRequired.length) outcome = { rule, outcome: "triggered", severity: "critical" };
  else if (dueSoonRequired.length) outcome = { rule, outcome: "triggered", severity: "warning" };
  return { outcome, metrics: { overdueRequired, dueSoonRequired } };
}

/** Rule terpicu menentukan status; bila tidak ada yang terpicu tetapi ada yang tak dapat dinilai,
 * status `not_assessable` (keputusan F3-04), bukan `normal`. */
function overallStatus(outcomes: RuleOutcome[]): ScheduleStatus {
  if (outcomes.some((o) => o.severity === "critical")) return "critical";
  if (outcomes.some((o) => o.outcome === "triggered")) return "warning";
  if (outcomes.some((o) => o.outcome === "not_assessable")) return "not_assessable";
  return "normal";
}

export function assessScheduleRules(
  input: ScheduleInput,
  cfg: ScheduleRuleConfig | null,
): ScheduleAssessment {
  if (NOT_ASSESSED.includes(input.enrollmentStatus)) {
    return { status: "normal", rules: [], outcomes: [], metrics: EMPTY_METRICS };
  }
  const blocked = precondition(input, cfg);
  if (blocked || !cfg || !input.plan) return unassessable(blocked ?? "NO_APPROVED_PLAN");
  const dated = input.plan.items.filter((p): p is Dated => p.dueDate !== null);
  const done = new Set(input.items.filter((i) => i.status === "completed").map((i) => i.code));
  const ctx: Context = { input, cfg, dated, done };
  const parts = [behindSchedule(ctx), completionAtRisk(ctx), moduleIncomplete(ctx)];
  const outcomes = parts.map((p) => p.outcome);
  const unknownItems = input.items.filter((i) => i.status === "unknown").map((i) => i.code);
  const metrics = Object.assign({ ...EMPTY_METRICS, unknownItems }, ...parts.map((p) => p.metrics));
  return {
    status: overallStatus(outcomes),
    rules: outcomes.filter((o) => o.outcome === "triggered").map((o) => o.rule),
    outcomes,
    metrics,
  };
}
