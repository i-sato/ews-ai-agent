import { type Result, fail, ok } from "./errors";
import { BLOCKER_MESSAGES, blockersFor, compareCatalog } from "./import-plan";
import { IMPORT_ROLES, type ImportDeps } from "./preview-import";
import type { Actor, ImportBatch } from "./ports";
import { type CommitImportOutput, commitImportInput, parseInput } from "./schemas";
import { type SourceSnapshot, loadSnapshot } from "./source-snapshot";

type CommitRequest = {
  batch: ImportBatch;
  snapshot: SourceSnapshot;
  idempotencyKey: string;
  actorId: string | null;
};

/**
 * Validasi ulang penahan lalu simpan dalam satu transaksi (port `commit`). Dipakai CommitImport
 * dan SyncSheet. Katalog v1 dibuat sebagai draf pada impor pertama (keputusan F2-06).
 */
export async function commitSnapshot(
  deps: ImportDeps,
  request: CommitRequest,
): Promise<Result<{ participants: number }>> {
  const { batch, snapshot } = request;
  const current = await deps.imports.currentCatalog(snapshot.source.trainingId);
  const catalogState = compareCatalog(current, snapshot.catalog);
  const blockers = blockersFor(snapshot, catalogState);
  if (blockers.length > 0) {
    const message = blockers.map((b) => BLOCKER_MESSAGES[b]).join(" ");
    return fail("BLOCKED", message, { blockers });
  }
  const committed: ImportBatch = {
    ...batch,
    status: "committed",
    idempotencyKey: request.idempotencyKey,
    freshness: { ...snapshot.freshness, contentChangedAt: snapshot.freshness.fetchedAt },
  };
  await deps.imports.commit({
    batch: committed,
    idempotencyKey: request.idempotencyKey,
    participants: snapshot.participants,
    rowHashes: snapshot.rowHashes,
    catalog: current
      ? { action: "reuse", version: current.version, items: current.items }
      : { action: "create", version: 1, items: snapshot.catalog },
    actorId: request.actorId,
  });
  await deps.audit.record({
    actorId: request.actorId,
    action: "import.commit",
    resourceType: "import_batch",
    resourceId: batch.id,
    details: { sourceId: batch.sourceId, participants: snapshot.participants.length },
  });
  return ok({ participants: snapshot.participants.length });
}

const CLOSED: Partial<Record<ImportBatch["status"], string>> = {
  committed: "Batch ini sudah disimpan dengan permintaan lain.",
  unchanged: "Isi sumber tidak berubah sejak impor terakhir; tidak ada yang perlu disimpan.",
  rejected: "Batch ini ditolak; buat pratinjau ulang.",
  expired: "Pratinjau sudah kedaluwarsa; buat pratinjau ulang.",
};

async function openBatch(deps: ImportDeps, batchId: string): Promise<Result<ImportBatch>> {
  const batch = await deps.imports.findBatch(batchId);
  if (!batch) return fail("NOT_FOUND", "Batch impor tidak ditemukan.");
  const closed = CLOSED[batch.status];
  if (closed) return fail("CONFLICT", closed, { status: batch.status });
  if (batch.expiresAt && new Date(batch.expiresAt) <= deps.clock.now()) {
    await deps.imports.setBatchStatus(batch.id, "expired");
    return fail("CONFLICT", CLOSED.expired as string, { status: "expired" });
  }
  return ok(batch);
}

/** Key yang sudah dipakai: hasil sebelumnya untuk batch yang sama, konflik untuk batch lain. */
async function replayed(
  deps: ImportDeps,
  key: string,
  batchId: string,
): Promise<Result<CommitImportOutput> | null> {
  const replay = await deps.imports.findBatchByIdempotencyKey(key);
  if (!replay) return null;
  if (replay.id !== batchId) {
    return fail("CONFLICT", "idempotency_key sudah dipakai permintaan lain.");
  }
  const participants = Number(replay.summary.participants ?? 0);
  return ok({ batchId, status: "committed", replayed: true, participants });
}

/** Simpan impor yang sudah dipratinjau: idempoten, validasi ulang, transaksional (§3.4, §7.4). */
export async function commitImport(
  deps: ImportDeps,
  raw: unknown,
  actor: Actor,
): Promise<Result<CommitImportOutput>> {
  const input = parseInput(commitImportInput, raw);
  if (!input.ok)
    return fail("VALIDATION_ERROR", "Permintaan tidak valid.", { fields: input.fields });
  if (!IMPORT_ROLES.includes(actor.role)) return fail("FORBIDDEN", "Anda tidak memiliki akses.");
  const { batchId, idempotencyKey } = input.value;
  const replay = await replayed(deps, idempotencyKey, batchId);
  if (replay) return replay;
  const opened = await openBatch(deps, batchId);
  if (!opened.ok) return opened;
  const { sourceId, uploadId } = opened.value;
  const loaded = await loadSnapshot(deps, { sourceId, uploadId });
  if (!loaded.ok) return loaded;
  if (loaded.value.contentHash !== opened.value.contentHash) {
    await deps.imports.setBatchStatus(batchId, "rejected");
    return fail("CONFLICT", "Data sumber berubah sejak pratinjau; buat pratinjau ulang.");
  }
  const request = {
    batch: opened.value,
    snapshot: loaded.value,
    idempotencyKey,
    actorId: actor.id,
  };
  const saved = await commitSnapshot(deps, request);
  if (!saved.ok) return saved;
  return ok({
    batchId,
    status: "committed",
    replayed: false,
    participants: saved.value.participants,
  });
}
