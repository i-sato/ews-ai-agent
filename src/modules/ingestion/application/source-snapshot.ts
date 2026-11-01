import { type NormalizedParticipant, normalizeParticipants } from "../domain/participant-rows";
import { type Row1Reconciliation, reconcileRow1 } from "../domain/row1-reconciliation";
import { type SheetLayout, detectLayout } from "../domain/sheet-layout";
import { DEFAULT_STATUS_MAPPING } from "../domain/status-mapping";
import { columnLetter } from "../domain/text";
import { parseUpdateLabel } from "../domain/update-label";
import { hashContent } from "./content-hash";
import { type Result, fail, ok } from "./errors";
import type {
  CatalogItem,
  Clock,
  DataSourceConfig,
  DriveMetadata,
  Freshness,
  ImportRepository,
  ImportSettings,
  SheetReadError,
  SheetSource,
} from "./ports";

export interface SnapshotDeps {
  sheets: SheetSource;
  drive: DriveMetadata;
  imports: ImportRepository;
  clock: Clock;
  settings: ImportSettings;
}

/** Isi sumber yang sudah dinormalisasi; tidak pernah disimpan sebagai staging (keputusan F2-06). */
export interface SourceSnapshot {
  source: DataSourceConfig;
  layout: SheetLayout;
  participants: NormalizedParticipant[];
  ignoredRows: number[];
  reconciliation: Row1Reconciliation;
  catalog: CatalogItem[];
  contentHash: string;
  rowHashes: Map<string, string>;
  freshness: Omit<Freshness, "contentChangedAt">;
  /** `modifiedTime` Drive saja (untuk `data_sources.source_modified_at`); null bila tidak ada. */
  driveModifiedAt: string | null;
}

const READ_ERRORS: Record<SheetReadError, string> = {
  PERMISSION_DENIED: "Sheet tidak dapat dibaca: akses untuk service account belum diberikan.",
  NOT_FOUND: "Sheet atau file sumber tidak ditemukan.",
  UNAVAILABLE: "Layanan sumber data sedang tidak tersedia. Coba lagi nanti.",
  INVALID_FILE: "File sumber tidak valid atau rusak.",
};

const UPDATE_LABEL = /UPDATE\s+TERAKHIR/i;

function toCatalog(layout: SheetLayout): CatalogItem[] {
  return layout.items.map((item) => ({
    sequence: item.sequence,
    moduleCode: item.code,
    name: item.title,
    sourceName: item.sourceTitle,
    moduleType: item.type,
    sourceColumn: columnLetter(item.columnIndex),
  }));
}

/** `modifiedTime` Drive diutamakan; sel UPDATE TERAKHIR hanya cadangan dan pembanding (§3.5). */
async function sourceTimes(deps: SnapshotDeps, source: DataSourceConfig, meta: string[]) {
  const cell = meta.find((c) => UPDATE_LABEL.test(c)) ?? "";
  const label = parseUpdateLabel(cell, source.trainingPeriod);
  const labelUpdatedAt = label.ok ? label.sourceUpdatedAt : null;
  const driveModifiedAt = source.driveFileId
    ? await deps.drive.modifiedTime(source.driveFileId)
    : null;
  const freshness = {
    fetchedAt: deps.clock.now().toISOString(),
    sourceUpdatedAt: driveModifiedAt ?? labelUpdatedAt,
    sourceUpdatedAtUncertain: driveModifiedAt === null && (!label.ok || label.yearUncertain),
    labelUpdatedAt,
  };
  return { freshness, driveModifiedAt };
}

export async function loadSnapshot(
  deps: SnapshotDeps,
  sourceId: string,
): Promise<Result<SourceSnapshot>> {
  const source = await deps.imports.findSource(sourceId);
  if (!source) return fail("NOT_FOUND", "Sumber data tidak ditemukan.");
  const read = await deps.sheets.readRows(source);
  if (!read.ok) {
    return fail("SOURCE_UNAVAILABLE", READ_ERRORS[read.error], { reason: read.error });
  }
  const [meta = [], headers = [], ...data] = read.rows;
  const detected = detectLayout(headers, source.headerAliases);
  if (!detected.ok) {
    const { code, detail } = detected.error;
    return fail("BLOCKED", `Tata letak sheet tidak sesuai: ${detail}.`, { layoutError: code });
  }
  const layout = detected.layout;
  // Konfigurasi sumber menimpa pemetaan bawaan (`status_mapping` bawaan {}), tidak menggantikannya.
  const statusMapping = { ...DEFAULT_STATUS_MAPPING, ...source.statusMapping };
  const options = { lmsTolerancePp: deps.settings.lmsTolerancePp, statusMapping };
  const normalized = normalizeParticipants(data, layout, options);
  const catalog = toCatalog(layout);
  const { contentHash, rowHashes } = await hashContent(normalized.participants, catalog);
  return ok({
    source,
    layout,
    participants: normalized.participants,
    ignoredRows: normalized.ignoredRows,
    reconciliation: reconcileRow1(meta, layout, normalized.participants),
    catalog,
    contentHash,
    rowHashes,
    ...(await sourceTimes(deps, source, meta)),
  });
}
