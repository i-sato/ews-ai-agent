import type { Catalog, CatalogItem, CommittedState } from "./ports";
import type { ImportSummary } from "./schemas";
import type { SourceSnapshot } from "./source-snapshot";

export type CatalogState = ImportSummary["catalog"];
export type Blocker = ImportSummary["blockers"][number];

const sameItem = (a: CatalogItem, b: CatalogItem) =>
  a.sequence === b.sequence &&
  a.sourceName === b.sourceName &&
  a.sourceColumn === b.sourceColumn &&
  a.moduleType === b.moduleType;

/**
 * Impor pertama membuat katalog v1 draf (keputusan F2-06). Katalog berbeda dari versi terakhir
 * menahan commit sampai versi baru disetujui (spesifikasi §3.3, F2-10).
 */
export function compareCatalog(
  current: Catalog | null,
  items: readonly CatalogItem[],
): CatalogState {
  if (!current) return "new";
  const same =
    current.items.length === items.length &&
    current.items.every((item, i) => sameItem(item, items[i] as CatalogItem));
  return same ? "unchanged" : "changed";
}

function rowChanges(snapshot: SourceSnapshot, previous: CommittedState | null) {
  let newRows = 0;
  let changedRows = 0;
  for (const [number, hash] of snapshot.rowHashes) {
    const before = previous?.rowHashes.get(number);
    if (before === undefined) newRows++;
    else if (before !== hash) changedRows++;
  }
  return { newRows, changedRows, unchangedRows: snapshot.rowHashes.size - newRows - changedRows };
}

function flagCounts(snapshot: SourceSnapshot): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of snapshot.participants) {
    for (const flag of p.qualityFlags) counts[flag] = (counts[flag] ?? 0) + 1;
  }
  return counts;
}

export function blockersFor(snapshot: SourceSnapshot, catalog: CatalogState): Blocker[] {
  const blockers: Blocker[] = [];
  const duplicate = snapshot.participants.some((p) =>
    p.qualityFlags.includes("duplicate_participant"),
  );
  if (duplicate) blockers.push("DUPLICATE_PARTICIPANTS");
  if (catalog === "changed") blockers.push("CATALOG_CHANGED");
  return blockers;
}

/** Ringkasan pratinjau (spesifikasi §3.4 langkah 3). Tanpa nama atau nomor peserta. */
export function summarize(
  snapshot: SourceSnapshot,
  previous: CommittedState | null,
  catalog: CatalogState,
): ImportSummary {
  const { layout, participants } = snapshot;
  return {
    participants: participants.length,
    ...rowChanges(snapshot, previous),
    duplicateRows: participants.filter((p) => p.qualityFlags.includes("duplicate_participant"))
      .length,
    flaggedRows: participants.filter((p) => p.qualityFlags.length > 0).length,
    ignoredRows: snapshot.ignoredRows.length,
    items: layout.items.length,
    emptySlots: layout.emptySlots,
    itemRange: layout.range,
    qualityFlags: flagCounts(snapshot),
    reconciliationMismatches: snapshot.reconciliation.mismatches,
    catalog,
    blockers: blockersFor(snapshot, catalog),
  };
}

export const BLOCKER_MESSAGES: Record<Blocker, string> = {
  DUPLICATE_PARTICIPANTS: "Ada nomor registrasi ganda; selesaikan di sumber sebelum menyimpan.",
  CATALOG_CHANGED: "Katalog item berubah; versi katalog baru harus disetujui sebelum menyimpan.",
};
