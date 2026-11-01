import type { TotalCheck } from "../domain/row1-reconciliation";
import { type Result, fail, ok } from "./errors";
import { BLOCKER_MESSAGES, compareCatalog, summarize } from "./import-plan";
import type { Actor, AuditLog, CommittedState, IdGenerator, ImportBatch } from "./ports";
import {
  type ImportSummary,
  type PreviewImportOutput,
  parseInput,
  previewImportInput,
} from "./schemas";
import { type SnapshotDeps, type SourceSnapshot, loadSnapshot } from "./source-snapshot";

export interface ImportDeps extends SnapshotDeps {
  audit: AuditLog;
  ids: IdGenerator;
}

export const IMPORT_ROLES: readonly Actor["role"][] = ["admin", "training_manager"];

/** `not_reconciled` (TOTAL DITERIMA) sengaja tidak menjadi peringatan (docs/decisions.md). */
function totalWarning(t: TotalCheck): string | null {
  if (t.status === "explained" || t.status === "missing") return t.note ?? null;
  if (t.status === "mismatch") {
    return `${t.label} di baris 1 (${t.reported}) berbeda dengan hitung ulang (${t.recounted}).`;
  }
  return null;
}

export function warningsFor(snapshot: SourceSnapshot, blockers: string[]): string[] {
  const warnings = snapshot.reconciliation.totals
    .map(totalWarning)
    .filter((w): w is string => w !== null);
  if (snapshot.reconciliation.items.some((i) => i.status !== "match")) {
    warnings.push("Jumlah selesai per item di baris 1 berbeda dengan hitung ulang.");
  }
  if (snapshot.layout.trailingColumns > 0) {
    warnings.push("Ada kolom setelah Cek Sync; kolom tersebut diabaikan.");
  }
  if (snapshot.freshness.sourceUpdatedAtUncertain) {
    warnings.push("Waktu pembaruan sumber tidak pasti (tahun UPDATE TERAKHIR diturunkan).");
  }
  return [...warnings, ...blockers];
}

export function contentChangedAt(snapshot: SourceSnapshot, previous: CommittedState | null) {
  return previous?.contentHash === snapshot.contentHash ? previous.contentChangedAt : null;
}

/** Status commit terakhir dan ringkasan pratinjau untuk snapshot ini. */
export async function planImport(deps: ImportDeps, snapshot: SourceSnapshot) {
  const previous = await deps.imports.committedState(snapshot.source.id);
  const current = await deps.imports.currentCatalog(snapshot.source.trainingId);
  const summary = summarize(snapshot, previous, compareCatalog(current, snapshot.catalog));
  return { previous, summary };
}

type BatchFields = Pick<
  ImportBatch,
  "id" | "status" | "expiresAt" | "createdBy" | "summary" | "uploadId"
> & {
  contentChangedAt: string | null;
};

export function newBatch(snapshot: SourceSnapshot, fields: BatchFields): ImportBatch {
  const { contentChangedAt: changedAt, ...rest } = fields;
  return {
    ...rest,
    sourceId: snapshot.source.id,
    sourceType: snapshot.source.sourceType,
    trainingId: snapshot.source.trainingId,
    contentHash: snapshot.contentHash,
    idempotencyKey: null,
    freshness: { ...snapshot.freshness, contentChangedAt: changedAt },
  };
}

/** Pratinjau impor: staging batch berkedaluwarsa; tidak menulis tabel operasional (§3.4). */
export async function previewImport(
  deps: ImportDeps,
  raw: unknown,
  actor: Actor,
): Promise<Result<PreviewImportOutput>> {
  const input = parseInput(previewImportInput, raw);
  if (!input.ok)
    return fail("VALIDATION_ERROR", "Permintaan tidak valid.", { fields: input.fields });
  if (!IMPORT_ROLES.includes(actor.role)) return fail("FORBIDDEN", "Anda tidak memiliki akses.");
  const { sourceId, uploadId = null } = input.value;
  const loaded = await loadSnapshot(deps, { sourceId, uploadId });
  if (!loaded.ok) return loaded;
  const snapshot = loaded.value;
  const { previous, summary } = await planImport(deps, snapshot);
  const unchanged = previous?.contentHash === snapshot.contentHash;
  const ttlMs = deps.settings.stagingTtlMinutes * 60_000;
  const batch = newBatch(snapshot, {
    id: deps.ids.uuid(),
    status: unchanged ? "unchanged" : "staged",
    expiresAt: new Date(deps.clock.now().getTime() + ttlMs).toISOString(),
    createdBy: actor.id,
    summary,
    uploadId,
    contentChangedAt: contentChangedAt(snapshot, previous),
  });
  await deps.imports.saveBatch(batch);
  await deps.audit.record({
    actorId: actor.id,
    action: "import.preview",
    resourceType: "import_batch",
    resourceId: batch.id,
    details: { sourceId: batch.sourceId, status: batch.status, blockers: summary.blockers },
  });
  return ok(previewOutput(snapshot, batch, summary));
}

function previewOutput(
  snapshot: SourceSnapshot,
  batch: ImportBatch,
  summary: ImportSummary,
): PreviewImportOutput {
  const messages = summary.blockers.map((b) => BLOCKER_MESSAGES[b]);
  if (batch.status === "unchanged") messages.push("Isi sumber tidak berubah sejak impor terakhir.");
  return {
    batchId: batch.id,
    expiresAt: batch.expiresAt as string,
    summary,
    freshness: batch.freshness,
    warnings: warningsFor(snapshot, messages),
  };
}
