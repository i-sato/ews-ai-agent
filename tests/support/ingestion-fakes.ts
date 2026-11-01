// Fake port in-memory untuk use case ingestion (tanpa Supabase atau Google).
import { readFileSync } from "node:fs";
import type {
  AuditEntry,
  Catalog,
  CommitPayload,
  CommittedState,
  DataSourceConfig,
  ImportBatch,
  ImportRepository,
  NewDataSource,
  NewTraining,
  SheetRead,
  SheetReadError,
  SheetSource,
  SyncRun,
  SyncRunStatus,
  TrainingRepository,
} from "@/modules/ingestion/application/ports";
import type { ImportDeps } from "@/modules/ingestion/application/preview-import";
import { SHEETS_DIR } from "../fixtures/golden/golden-sheets";
import { parseCsv } from "./csv";

export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const SOURCE_ID = uuid(901);
export const TRAINING_ID = uuid(902);
export const SPREADSHEET_ID = "1SintetisSpreadsheetIdUntukUji_ABCDEFG";
export const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=0`;

export const goldenRows = (key: string) =>
  parseCsv(readFileSync(`${SHEETS_DIR}${key}.csv`, "utf8"));

const refKey = (ref: DataSourceConfig["reference"]) =>
  "spreadsheetId" in ref ? ref.spreadsheetId : ref.storagePath;

export class FakeSheets implements SheetSource {
  rows = new Map<string, SheetRead>();
  titles = new Map<string, string>();
  readError: SheetReadError | null = null;

  async readRows(source: Pick<DataSourceConfig, "sourceType" | "reference">): Promise<SheetRead> {
    if (this.readError) return { ok: false, error: this.readError };
    return this.rows.get(refKey(source.reference)) ?? { ok: false, error: "NOT_FOUND" };
  }

  async readTitle(spreadsheetId: string) {
    if (this.readError) return { ok: false as const, error: this.readError };
    const title = this.titles.get(spreadsheetId);
    return title === undefined
      ? { ok: false as const, error: "NOT_FOUND" as const }
      : { ok: true as const, title };
  }

  setRows(rows: string[][]) {
    this.rows.set(SPREADSHEET_ID, { ok: true, rows });
  }
}

export class FakeImports implements ImportRepository {
  sources = new Map<string, DataSourceConfig>();
  batches = new Map<string, ImportBatch>();
  states = new Map<string, CommittedState>();
  catalogs = new Map<string, Catalog>();
  commits: CommitPayload[] = [];
  fetches: { sourceId: string; fetchedAt: string; sourceModifiedAt: string | null }[] = [];
  runs = new Map<string, SyncRun & { status?: SyncRunStatus; errorSummary?: string | null }>();

  async findSource(id: string) {
    return this.sources.get(id) ?? null;
  }
  async committedState(sourceId: string) {
    return this.states.get(sourceId) ?? null;
  }
  async currentCatalog(trainingId: string) {
    return this.catalogs.get(trainingId) ?? null;
  }
  async saveBatch(batch: ImportBatch) {
    this.batches.set(batch.id, structuredClone(batch));
  }
  async findBatch(id: string) {
    return this.batches.get(id) ?? null;
  }
  async findBatchByIdempotencyKey(key: string) {
    return [...this.batches.values()].find((b) => b.idempotencyKey === key) ?? null;
  }
  async setBatchStatus(id: string, status: ImportBatch["status"]) {
    const batch = this.batches.get(id);
    if (batch) batch.status = status;
  }
  async commit(payload: CommitPayload) {
    this.commits.push(payload);
    this.batches.set(payload.batch.id, structuredClone(payload.batch));
    const { batch } = payload;
    this.states.set(batch.sourceId, {
      contentHash: batch.contentHash,
      contentChangedAt: batch.freshness.contentChangedAt ?? batch.freshness.fetchedAt,
      labelUpdatedAt: batch.freshness.labelUpdatedAt,
      rowHashes: new Map(payload.rowHashes),
    });
    if (payload.catalog.action === "create") {
      const { version, items } = payload.catalog;
      this.catalogs.set(batch.trainingId, { version, status: "draft", items });
    }
  }
  async recordFetch(sourceId: string, at: { fetchedAt: string; sourceModifiedAt: string | null }) {
    this.fetches.push({ sourceId, ...at });
  }
  async lastManualSyncAt(sourceId: string) {
    const manual = [...this.runs.values()].filter(
      (r) => r.sourceId === sourceId && r.trigger === "manual",
    );
    return (
      manual
        .map((r) => r.startedAt)
        .sort()
        .at(-1) ?? null
    );
  }
  async startSyncRun(run: SyncRun) {
    this.runs.set(run.id, { ...run });
  }
  async finishSyncRun(
    id: string,
    result: { status: SyncRunStatus; importBatchId: string | null; errorSummary: string | null },
  ) {
    const run = this.runs.get(id);
    if (run) Object.assign(run, { status: result.status, errorSummary: result.errorSummary });
  }
}

export class FakeTrainings implements TrainingRepository {
  teamYears = new Map([["DTA:2026", uuid(801)]]);
  byPortal = new Map<string, { id: string; code: string }>();
  created: { training: NewTraining; source: NewDataSource }[] = [];

  async teamCodes() {
    return ["DTA", "GTA", "KDD"];
  }
  async findWorkTeamYear(teamCode: string, year: number) {
    const id = this.teamYears.get(`${teamCode}:${year}`);
    return id ? { id } : null;
  }
  async findByPortalTrainingId(id: string) {
    return this.byPortal.get(id) ?? null;
  }
  async createWithSource(training: NewTraining, source: NewDataSource) {
    this.created.push({ training, source });
  }
}

export class FakeAudit {
  entries: AuditEntry[] = [];
  async record(entry: AuditEntry) {
    this.entries.push(entry);
  }
}

export class FakeClock {
  constructor(public current = new Date("2026-10-13T05:00:00.000Z")) {}
  now() {
    return new Date(this.current);
  }
  advanceMinutes(minutes: number) {
    this.current = new Date(this.current.getTime() + minutes * 60_000);
  }
}

export class SeqIds {
  n = 0;
  uuid() {
    this.n += 1;
    return uuid(this.n);
  }
}

export function sourceConfig(over: Partial<DataSourceConfig> = {}): DataSourceConfig {
  return {
    id: SOURCE_ID,
    trainingId: TRAINING_ID,
    sourceType: "google_sheets",
    reference: { spreadsheetId: SPREADSHEET_ID, gid: "0" },
    driveFileId: null,
    headerAliases: {},
    statusMapping: {},
    trainingPeriod: { start: "2026-09-23", end: "2026-09-30" },
    freshnessThresholdHours: 72,
    ...over,
  };
}

/** Dependensi lengkap dengan sumber golden-1 terdaftar. */
export function importDeps(key = "golden-1") {
  const sheets = new FakeSheets();
  sheets.setRows(goldenRows(key));
  const imports = new FakeImports();
  imports.sources.set(SOURCE_ID, sourceConfig());
  const drive = {
    times: new Map<string, string>(),
    async modifiedTime(id: string) {
      return drive.times.get(id) ?? null;
    },
  };
  const deps = {
    sheets,
    drive,
    imports,
    audit: new FakeAudit(),
    clock: new FakeClock(),
    ids: new SeqIds(),
    settings: { lmsTolerancePp: 1, stagingTtlMinutes: 30, manualSyncMinIntervalMinutes: 10 },
  } satisfies ImportDeps;
  return deps;
}

export const ADMIN = { id: uuid(1001), role: "admin" as const };
export const MANAGER = { id: uuid(1002), role: "training_manager" as const };
export const VIEWER = { id: uuid(1003), role: "viewer" as const };
