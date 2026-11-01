import { parse } from "csv-parse/sync";
import type { SheetRead } from "../../application/ports";
import { type FileLimits, isZip } from "./limits";

const INVALID: SheetRead = { ok: false, error: "INVALID_FILE" };

function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * CSV ekspor sheet (SH-UPLOAD-01/02): harus teks UTF-8, bukan ZIP, tanpa byte NUL; isi tidak
 * pernah dievaluasi (sel `=...` tetap teks). Parsing berhenti setelah batas baris terlampaui.
 */
export function parseCsvFile(bytes: Uint8Array, limits: FileLimits): SheetRead {
  if (bytes.byteLength > limits.maxBytes) return { ok: false, error: "FILE_TOO_LARGE" };
  if (isZip(bytes) || bytes.includes(0)) return INVALID;
  const text = decodeUtf8(bytes);
  if (text === null) return INVALID;
  let rows: string[][];
  try {
    rows = parse(text, {
      bom: true,
      relax_column_count: true,
      skip_empty_lines: false,
      to_line: limits.maxRows + 1,
    }) as string[][];
  } catch {
    return INVALID;
  }
  if (rows.length > limits.maxRows) return { ok: false, error: "TOO_MANY_ROWS" };
  return { ok: true, rows };
}
