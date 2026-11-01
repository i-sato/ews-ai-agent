import { headerKey } from "./text";

/** `in_selection` = STATUS "Submit" (seleksi penerimaan); `in_progress` = "Pelatihan". */
export type EnrollmentStatus =
  "passed" | "not_passed" | "cancelled" | "in_progress" | "in_selection" | "unmapped";
export type ItemStatus = "completed" | "not_started" | "unknown";

/** Pemetaan bawaan template DTA; konfigurasi sumber boleh menimpanya (spesifikasi §3.2.2). */
export const DEFAULT_STATUS_MAPPING: Readonly<Record<string, EnrollmentStatus>> = {
  "lulus pelatihan - nilai": "passed",
  "tidak lulus pelatihan - nilai": "not_passed",
  pembatalan: "cancelled",
  submit: "in_selection",
  pelatihan: "in_progress",
};

export function mapEnrollmentStatus(
  raw: string,
  mapping: Readonly<Record<string, EnrollmentStatus>> = DEFAULT_STATUS_MAPPING,
): EnrollmentStatus {
  return mapping[headerKey(raw)] ?? "unmapped";
}

export function mapOnboarding(raw: string): boolean | null {
  const key = headerKey(raw);
  if (key === "onboarding") return true;
  if (key === "tidak onboarding") return false;
  return null;
}

export function mapItemStatus(raw: string): ItemStatus {
  const key = headerKey(raw);
  if (key === "selesai") return "completed";
  if (key === "belum mengerjakan") return "not_started";
  return "unknown";
}

const FORMULA_ERRORS = new Set([
  "#ref!",
  "#n/a",
  "#value!",
  "#div/0!",
  "#name?",
  "#num!",
  "#null!",
]);

export function isFormulaError(raw: string): boolean {
  return FORMULA_ERRORS.has(headerKey(raw));
}

/** `Cek Sync` selain `OK` menjadi bendera kualitas data. */
export function cekSyncFlag(raw: string): "ok" | "error_sync" | "formula_error" {
  if (isFormulaError(raw)) return "formula_error";
  return headerKey(raw) === "ok" ? "ok" : "error_sync";
}
