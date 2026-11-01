import { parseCount } from "./cell-values";
import type { NormalizedParticipant } from "./participant-rows";
import type { SheetLayout } from "./sheet-layout";
import { headerKey } from "./text";

export type TotalLabel =
  "TOTAL PENDAFTAR" | "TOTAL DITERIMA" | "TOTAL ONBOARDING" | "TOTAL SELESAI";

export type CheckStatus = "match" | "mismatch" | "explained" | "missing" | "not_reconciled";

export interface TotalCheck {
  label: TotalLabel;
  reported: number | null;
  recounted: number | null;
  status: CheckStatus;
  note?: string;
}

export interface ItemCountCheck {
  sequence: number;
  moduleCode: string;
  reported: number | null;
  recounted: number;
  status: "match" | "mismatch" | "missing";
}

export interface Row1Reconciliation {
  totals: TotalCheck[];
  items: ItemCountCheck[];
  /** Jumlah pemeriksaan berstatus `mismatch` atau `missing` (ditampilkan di pratinjau). */
  mismatches: number;
}

/** Angka di sel setelah label (asumsi format baris 1, docs/decisions.md). */
function reportedTotal(meta: readonly string[], label: TotalLabel): number | null | undefined {
  const index = meta.findIndex((c) => headerKey(c) === headerKey(label));
  return index < 0 ? undefined : parseCount(meta[index + 1] ?? "");
}

function compare(label: TotalLabel, reported: number | null | undefined, recounted: number) {
  if (reported === undefined || reported === null) {
    const note = `Label ${label} tidak ditemukan di baris 1.`;
    return { label, reported: null, recounted, status: "missing", note } satisfies TotalCheck;
  }
  const status = reported === recounted ? "match" : "mismatch";
  return { label, reported, recounted, status } satisfies TotalCheck;
}

/** Selisih pendaftar yang setara jumlah baris Pembatalan (contoh §3.3: 50 vs 51). */
function registrants(meta: readonly string[], participants: readonly NormalizedParticipant[]) {
  const check: TotalCheck = compare(
    "TOTAL PENDAFTAR",
    reportedTotal(meta, "TOTAL PENDAFTAR"),
    participants.length,
  );
  const cancelled = participants.filter((p) => p.enrollmentStatus === "cancelled").length;
  const diff = participants.length - (check.reported ?? participants.length);
  if (check.status !== "mismatch" || cancelled === 0 || diff !== cancelled) return check;
  return {
    ...check,
    status: "explained",
    note: `Selisih ${diff} karena ${cancelled} baris Pembatalan.`,
  } satisfies TotalCheck;
}

function accepted(meta: readonly string[]): TotalCheck {
  return {
    label: "TOTAL DITERIMA",
    reported: reportedTotal(meta, "TOTAL DITERIMA") ?? null,
    recounted: null,
    status: "not_reconciled",
    note: "Arti TOTAL DITERIMA belum dikonfirmasi; angka ditampilkan apa adanya.",
  };
}

function itemChecks(
  meta: readonly string[],
  layout: SheetLayout,
  participants: readonly NormalizedParticipant[],
): ItemCountCheck[] {
  return layout.items.map((item, i) => {
    const recounted = participants.filter((p) => p.modules[i]?.status === "completed").length;
    const reported = parseCount(meta[item.columnIndex] ?? "");
    const status = reported === null ? "missing" : reported === recounted ? "match" : "mismatch";
    return { sequence: item.sequence, moduleCode: item.code, reported, recounted, status };
  });
}

/**
 * Rekonsiliasi total baris 1 dengan hitung ulang (spesifikasi §3.3, §3.4 langkah 3).
 * Selisih tidak menghentikan impor; ditampilkan di pratinjau beserta penjelasannya.
 */
export function reconcileRow1(
  meta: readonly string[],
  layout: SheetLayout,
  participants: readonly NormalizedParticipant[],
): Row1Reconciliation {
  const totals: TotalCheck[] = [
    registrants(meta, participants),
    accepted(meta),
    compare(
      "TOTAL ONBOARDING",
      reportedTotal(meta, "TOTAL ONBOARDING"),
      participants.filter((p) => p.onboardingStatus === true).length,
    ),
    compare(
      "TOTAL SELESAI",
      reportedTotal(meta, "TOTAL SELESAI"),
      participants.filter((p) => p.enrollmentStatus === "passed").length,
    ),
  ];
  const items = itemChecks(meta, layout, participants);
  const failed = (s: string) => s === "mismatch" || s === "missing";
  const mismatches = [...totals, ...items].filter((c) => failed(c.status)).length;
  return { totals, items, mismatches };
}
