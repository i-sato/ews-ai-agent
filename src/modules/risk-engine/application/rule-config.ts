import { z } from "zod";
import type { RuleConfig } from "../domain/participant-rules";
import type { ScheduleRuleConfig } from "../domain/schedule-rules";

/**
 * Ambang rules engine dari `risk_rule_versions.configuration` (§8.2). Tidak ada nilai bawaan di
 * kode: ambang rule individu wajib ada; ambang rule jadwal boleh belum ada, dan rule jadwal lalu
 * dinilai `not_assessable` (NO_RULE_CONFIG). Kunci lain (mis. `freshness_threshold_hours`)
 * dibiarkan.
 */
const days = z.number().int().min(0).max(366);
const pp = z.number().min(0).max(100);

const participantSchema = z.object({
  not_started_days: days,
  not_started_critical_remaining_days: days,
  stagnant_days: days,
  pass_pending_days_before_end: days,
  lms_consistency_tolerance_pp: pp,
});

const scheduleSchema = z.object({
  behind_schedule_tolerance_pp: pp,
  module_due_warning_days: days,
});

export interface ParsedRuleConfig {
  participant: RuleConfig;
  /** null bila versi aturan belum memuat ambang rule jadwal. */
  schedule: ScheduleRuleConfig | null;
}

export type RuleConfigResult =
  { ok: true; value: ParsedRuleConfig } | { ok: false; fields: string[] };

const SCHEDULE_KEYS = Object.keys(scheduleSchema.shape);

function scheduleConfig(raw: Record<string, unknown>) {
  if (SCHEDULE_KEYS.every((key) => !(key in raw))) return { ok: true as const, value: null };
  const parsed = scheduleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, issues: parsed.error.issues };
  const value: ScheduleRuleConfig = {
    behindScheduleTolerancePp: parsed.data.behind_schedule_tolerance_pp,
    moduleDueWarningDays: parsed.data.module_due_warning_days,
  };
  return { ok: true as const, value };
}

export function parseRuleConfig(configuration: unknown): RuleConfigResult {
  const participant = participantSchema.safeParse(configuration);
  if (!participant.success) {
    return { ok: false, fields: participant.error.issues.map((i) => i.path.join(".") || "root") };
  }
  const schedule = scheduleConfig(configuration as Record<string, unknown>);
  if (!schedule.ok) return { ok: false, fields: schedule.issues.map((i) => i.path.join(".")) };
  const p = participant.data;
  return {
    ok: true,
    value: {
      participant: {
        notStartedDays: p.not_started_days,
        notStartedCriticalRemainingDays: p.not_started_critical_remaining_days,
        stagnantDays: p.stagnant_days,
        passPendingDaysBeforeEnd: p.pass_pending_days_before_end,
        lmsConsistencyTolerancePp: p.lms_consistency_tolerance_pp,
      },
      schedule: schedule.value,
    },
  };
}
