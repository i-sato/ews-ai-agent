import { isFormulaError } from "./status-mapping";
import { tidy } from "./text";

export type PercentageResult =
  | { kind: "value"; value: number }
  | { kind: "empty" }
  | { kind: "formula_error" }
  | { kind: "invalid" };

const PERCENT = /^(\d{1,3})(?:[.,](\d+))?%?$/;

/**
 * `PERSENTASE LMS` (spesifikasi §3.3): rentang 0–100, desimal koma atau titik, boleh berakhiran %.
 * Sel kosong bukan 0%; galat formula tidak diolah sebagai angka.
 */
export function parsePercentage(raw: string): PercentageResult {
  const value = tidy(raw);
  if (value === "") return { kind: "empty" };
  if (isFormulaError(value)) return { kind: "formula_error" };
  const m = PERCENT.exec(value);
  if (!m) return { kind: "invalid" };
  const number = Number(`${m[1]}.${m[2] ?? "0"}`);
  return number <= 100 ? { kind: "value", value: number } : { kind: "invalid" };
}

const COUNT = /^\d{1,3}(?:\.\d{3})*$|^\d+$/;

/** Jumlah bulat di baris 1, dengan pemisah ribuan titik (`78.319`). Selain itu null. */
export function parseCount(raw: string): number | null {
  const value = tidy(raw);
  if (!COUNT.test(value)) return null;
  return Number(value.replace(/\./g, ""));
}
