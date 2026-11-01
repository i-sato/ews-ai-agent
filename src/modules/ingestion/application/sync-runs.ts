import { type Result, fail, ok } from "./errors";
import type { ImportRepository, SyncRunView } from "./ports";
import type { ImportDeps } from "./preview-import";
import { getSyncRunInput, parseInput } from "./schemas";
import { syncSheet } from "./sync-sheet";

/** Status satu sinkronisasi (§7.1 `GET /sync/runs/:id`). Run tim lain tidak terlihat (RLS). */
export async function getSyncRun(
  deps: { imports: ImportRepository },
  raw: unknown,
): Promise<Result<SyncRunView>> {
  const input = parseInput(getSyncRunInput, raw);
  if (!input.ok) {
    return fail("VALIDATION_ERROR", "Permintaan tidak valid.", { fields: input.fields });
  }
  const run = await deps.imports.findSyncRun(input.value.runId);
  return run ? ok(run) : fail("NOT_FOUND", "Sinkronisasi tidak ditemukan.");
}

export interface ScheduledSyncResult {
  sourceId: string;
  status: "unchanged" | "committed" | "needs_review" | "failed";
  error: string | null;
}

/**
 * Sinkron terjadwal (cron) untuk semua sumber Google Sheets aktif, berurutan (keputusan F2-08).
 * Satu sumber gagal tidak menghentikan sumber lain.
 */
export async function syncAllSources(deps: ImportDeps): Promise<ScheduledSyncResult[]> {
  const results: ScheduledSyncResult[] = [];
  for (const sourceId of await deps.imports.syncableSources()) {
    const result = await syncSheet(deps, { sourceId, trigger: "scheduled" }, null);
    results.push(
      result.ok
        ? { sourceId, status: result.value.status, error: null }
        : { sourceId, status: "failed", error: result.error.code },
    );
  }
  return results;
}
