// Port ingestion (spesifikasi §4.2). Adapter Supabase, Google Sheets/Drive, dan Storage dirakit
// di src/lib/container.ts (F2-07); use case hanya mengenal interface ini.
import type { ItemType } from "../domain/item-type";
import type { NormalizedParticipant } from "../domain/participant-rows";
import type { IdentityField } from "../domain/sheet-layout";
import type { EnrollmentStatus } from "../domain/status-mapping";

export type SourceType = "google_sheets" | "csv" | "xlsx";
export type ActorRole = "admin" | "pk_manager" | "training_manager" | "viewer";

/** Aktor yang sudah diverifikasi di server (role dari `profiles`, SH-AUTHZ-01). */
export interface Actor {
  id: string;
  role: ActorRole;
}

export interface DataSourceConfig {
  id: string;
  trainingId: string;
  sourceType: SourceType;
  /** Google Sheets: `spreadsheetId` + `gid`; CSV/XLSX: path file di bucket privat. */
  reference: { spreadsheetId: string; gid: string | null } | { storagePath: string };
  driveFileId: string | null;
  headerAliases: Partial<Record<IdentityField, string[]>>;
  statusMapping: Readonly<Record<string, EnrollmentStatus>>;
  /** Periode pelaksanaan (YYYY-MM-DD) untuk tahun `UPDATE TERAKHIR`; null bila belum ada. */
  trainingPeriod: { start: string; end: string } | null;
  freshnessThresholdHours: number;
}

export type SheetReadError = "PERMISSION_DENIED" | "NOT_FOUND" | "UNAVAILABLE" | "INVALID_FILE";

export type SheetRead = { ok: true; rows: string[][] } | { ok: false; error: SheetReadError };

export interface SheetSource {
  /** Nilai sel sebagai teks; formula tidak pernah dieksekusi (SH-UPLOAD-02). */
  readRows(source: Pick<DataSourceConfig, "sourceType" | "reference">): Promise<SheetRead>;
  readTitle(
    spreadsheetId: string,
  ): Promise<{ ok: true; title: string } | { ok: false; error: SheetReadError }>;
}

export interface DriveMetadata {
  /** `modifiedTime` file (ISO); null bila metadata tidak tersedia. */
  modifiedTime(fileId: string): Promise<string | null>;
}

export interface CatalogItem {
  sequence: number;
  moduleCode: string;
  name: string;
  sourceName: string;
  moduleType: ItemType;
  sourceColumn: string;
}

export interface Catalog {
  version: number;
  status: "draft" | "approved" | "superseded";
  items: CatalogItem[];
}

export type BatchStatus = "staged" | "committed" | "rejected" | "expired" | "unchanged";

export interface Freshness {
  fetchedAt: string;
  contentChangedAt: string | null;
  sourceUpdatedAt: string | null;
  sourceUpdatedAtUncertain: boolean;
  /** Waktu dari sel `UPDATE TERAKHIR` (pembanding saja). */
  labelUpdatedAt: string | null;
}

/** Baris `import_batches`. Isi peserta tidak disimpan; commit membaca ulang sumber. */
export interface ImportBatch {
  id: string;
  sourceId: string;
  trainingId: string;
  status: BatchStatus;
  contentHash: string;
  idempotencyKey: string | null;
  expiresAt: string | null;
  freshness: Freshness;
  summary: Record<string, unknown>;
  createdBy: string | null;
}

export interface CommittedState {
  contentHash: string;
  contentChangedAt: string;
  labelUpdatedAt: string | null;
  /** Hash per peserta dari snapshot terakhir, kunci = nomor registrasi. */
  rowHashes: ReadonlyMap<string, string>;
}

export interface CommitPayload {
  batch: ImportBatch;
  idempotencyKey: string;
  participants: readonly NormalizedParticipant[];
  rowHashes: ReadonlyMap<string, string>;
  /** `create` = katalog v1 draf untuk impor pertama; `reuse` = katalog yang ada. */
  catalog: { action: "create" | "reuse"; version: number; items: CatalogItem[] };
  actorId: string | null;
}

export interface SyncRun {
  id: string;
  sourceId: string;
  trigger: "scheduled" | "manual";
  requestedBy: string | null;
  startedAt: string;
}

export type SyncRunStatus = "succeeded" | "unchanged" | "failed";

export interface ImportRepository {
  findSource(sourceId: string): Promise<DataSourceConfig | null>;
  committedState(sourceId: string): Promise<CommittedState | null>;
  currentCatalog(trainingId: string): Promise<Catalog | null>;
  saveBatch(batch: ImportBatch): Promise<void>;
  findBatch(batchId: string): Promise<ImportBatch | null>;
  findBatchByIdempotencyKey(key: string): Promise<ImportBatch | null>;
  setBatchStatus(batchId: string, status: BatchStatus): Promise<void>;
  /** Satu transaksi: katalog, peserta, enrollment, snapshot, progres item, status batch. */
  commit(payload: CommitPayload): Promise<void>;
  /** Hanya `last_fetched_at` dan `source_modified_at` di `data_sources`. */
  recordFetch(
    sourceId: string,
    at: { fetchedAt: string; sourceModifiedAt: string | null },
  ): Promise<void>;
  lastManualSyncAt(sourceId: string): Promise<string | null>;
  startSyncRun(run: SyncRun): Promise<void>;
  finishSyncRun(
    runId: string,
    result: { status: SyncRunStatus; importBatchId: string | null; errorSummary: string | null },
  ): Promise<void>;
}

export interface NewTraining {
  id: string;
  workTeamYearId: string;
  code: string;
  name: string;
  schemeCode: string | null;
  portalUrl: string | null;
  portalTrainingId: string;
  startDate: string;
  endDate: string;
  idConfirmedBy: string;
  idConfirmedAt: string;
}

export interface NewDataSource {
  id: string;
  trainingId: string;
  spreadsheetId: string;
  gid: string | null;
}

export interface TrainingRepository {
  teamCodes(): Promise<string[]>;
  findWorkTeamYear(teamCode: string, year: number): Promise<{ id: string } | null>;
  findByPortalTrainingId(portalTrainingId: string): Promise<{ id: string; code: string } | null>;
  /** Pelatihan dan sumber datanya dalam satu transaksi. */
  createWithSource(training: NewTraining, source: NewDataSource): Promise<void>;
}

export interface AuditEntry {
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  /** Tanpa PII, secret, atau isi dokumen (SH-LOG-02). */
  details: Record<string, unknown>;
}

export interface AuditLog {
  record(entry: AuditEntry): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  uuid(): string;
}

/** Nilai konfigurasi; tidak ada angka bawaan di kode (docs/decisions.md). */
export interface ImportSettings {
  /** Toleransi konsistensi LMS dari versi aturan risiko yang disetujui. */
  lmsTolerancePp: number;
  stagingTtlMinutes: number;
  manualSyncMinIntervalMinutes: number;
}
