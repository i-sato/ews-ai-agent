// Bentuk baris untuk repository baca layar Pelatihan; respons database divalidasi.
import { z } from "zod";
import type { TrainingRecord } from "../../application/view-ports";

export const TRAINING_COLUMNS =
  "id, code, name, start_date, end_date, registration_start, registration_end, status, " +
  "portal_url, schedule_source, schedule_verified_at, " +
  "work_team_years!inner(year, work_teams!inner(code))";

const trainingRow = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  registration_start: z.string().nullable(),
  registration_end: z.string().nullable(),
  status: z.string(),
  portal_url: z.string().nullable(),
  schedule_source: z.enum(["manual", "official_api"]).nullable(),
  schedule_verified_at: z.string().nullable(),
  work_team_years: z.object({ year: z.number().int(), work_teams: z.object({ code: z.string() }) }),
});

export function toTrainingRecord(raw: unknown): TrainingRecord {
  const r = trainingRow.parse(raw);
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    teamCode: r.work_team_years.work_teams.code,
    year: r.work_team_years.year,
    startDate: r.start_date,
    endDate: r.end_date,
    registrationStart: r.registration_start,
    registrationEnd: r.registration_end,
    cancelled: r.status === "cancelled",
    portalUrl: r.portal_url,
    scheduleSource: r.schedule_source,
    scheduleVerifiedAt: r.schedule_verified_at,
  };
}

export const batchRow = z.object({
  id: z.string(),
  source_type: z.enum(["google_sheets", "csv", "xlsx"]),
  fetched_at: z.string(),
  content_changed_at: z.string().nullable(),
  source_updated_at: z.string().nullable(),
  label_updated_at: z.string().nullable(),
  row_counts: z.record(z.string(), z.unknown()),
  data_sources: z.object({
    training_id: z.string(),
    last_fetched_at: z.string().nullable(),
    freshness_threshold: z.string(),
  }),
});

export const moduleCatalogRow = z.object({
  catalog_version: z.number().int(),
  sequence: z.number().int(),
  module_code: z.string(),
  name: z.string(),
  module_type: z.enum(["overview", "material", "video", "quiz", "final_assessment"]),
});

export const moduleProgressRow = z.object({
  enrollment_id: z.string(),
  status: z
    .enum(["completed", "not_started", "unknown", "in_progress"])
    .transform((s) => (s === "in_progress" ? ("unknown" as const) : s)),
  training_modules: z.object({ sequence: z.number().int() }),
});

export const snapshotRow = z.object({
  enrollment_id: z.string(),
  completion_percentage: z.coerce.number().nullable(),
  quality_flags: z.array(z.string()),
  training_enrollments: z.object({
    enrollment_status: z.enum([
      "passed",
      "not_passed",
      "cancelled",
      "in_progress",
      "in_selection",
      "unmapped",
    ]),
    onboarding_status: z.boolean().nullable(),
    participants: z.object({ participant_number: z.string(), name: z.string() }).optional(),
  }),
});
