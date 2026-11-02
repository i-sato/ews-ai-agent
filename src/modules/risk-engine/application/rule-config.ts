import { z } from "zod";
import type { RuleConfig } from "../domain/participant-rules";
import type { ScheduleRuleConfig } from "../domain/schedule-rules";

/**
 * Ambang rules engine dari `risk_rule_versions.configuration` (§8.2). Tidak ada nilai bawaan di
 * kode: ambang rule individu wajib ada. Kelompok ambang lain boleh belum ada di versi lama; rule
 * yang memakainya lalu dinilai `not_assessable` (NO_RULE_CONFIG). Kelompok yang hanya sebagian
 * terisi atau di luar rentang ditolak.
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

const freshnessSchema = z.object({ freshness_threshold_hours: z.number().int().min(1).max(8784) });

const indicatorSchema = z.object({ indicator_projection_window_days: days.min(1) });

export interface ParsedRuleConfig {
  participant: RuleConfig;
  /** null bila versi aturan belum memuat ambang rule jadwal (F3-04). */
  schedule: ScheduleRuleConfig | null;
  /** Ambang DATA_STALE (keputusan F3-05: dari versi aturan, bukan per sumber data). */
  freshnessThresholdHours: number | null;
  /** Jendela tren proyeksi indikator (F3-05). */
  projectionWindowDays: number | null;
}

export type RuleConfigResult =
  { ok: true; value: ParsedRuleConfig } | { ok: false; fields: string[] };

type Group<T> = { ok: true; value: T | null } | { ok: false; fields: string[] };

const fieldsOf = (error: z.ZodError) => error.issues.map((i) => i.path.join(".") || "root");

/** Kelompok opsional: semua kuncinya tidak ada → null; sebagian ada → divalidasi lengkap. */
function optionalGroup<S extends z.ZodObject, T>(
  schema: S,
  raw: Record<string, unknown>,
  map: (data: z.infer<S>) => T,
): Group<T> {
  if (Object.keys(schema.shape).every((key) => !(key in raw))) return { ok: true, value: null };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, fields: fieldsOf(parsed.error) };
  return { ok: true, value: map(parsed.data) };
}

function participantConfig(p: z.infer<typeof participantSchema>): RuleConfig {
  return {
    notStartedDays: p.not_started_days,
    notStartedCriticalRemainingDays: p.not_started_critical_remaining_days,
    stagnantDays: p.stagnant_days,
    passPendingDaysBeforeEnd: p.pass_pending_days_before_end,
    lmsConsistencyTolerancePp: p.lms_consistency_tolerance_pp,
  };
}

export function parseRuleConfig(configuration: unknown): RuleConfigResult {
  const participant = participantSchema.safeParse(configuration);
  if (!participant.success) return { ok: false, fields: fieldsOf(participant.error) };
  const raw = configuration as Record<string, unknown>;
  const schedule = optionalGroup(scheduleSchema, raw, (s) => ({
    behindScheduleTolerancePp: s.behind_schedule_tolerance_pp,
    moduleDueWarningDays: s.module_due_warning_days,
  }));
  const freshness = optionalGroup(freshnessSchema, raw, (f) => f.freshness_threshold_hours);
  const indicator = optionalGroup(indicatorSchema, raw, (i) => i.indicator_projection_window_days);
  if (!schedule.ok) return schedule;
  if (!freshness.ok) return freshness;
  if (!indicator.ok) return indicator;
  return {
    ok: true,
    value: {
      participant: participantConfig(participant.data),
      schedule: schedule.value,
      freshnessThresholdHours: freshness.value,
      projectionWindowDays: indicator.value,
    },
  };
}
