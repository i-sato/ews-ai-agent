// Skema input/output use case ingestion (SH-INPUT-01). Semua objek `.strict()`.
import { z } from "zod";

const url = z.string().trim().max(2048);
const code = z.string().regex(/^[A-Z]{2,10}$/);
const isoDateTime = z.iso.datetime({ offset: true });

export const parseTrainingSourceInput = z
  .object({ spreadsheetUrl: url, portalUrl: url.optional() })
  .strict();

export const registerTrainingInput = z
  .object({
    spreadsheetUrl: url,
    portalUrl: url.optional(),
    year: z.number().int().min(2020).max(2100),
    teamCode: code,
    name: z.string().trim().min(3).max(200),
    portalTrainingId: z.string().regex(/^\d{4,6}$/),
    schemeCode: code.optional(),
    period: z
      .object({ start: z.iso.date(), end: z.iso.date() })
      .strict()
      .refine((p) => p.end >= p.start, { message: "Tanggal selesai sebelum tanggal mulai." }),
    /** Admin wajib mengonfirmasi tahun, tim, ID, nama, dan periode (§3.7). */
    confirmed: z.literal(true),
  })
  .strict();

/** `uploadId` wajib untuk sumber CSV/XLSX: file yang sudah diunggah ke bucket privat. */
export const previewImportInput = z
  .object({ sourceId: z.uuid(), uploadId: z.uuid().optional() })
  .strict();

export const commitImportInput = z
  .object({
    batchId: z.uuid(),
    idempotencyKey: z
      .string()
      .min(8)
      .max(128)
      .regex(/^[A-Za-z0-9:_-]+$/),
  })
  .strict();

export const syncSheetInput = z
  .object({ sourceId: z.uuid(), trigger: z.enum(["scheduled", "manual"]) })
  .strict();

const dayMonth = z.object({ day: z.number(), month: z.number() }).strict();

export const parseTrainingSourceOutput = z
  .object({
    title: z.string(),
    spreadsheetId: z.string(),
    gid: z.string().nullable(),
    teamCode: z.string().nullable(),
    portalTrainingId: z.string().nullable(),
    schemeCode: z.string().nullable(),
    period: z.object({ start: dayMonth, end: dayMonth }).strict().nullable(),
    portalTrainingIdFromUrl: z.string().nullable(),
    warnings: z.array(z.string()),
  })
  .strict();

export const registerTrainingOutput = z
  .object({
    trainingId: z.uuid(),
    sourceId: z.uuid(),
    code: z.string(),
    warnings: z.array(z.string()),
  })
  .strict();

const freshness = z
  .object({
    fetchedAt: isoDateTime,
    contentChangedAt: isoDateTime.nullable(),
    sourceUpdatedAt: isoDateTime.nullable(),
    sourceUpdatedAtUncertain: z.boolean(),
    labelUpdatedAt: isoDateTime.nullable(),
  })
  .strict();

const count = z.number().int().min(0);

export const importSummary = z
  .object({
    participants: count,
    newRows: count,
    changedRows: count,
    unchangedRows: count,
    duplicateRows: count,
    flaggedRows: count,
    ignoredRows: count,
    items: count,
    emptySlots: count,
    itemRange: z.object({ from: z.string(), to: z.string() }).strict(),
    qualityFlags: z.record(z.string(), count),
    reconciliationMismatches: count,
    catalog: z.enum(["new", "unchanged", "changed"]),
    blockers: z.array(z.enum(["DUPLICATE_PARTICIPANTS", "CATALOG_CHANGED"])),
  })
  .strict();

export const previewImportOutput = z
  .object({
    batchId: z.uuid(),
    expiresAt: isoDateTime,
    summary: importSummary,
    freshness,
    warnings: z.array(z.string()),
  })
  .strict();

export const commitImportOutput = z
  .object({
    batchId: z.uuid(),
    status: z.literal("committed"),
    replayed: z.boolean(),
    participants: count,
  })
  .strict();

export const syncSheetOutput = z
  .object({
    runId: z.uuid(),
    status: z.enum(["unchanged", "committed", "needs_review"]),
    batchId: z.uuid().nullable(),
    freshness,
    warnings: z.array(z.string()),
  })
  .strict();

export type ParseTrainingSourceInput = z.infer<typeof parseTrainingSourceInput>;
export type ParseTrainingSourceOutput = z.infer<typeof parseTrainingSourceOutput>;
export type RegisterTrainingInput = z.infer<typeof registerTrainingInput>;
export type RegisterTrainingOutput = z.infer<typeof registerTrainingOutput>;
export type PreviewImportInput = z.infer<typeof previewImportInput>;
export type PreviewImportOutput = z.infer<typeof previewImportOutput>;
export type ImportSummary = z.infer<typeof importSummary>;
export type CommitImportInput = z.infer<typeof commitImportInput>;
export type CommitImportOutput = z.infer<typeof commitImportOutput>;
export type SyncSheetInput = z.infer<typeof syncSheetInput>;
export type SyncSheetOutput = z.infer<typeof syncSheetOutput>;

/** Validasi input yang belum tepercaya; galat dikembalikan tanpa detail internal. */
export function parseInput<T>(schema: z.ZodType<T>, raw: unknown) {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true as const, value: parsed.data };
  const fields = parsed.error.issues.map((i) => ({ field: i.path.join("."), reason: i.code }));
  return { ok: false as const, fields };
}
