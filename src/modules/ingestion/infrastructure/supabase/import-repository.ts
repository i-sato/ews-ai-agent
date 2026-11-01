import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BatchStatus,
  Catalog,
  CommitPayload,
  CommittedState,
  DataSourceConfig,
  ImportBatch,
  ImportRepository,
  SyncRun,
  SyncRunStatus,
  SyncRunView,
} from "../../application/ports";
import {
  BATCH_COLUMNS,
  DATA_SOURCE_COLUMNS,
  fromBatch,
  SYNC_RUN_COLUMNS,
  moduleRow,
  snapshotHashRow,
  toSyncRun,
  toBatch,
  toDataSource,
} from "./rows";

/**
 * `reader`: klien sesi pengguna untuk pembacaan yang menentukan akses (sumber, batch), sehingga RLS
 * `read_team` membatasi per tim kerja (SH-AUTHZ-02/03). Sinkron terjadwal memakai service role.
 * `writer`: service role untuk penulisan setelah use case memeriksa otorisasi.
 */
export interface RepositoryClients {
  reader: SupabaseClient;
  writer: SupabaseClient;
}

const PAGE = 1000;

/** Galat tanpa isi data (tanpa PII); detail teknis hanya kode Postgres/PostgREST. */
function failed(operation: string, error: { code?: string } | null): never {
  throw new Error(`ImportRepository.${operation} gagal (${error?.code ?? "unknown"})`);
}

export class SupabaseImportRepository implements ImportRepository {
  constructor(private readonly db: RepositoryClients) {}

  async findSource(sourceId: string): Promise<DataSourceConfig | null> {
    const { data, error } = await this.db.reader
      .from("data_sources")
      .select(DATA_SOURCE_COLUMNS)
      .eq("id", sourceId)
      .eq("enabled", true)
      .maybeSingle();
    if (error) failed("findSource", error);
    return data ? toDataSource(data) : null;
  }

  async committedState(sourceId: string): Promise<CommittedState | null> {
    const { data, error } = await this.db.writer
      .from("import_batches")
      .select("id, content_hash, content_changed_at, label_updated_at")
      .eq("source_id", sourceId)
      .eq("status", "committed")
      .order("content_changed_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (error) failed("committedState", error);
    if (!data) return null;
    return {
      contentHash: data.content_hash ?? "",
      contentChangedAt: data.content_changed_at ?? "",
      labelUpdatedAt: data.label_updated_at,
      rowHashes: await this.rowHashes(data.id),
    };
  }

  private async rowHashes(batchId: string): Promise<Map<string, string>> {
    const hashes = new Map<string, string>();
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.db.writer
        .from("participant_progress_snapshots")
        .select("row_hash, training_enrollments!inner(participants!inner(participant_number))")
        .eq("import_batch_id", batchId)
        .order("id")
        .range(from, from + PAGE - 1);
      if (error) failed("rowHashes", error);
      for (const raw of data ?? []) {
        const row = snapshotHashRow.parse(raw);
        const number = row.training_enrollments.participants.participant_number;
        if (row.row_hash) hashes.set(number, row.row_hash);
      }
      if ((data?.length ?? 0) < PAGE) return hashes;
    }
  }

  async currentCatalog(trainingId: string): Promise<Catalog | null> {
    const { data, error } = await this.db.writer
      .from("training_modules")
      .select(
        "catalog_version, catalog_status, module_code, name, source_name, module_type, " +
          "sequence, source_column",
      )
      .eq("training_id", trainingId)
      .order("catalog_version", { ascending: false })
      .order("sequence");
    if (error) failed("currentCatalog", error);
    const rows = (data ?? []).map((r) => moduleRow.parse(r));
    const latest = rows[0];
    if (!latest) return null;
    const items = rows
      .filter((r) => r.catalog_version === latest.catalog_version)
      .map((r) => ({
        sequence: r.sequence,
        moduleCode: r.module_code,
        name: r.name,
        sourceName: r.source_name,
        moduleType: r.module_type,
        sourceColumn: r.source_column ?? "",
      }));
    return { version: latest.catalog_version, status: latest.catalog_status, items };
  }

