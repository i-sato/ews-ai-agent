import { commitSnapshot } from "./commit-import";
import { type Result, fail, ok } from "./errors";
import { IMPORT_ROLES, type ImportDeps, newBatch, planImport, warningsFor } from "./preview-import";
import type { Actor, CommittedState, SyncRun, SyncRunStatus } from "./ports";
import { type SyncSheetInput, type SyncSheetOutput, parseInput, syncSheetInput } from "./schemas";
import { type SourceSnapshot, loadSnapshot } from "./source-snapshot";

type RunResult = { status: SyncRunStatus; batchId: string | null; error: string | null };
type ChangeContext = { snapshot: SourceSnapshot; previous: CommittedState | null };

const LABEL_NOT_UPDATED = "Label pembaruan di sheet tidak diperbarui walaupun isinya berubah.";

async function checkManualLimit(deps: ImportDeps, run: SyncRun): Promise<Result<true>> {
  const last = await deps.imports.lastManualSyncAt(run.sourceId);
  if (!last) return ok(true);
  const minMs = deps.settings.manualSyncMinIntervalMinutes * 60_000;
  const waitMs = new Date(last).getTime() + minMs - new Date(run.startedAt).getTime();
  if (waitMs <= 0) return ok(true);
  return fail("RATE_LIMITED", "Sinkronisasi manual terlalu sering; coba lagi nanti.", {
    retryAfterSeconds: Math.ceil(waitMs / 1000),
  });
}

/** Sinkron manual hanya Pengelola Pelatihan/Admin dengan batas frekuensi (§3.5). */
async function openRun(
  deps: ImportDeps,
  input: SyncSheetInput,
  actor: Actor | null,
): Promise<Result<SyncRun>> {
  const manual = input.trigger === "manual";
  if (manual && (!actor || !IMPORT_ROLES.includes(actor.role))) {
    return fail("FORBIDDEN", "Anda tidak memiliki akses.");
  }
  const source = await deps.imports.findSource(input.sourceId);
  if (!source) return fail("NOT_FOUND", "Sumber data tidak ditemukan.");
  if (source.sourceType !== "google_sheets") {
    return fail("VALIDATION_ERROR", "Sinkronisasi hanya untuk sumber Google Sheets.");
  }
  const run: SyncRun = {
    id: deps.ids.uuid(),
    sourceId: input.sourceId,
    trigger: input.trigger,
    requestedBy: actor?.id ?? null,
    startedAt: deps.clock.now().toISOString(),
  };
  const limit = manual ? await checkManualLimit(deps, run) : ok(true);
  if (!limit.ok) return limit;
  await deps.imports.startSyncRun(run);
  return ok(run);
}

async function finish(deps: ImportDeps, run: SyncRun, result: RunResult) {
  await deps.imports.finishSyncRun(run.id, {
    status: result.status,
    importBatchId: result.batchId,
    errorSummary: result.error,
  });
  await deps.audit.record({
    actorId: run.requestedBy,
    action: `sync.${result.status}`,
    resourceType: "data_source",
    resourceId: run.sourceId,
    details: { runId: run.id, trigger: run.trigger, batchId: result.batchId },
  });
}

function labelWarning({ snapshot, previous }: ChangeContext): string[] {
  const label = snapshot.freshness.labelUpdatedAt;
  return previous && label !== null && label === previous.labelUpdatedAt ? [LABEL_NOT_UPDATED] : [];
}

/** Isi berubah: commit otomatis bila bersih; bila ada penahan, batch tetap staged. */
async function syncChanged(
  deps: ImportDeps,
  run: SyncRun,
  ctx: ChangeContext,
): Promise<SyncSheetOutput> {
  const { snapshot } = ctx;
  const { summary } = await planImport(deps, snapshot);
  const batch = newBatch(snapshot, {
    id: deps.ids.uuid(),
    status: "staged",
    expiresAt: null,
    createdBy: run.requestedBy,
    summary,
    uploadId: null,
    contentChangedAt: null,
  });
  await deps.imports.saveBatch(batch);
  const idempotencyKey = `sync:${run.sourceId}:${snapshot.contentHash}`;
  const actorId = run.requestedBy;
  const saved = await commitSnapshot(deps, { batch, snapshot, idempotencyKey, actorId });
  const warnings = [...warningsFor(snapshot, []), ...labelWarning(ctx)];
  const changedAt = saved.ok ? snapshot.freshness.fetchedAt : null;
  const freshness = { ...snapshot.freshness, contentChangedAt: changedAt };
  const base = { runId: run.id, batchId: batch.id, freshness };
  if (saved.ok) {
    await finish(deps, run, { status: "succeeded", batchId: batch.id, error: null });
    return { ...base, status: "committed", warnings };
  }
  const error = `Perlu tinjauan: ${saved.error.message}`;
  await finish(deps, run, { status: "failed", batchId: batch.id, error });
  return { ...base, status: "needs_review", warnings: [...warnings, saved.error.message] };
}

/**
 * Sinkronisasi sheet (spesifikasi §3.5). `fetched_at` selalu diperbarui; isi sama = tanpa snapshot
 * baru. Isi berubah dan bersih = commit otomatis; ada penahan = tetap staged, run "perlu tinjauan".
 * Galat baca mempertahankan snapshot valid terakhir.
 */
export async function syncSheet(
  deps: ImportDeps,
  raw: unknown,
  actor: Actor | null,
): Promise<Result<SyncSheetOutput>> {
  const input = parseInput(syncSheetInput, raw);
  if (!input.ok) {
    return fail("VALIDATION_ERROR", "Permintaan tidak valid.", { fields: input.fields });
  }
  const opened = await openRun(deps, input.value, actor);
  if (!opened.ok) return opened;
  const run = opened.value;
  const loaded = await loadSnapshot(deps, { sourceId: run.sourceId, uploadId: null });
  if (!loaded.ok) {
    await finish(deps, run, { status: "failed", batchId: null, error: loaded.error.message });
    return loaded;
  }
  const snapshot = loaded.value;
  const fetchedAt = snapshot.freshness.fetchedAt;
  await deps.imports.recordFetch(run.sourceId, {
    fetchedAt,
    sourceModifiedAt: snapshot.driveModifiedAt,
  });
  const previous = await deps.imports.committedState(run.sourceId);
  if (previous?.contentHash !== snapshot.contentHash) {
    return ok(await syncChanged(deps, run, { snapshot, previous }));
  }
  await finish(deps, run, { status: "unchanged", batchId: null, error: null });
  const freshness = { ...snapshot.freshness, contentChangedAt: previous.contentChangedAt };
  const warnings = warningsFor(snapshot, []);
  return ok({ runId: run.id, status: "unchanged", batchId: null, freshness, warnings });
}
