// Pemetaan baris tabel ↔ tipe port. Bentuk respons database divalidasi, tidak langsung dipercaya.
import { z } from "zod";
import type {
  BatchStatus,
  DataSourceConfig,
  ImportBatch,
  SourceType,
} from "../../application/ports";

const sourceType = z.enum(["google_sheets", "csv", "xlsx"]);
const enrollmentStatus = z.enum(["passed", "not_passed", "cancelled", "unmapped"]);
const nullableTime = z.string().nullable();

export const dataSourceRow = z.object({
  id: z.string(),
  training_id: z.string(),
  source_type: sourceType,
  spreadsheet_id: z.string().nullable(),
  gid: z.string().nullable(),
  header_aliases: z.record(z.string(), z.array(z.string())).catch({}),
  status_mapping: z.record(z.string(), enrollmentStatus).catch({}),
  freshness_threshold: z.string(),
  enabled: z.boolean(),
  trainings: z
    .object({ start_date: z.string().nullable(), end_date: z.string().nullable() })
    .nullable(),
});

export const DATA_SOURCE_COLUMNS =
  "id, training_id, source_type, spreadsheet_id, gid, header_aliases, status_mapping, " +
  "freshness_threshold, enabled, trainings(start_date, end_date)";

/** Interval Postgres (`3 days`, `72:00:00`, `1 day 02:00:00`) dalam jam. */
export function intervalHours(text: string): number {
  const days = Number(/(-?\d+) days?/.exec(text)?.[1] ?? 0);
  const time = /(\d+):(\d+):(\d+)/.exec(text);
  const hours = time ? Number(time[1]) + Number(time[2]) / 60 + Number(time[3]) / 3600 : 0;
  return days * 24 + hours;
}

export function toDataSource(raw: unknown): DataSourceConfig {
  const row = dataSourceRow.parse(raw);
  const sheet = row.source_type === "google_sheets" && row.spreadsheet_id;
  const period = row.trainings;
  return {
    id: row.id,
    trainingId: row.training_id,
    sourceType: row.source_type,
    reference: sheet ? { spreadsheetId: row.spreadsheet_id as string, gid: row.gid } : null,
    // Untuk Google Sheets, ID file Drive sama dengan ID spreadsheet.
    driveFileId: sheet ? (row.spreadsheet_id as string) : null,
    headerAliases: row.header_aliases,
    statusMapping: row.status_mapping,
    trainingPeriod:
      period?.start_date && period.end_date
        ? { start: period.start_date, end: period.end_date }
        : null,
    freshnessThresholdHours: intervalHours(row.freshness_threshold),
  };
}

export const BATCH_COLUMNS =
  "id, source_id, source_type, source_reference, status, idempotency_key, row_counts, " +
  "content_hash, fetched_at, content_changed_at, source_updated_at, source_updated_at_uncertain, " +
  "label_updated_at, expires_at, created_by, data_sources(training_id)";

const batchRow = z.object({
  id: z.string(),
  source_id: z.string(),
  source_type: sourceType,
  source_reference: z.string().nullable(),
  status: z.enum(["staged", "committed", "rejected", "expired", "unchanged"]),
  idempotency_key: z.string().nullable(),
  row_counts: z.record(z.string(), z.unknown()),
  content_hash: z.string().nullable(),
  fetched_at: z.string(),
  content_changed_at: nullableTime,
  source_updated_at: nullableTime,
  source_updated_at_uncertain: z.boolean(),
  label_updated_at: nullableTime,
  expires_at: nullableTime,
  created_by: z.string().nullable(),
  data_sources: z.object({ training_id: z.string() }),
});

export function toBatch(raw: unknown): ImportBatch {
  const row = batchRow.parse(raw);
  return {
    id: row.id,
    sourceId: row.source_id,
    sourceType: row.source_type as SourceType,
    uploadId: row.source_reference,
    trainingId: row.data_sources.training_id,
    status: row.status as BatchStatus,
    contentHash: row.content_hash ?? "",
    idempotencyKey: row.idempotency_key,
    expiresAt: row.expires_at,
    freshness: {
      fetchedAt: row.fetched_at,
      contentChangedAt: row.content_changed_at,
      sourceUpdatedAt: row.source_updated_at,
      sourceUpdatedAtUncertain: row.source_updated_at_uncertain,
      labelUpdatedAt: row.label_updated_at,
    },
    summary: row.row_counts,
    createdBy: row.created_by,
  };
}

export function fromBatch(batch: ImportBatch) {
  return {
    id: batch.id,
    source_id: batch.sourceId,
    source_type: batch.sourceType,
    source_reference: batch.uploadId,
    status: batch.status,
    idempotency_key: batch.idempotencyKey,
    row_counts: batch.summary,
    content_hash: batch.contentHash,
    fetched_at: batch.freshness.fetchedAt,
    content_changed_at: batch.freshness.contentChangedAt,
    source_updated_at: batch.freshness.sourceUpdatedAt,
    source_updated_at_uncertain: batch.freshness.sourceUpdatedAtUncertain,
    label_updated_at: batch.freshness.labelUpdatedAt,
    expires_at: batch.expiresAt,
    created_by: batch.createdBy,
  };
}

export const moduleRow = z.object({
  catalog_version: z.number().int(),
  catalog_status: z.enum(["draft", "approved", "superseded"]),
  module_code: z.string(),
  name: z.string(),
  source_name: z.string(),
  module_type: z.enum(["overview", "material", "video", "quiz", "final_assessment"]),
  sequence: z.number().int(),
  source_column: z.string().nullable(),
});

export const snapshotHashRow = z.object({
  row_hash: z.string().nullable(),
  training_enrollments: z.object({
    participants: z.object({ participant_number: z.string() }),
  }),
});
