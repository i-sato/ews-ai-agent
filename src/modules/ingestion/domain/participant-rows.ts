import { parsePercentage } from "./cell-values";
import type { ItemType } from "./item-type";
import type { ModuleItem, SheetLayout } from "./sheet-layout";
import {
  type EnrollmentStatus,
  type ItemStatus,
  DEFAULT_STATUS_MAPPING,
  cekSyncFlag,
  isFormulaError,
  mapEnrollmentStatus,
  mapItemStatus,
  mapOnboarding,
} from "./status-mapping";
import { tidy } from "./text";

/** Urutan tetap agar hasil deterministik. */
const FLAG_ORDER = [
  "formula_error",
  "error_sync",
  "lms_invalid",
  "lms_mismatch",
  "unmapped_status",
  "unknown_item_status",
  "duplicate_participant",
] as const;

export type QualityFlag = (typeof FLAG_ORDER)[number];

export interface ModuleProgress {
  sequence: number;
  moduleCode: string;
  moduleName: string;
  moduleType: ItemType;
  status: ItemStatus;
}

/** Kontrak data internal satu peserta (spesifikasi §3.3), format panjang per item. */
export interface NormalizedParticipant {
  rowNumber: number;
  participantNumber: string;
  participantName: string;
  organization: string;
  sourceStatus: string;
  enrollmentStatus: EnrollmentStatus;
  onboardingStatus: boolean | null;
  completionPercentage: number | null;
  completedItems: number;
  totalItems: number;
  modules: ModuleProgress[];
  qualityFlags: QualityFlag[];
}

export interface NormalizeOptions {
  /** Toleransi konsistensi LMS dalam poin persentase (dari konfigurasi aturan, mis. 1). */
  lmsTolerancePp: number;
  statusMapping?: Readonly<Record<string, EnrollmentStatus>>;
  /** Nomor baris sheet untuk baris data pertama; bawaan 3 (baris 1 metadata, baris 2 header). */
  firstDataRow?: number;
}

export interface NormalizedRows {
  participants: NormalizedParticipant[];
  /** Nomor baris tanpa `NO REGISTRASI` (dicatat sebagai `ignored_rows`, bukan progres 0%). */
  ignoredRows: number[];
}

type Read = (index: number) => string;

function toModules(read: Read, items: readonly ModuleItem[]): ModuleProgress[] {
  return items.map((it) => ({
    sequence: it.sequence,
    moduleCode: it.code,
    moduleName: it.title,
    moduleType: it.type,
    status: mapItemStatus(read(it.columnIndex)),
  }));
}

function cellFlags(read: Read, layout: SheetLayout): QualityFlag[] {
  const indexes = [...Object.values(layout.identity), ...layout.items.map((i) => i.columnIndex)];
  const flags: QualityFlag[] = indexes.some((i) => isFormulaError(read(i)))
    ? ["formula_error"]
    : [];
  const sync = cekSyncFlag(read(layout.cekSyncIndex));
  if (sync !== "ok") flags.push(sync);
  return flags;
}

/**
 * Konsistensi `PERSENTASE LMS` dengan rasio item selesai. Tidak dinilai bila ada status item
 * tak dikenal: rasionya tidak dapat diverifikasi (baris tetap ditandai `unknown_item_status`).
 */
function lmsFlags(
  lms: ReturnType<typeof parsePercentage>,
  modules: readonly ModuleProgress[],
  tolerancePp: number,
): QualityFlag[] {
  if (lms.kind === "invalid") return ["lms_invalid"];
  if (lms.kind !== "value" || modules.length === 0) return [];
  if (modules.some((m) => m.status === "unknown")) return [];
  const completed = modules.filter((m) => m.status === "completed").length;
  const ratio = (completed / modules.length) * 100;
  return Math.abs(lms.value - ratio) > tolerancePp ? ["lms_mismatch"] : [];
}

function sortFlags(flags: Iterable<QualityFlag>): QualityFlag[] {
  const set = new Set(flags);
  return FLAG_ORDER.filter((f) => set.has(f));
}

type RowContext = { layout: SheetLayout; options: NormalizeOptions };

function normalizeRow(read: Read, rowNumber: number, ctx: RowContext): NormalizedParticipant {
  const { layout, options } = ctx;
  const { identity } = layout;
  const modules = toModules(read, layout.items);
  const completed = modules.filter((m) => m.status === "completed").length;
  const lms = parsePercentage(read(identity.lmsPercentage));
  const sourceStatus = tidy(read(identity.status));
  const enrollmentStatus = mapEnrollmentStatus(
    sourceStatus,
    options.statusMapping ?? DEFAULT_STATUS_MAPPING,
  );
  const flags = [...cellFlags(read, layout), ...lmsFlags(lms, modules, options.lmsTolerancePp)];
  if (enrollmentStatus === "unmapped") flags.push("unmapped_status");
  if (modules.some((m) => m.status === "unknown")) flags.push("unknown_item_status");
  return {
    rowNumber,
    participantNumber: tidy(read(identity.participantNumber)),
    participantName: tidy(read(identity.name)),
    organization: tidy(read(identity.organization)),
    sourceStatus,
    enrollmentStatus,
    onboardingStatus: mapOnboarding(read(identity.onboarding)),
    completionPercentage: lms.kind === "value" ? lms.value : null,
    completedItems: completed,
    totalItems: modules.length,
    modules,
    qualityFlags: sortFlags(flags),
  };
}

function markDuplicates(participants: NormalizedParticipant[]): void {
  const counts = new Map<string, number>();
  for (const p of participants) {
    counts.set(p.participantNumber, (counts.get(p.participantNumber) ?? 0) + 1);
  }
  for (const p of participants) {
    if ((counts.get(p.participantNumber) ?? 0) > 1) {
      p.qualityFlags = sortFlags([...p.qualityFlags, "duplicate_participant"]);
    }
  }
}

/**
 * Normalisasi baris data sheet (mulai baris 3) ke format panjang (spesifikasi §3.3, §3.4 no. 2).
 * Hanya baris ber-`NO REGISTRASI` yang menjadi peserta. Kolom yang tidak dikenali `detectLayout`
 * (mis. `JENIS KELAMIN`, `USIA`) tidak pernah dibaca.
 */
export function normalizeParticipants(
  rows: readonly (readonly string[])[],
  layout: SheetLayout,
  options: NormalizeOptions,
): NormalizedRows {
  const first = options.firstDataRow ?? 3;
  const participants: NormalizedParticipant[] = [];
  const ignoredRows: number[] = [];
  rows.forEach((row, i) => {
    const read: Read = (index) => row[index] ?? "";
    if (tidy(read(layout.identity.participantNumber)) === "") ignoredRows.push(first + i);
    else participants.push(normalizeRow(read, first + i, { layout, options }));
  });
  markDuplicates(participants);
  return { participants, ignoredRows };
}
