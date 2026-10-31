import { inferItemType, type ItemType } from "./item-type";
import { columnLetter, decodeEntities, headerKey, tidy } from "./text";

export const IDENTITY_COLUMNS = {
  name: "nama",
  participantNumber: "no registrasi",
  organization: "instansi",
  status: "status",
  onboarding: "onboarding",
  lmsPercentage: "persentase lms",
} as const;

export type IdentityField = keyof typeof IDENTITY_COLUMNS;

export type LayoutErrorCode =
  | "MISSING_COLUMN"
  | "CEK_SYNC_MISSING"
  | "CEK_SYNC_DUPLICATE"
  | "CEK_SYNC_BEFORE_LMS"
  | "ITEM_RANGE_EMPTY";

export interface LayoutError {
  code: LayoutErrorCode;
  detail: string;
}

export interface ModuleItem {
  sequence: number;
  code: string;
  title: string;
  sourceTitle: string;
  type: ItemType;
  columnIndex: number;
  duplicateTitle: boolean;
}

export interface SheetLayout {
  identity: Record<IdentityField, number>;
  cekSyncIndex: number;
  items: ModuleItem[];
  emptySlots: number;
  range: { from: string; to: string };
  trailingColumns: number;
}

export type LayoutResult = { ok: true; layout: SheetLayout } | { ok: false; error: LayoutError };

const CEK_SYNC = "cek sync";

type Aliases = Partial<Record<IdentityField, string[]>>;

function findIdentity(
  keys: string[],
  aliases: Aliases,
): Record<IdentityField, number> | LayoutError {
  const found = {} as Record<IdentityField, number>;
  for (const field of Object.keys(IDENTITY_COLUMNS) as IdentityField[]) {
    const names = [IDENTITY_COLUMNS[field], ...(aliases[field] ?? []).map(headerKey)];
    const index = keys.findIndex((k) => names.includes(k));
    if (index < 0) return { code: "MISSING_COLUMN", detail: IDENTITY_COLUMNS[field] };
    found[field] = index;
  }
  return found;
}

function locateCekSync(keys: string[], lmsIndex: number): number | LayoutError {
  const positions = keys.flatMap((k, i) => (k === CEK_SYNC ? [i] : []));
  if (positions.length === 0)
    return { code: "CEK_SYNC_MISSING", detail: "Kolom Cek Sync tidak ada" };
  if (positions.length > 1) {
    const cols = positions.map(columnLetter).join(", ");
    return { code: "CEK_SYNC_DUPLICATE", detail: `Cek Sync muncul di ${cols}` };
  }
  const index = positions[0] as number;
  if (index <= lmsIndex) return { code: "CEK_SYNC_BEFORE_LMS", detail: columnLetter(index) };
  return index;
}

function buildItems(headers: string[], from: number, to: number): ModuleItem[] {
  const slots = headers.slice(from, to).map((h, i) => ({ raw: h, columnIndex: from + i }));
  const titled = slots.filter((s) => tidy(s.raw) !== "");
  const counts = new Map<string, number>();
  titled.forEach((s) => counts.set(headerKey(s.raw), (counts.get(headerKey(s.raw)) ?? 0) + 1));
  return titled.map((s, i) => {
    const title = decodeEntities(tidy(s.raw));
    return {
      sequence: i + 1,
      code: `M${String(i + 1).padStart(2, "0")}`,
      title,
      sourceTitle: s.raw,
      type: inferItemType(title),
      columnIndex: s.columnIndex,
      duplicateTitle: (counts.get(headerKey(s.raw)) ?? 0) > 1,
    };
  });
}

/**
 * Deteksi kolom identitas dan rentang item dari baris header (spesifikasi §3.3).
 * Item = semua kolom setelah `PERSENTASE LMS` sampai sebelum `Cek Sync`. Tidak pernah menebak.
 */
export function detectLayout(headers: string[], aliases: Aliases = {}): LayoutResult {
  const keys = headers.map(headerKey);
  const identity = findIdentity(keys, aliases);
  if ("code" in identity) return { ok: false, error: identity };
  const cekSync = locateCekSync(keys, identity.lmsPercentage);
  if (typeof cekSync !== "number") return { ok: false, error: cekSync };
  const from = identity.lmsPercentage + 1;
  const items = buildItems(headers, from, cekSync);
  if (items.length === 0) {
    return { ok: false, error: { code: "ITEM_RANGE_EMPTY", detail: "Tidak ada item berjudul" } };
  }
  return {
    ok: true,
    layout: {
      identity,
      cekSyncIndex: cekSync,
      items,
      emptySlots: cekSync - from - items.length,
      range: { from: columnLetter(from), to: columnLetter(cekSync - 1) },
      trailingColumns: keys.length - cekSync - 1,
    },
  };
}