  async saveBatch(batch: ImportBatch): Promise<void> {
    const { error } = await this.db.writer.from("import_batches").upsert(fromBatch(batch));
    if (error) failed("saveBatch", error);
  }

  async findBatch(batchId: string): Promise<ImportBatch | null> {
    return this.oneBatch("id", batchId);
  }

  async findBatchByIdempotencyKey(key: string): Promise<ImportBatch | null> {
    return this.oneBatch("idempotency_key", key);
  }

  private async oneBatch(column: "id" | "idempotency_key", value: string) {
    const { data, error } = await this.db.reader
      .from("import_batches")
      .select(BATCH_COLUMNS)
      .eq(column, value)
      .maybeSingle();
    if (error) failed("findBatch", error);
    return data ? toBatch(data) : null;
  }

  async setBatchStatus(batchId: string, status: BatchStatus): Promise<void> {
    const { error } = await this.db.writer
      .from("import_batches")
      .update({ status })
      .eq("id", batchId);
    if (error) failed("setBatchStatus", error);
  }

  async findSyncRun(runId: string): Promise<SyncRunView | null> {
    const { data, error } = await this.db.reader
      .from("sync_runs")
      .select(SYNC_RUN_COLUMNS)
      .eq("id", runId)
      .maybeSingle();
    if (error) failed("findSyncRun", error);
    return data ? toSyncRun(data) : null;
  }

  async syncableSources(): Promise<string[]> {
    const { data, error } = await this.db.writer
      .from("data_sources")
      .select("id")
      .eq("source_type", "google_sheets")
      .eq("enabled", true)
      .order("id");
    if (error) failed("syncableSources", error);
    return (data ?? []).map((r) => String(r.id));
  }

  async commit(payload: CommitPayload): Promise<void> {
    const participants = payload.participants.map((p) => ({
      participantNumber: p.participantNumber,
      participantName: p.participantName,
      organization: p.organization,
      sourceStatus: p.sourceStatus,
      enrollmentStatus: p.enrollmentStatus,
      onboardingStatus: p.onboardingStatus,
      completionPercentage: p.completionPercentage,
      completedItems: p.completedItems,
      totalItems: p.totalItems,
      qualityFlags: p.qualityFlags,
      rowHash: payload.rowHashes.get(p.participantNumber) ?? null,
      modules: p.modules.map((m) => ({ sequence: m.sequence, status: m.status })),
    }));
    const { error } = await this.db.writer.rpc("ingestion_commit_import", {
      p: { ...payload, rowHashes: undefined, participants },
    });
    if (error) failed("commit", error);
  }

  async recordFetch(
    sourceId: string,
    at: { fetchedAt: string; sourceModifiedAt: string | null },
  ): Promise<void> {
    const { error } = await this.db.writer
      .from("data_sources")
      .update({ last_fetched_at: at.fetchedAt, source_modified_at: at.sourceModifiedAt })
      .eq("id", sourceId);
    if (error) failed("recordFetch", error);
  }

  async lastManualSyncAt(sourceId: string): Promise<string | null> {
    const { data, error } = await this.db.writer
      .from("sync_runs")
      .select("started_at")
      .eq("source_id", sourceId)
      .eq("trigger", "manual")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) failed("lastManualSyncAt", error);
    return data?.started_at ?? null;
  }

  async startSyncRun(run: SyncRun): Promise<void> {
    const { error } = await this.db.writer.from("sync_runs").insert({
      id: run.id,
      source_id: run.sourceId,
      trigger: run.trigger,
      requested_by: run.requestedBy,
      started_at: run.startedAt,
      status: "running",
    });
    if (error) failed("startSyncRun", error);
  }

  async finishSyncRun(
    runId: string,
    result: { status: SyncRunStatus; importBatchId: string | null; errorSummary: string | null },
  ): Promise<void> {
    const { error } = await this.db.writer
      .from("sync_runs")
      .update({
        status: result.status,
        import_batch_id: result.importBatchId,
        error_summary: result.errorSummary,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
    if (error) failed("finishSyncRun", error);
  }
}
