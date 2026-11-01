import { strFromU8, unzipSync } from "fflate";
import { readSheet } from "read-excel-file/node";
import type { SheetRead } from "../../application/ports";
import { type FileLimits, isZip } from "./limits";

/** Tab template peserta (spesifikasi §3.2). */
export const TARGET_SHEET = "ALL PENDAFTAR WEB";

const INVALID: SheetRead = { ok: false, error: "INVALID_FILE" };
const WORKBOOK = "xl/workbook.xml";

type Inspection = { uncompressed: number; sheets: string[] };

const decodeXml = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/**
 * Ukuran isi ZIP menurut direktori arsip dan nama sheet, tanpa mengekstrak apa pun selain
 * `xl/workbook.xml`. Null bila bukan ZIP yang valid.
 */
function inspect(bytes: Uint8Array): Inspection | null {
  let uncompressed = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (file) => {
        uncompressed += file.originalSize;
        return file.name === WORKBOOK;
      },
    });
  } catch {
    return null;
  }
  const workbook = files[WORKBOOK];
  if (!workbook) return null;
  const names = [...strFromU8(workbook).matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g)];
  return { uncompressed, sheets: names.map((m) => decodeXml(m[1] as string)) };
}

/** Tab template bila ada; satu-satunya sheet bila hanya satu; selain itu tidak menebak. */
function chooseSheet(sheets: string[]): string | number | null {
  if (sheets.includes(TARGET_SHEET)) return TARGET_SHEET;
  return sheets.length === 1 ? 1 : null;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value);
}

/**
 * XLSX (SH-UPLOAD-01/02): signature ZIP, ukuran file dan isi dibatasi sebelum dibuka; formula tidak
 * dievaluasi (nilai tersimpan yang dibaca). Keterbatasan: sel galat formula (`#REF!`) dibaca
 * library sebagai kosong (docs/decisions.md).
 */
export async function parseXlsxFile(bytes: Uint8Array, limits: FileLimits): Promise<SheetRead> {
  if (bytes.byteLength > limits.maxBytes) return { ok: false, error: "FILE_TOO_LARGE" };
  if (!isZip(bytes)) return INVALID;
  const info = inspect(bytes);
  if (!info) return INVALID;
  if (info.uncompressed > limits.maxUncompressedBytes)
    return { ok: false, error: "FILE_TOO_LARGE" };
  const sheet = chooseSheet(info.sheets);
  if (sheet === null) return INVALID;
  let data: unknown[][];
  try {
    data = await readSheet(Buffer.from(bytes), sheet);
  } catch {
    return INVALID;
  }
  if (data.length > limits.maxRows) return { ok: false, error: "TOO_MANY_ROWS" };
  return { ok: true, rows: data.map((row) => row.map(cellText)) };
}
