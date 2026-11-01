// F2-07: parser CSV/XLSX dan FileSheetSource (SH-UPLOAD-01/02). Tanpa Supabase.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCsvFile } from "@/modules/ingestion/infrastructure/files/csv-file";
import { FileSheetSource } from "@/modules/ingestion/infrastructure/files/file-sheet-source";
import { FILE_LIMITS, type FileLimits } from "@/modules/ingestion/infrastructure/files/limits";
import { TARGET_SHEET, parseXlsxFile } from "@/modules/ingestion/infrastructure/files/xlsx-file";
import { intervalHours, toDataSource } from "@/modules/ingestion/infrastructure/supabase/rows";
import { SHEETS_DIR } from "../fixtures/golden/golden-sheets";
import { parseCsv } from "../support/csv";
import { type XlsxCell, buildXlsx } from "../support/xlsx";

const goldenBytes = () => new Uint8Array(readFileSync(`${SHEETS_DIR}golden-1.csv`));
const goldenRows = () => parseCsv(readFileSync(`${SHEETS_DIR}golden-1.csv`, "utf8"));
const small = (over: Partial<FileLimits>): FileLimits => ({ ...FILE_LIMITS, ...over });
const enc = (s: string) => new TextEncoder().encode(s);
const trimEnd = (row: string[]) => {
  const out = [...row];
  while (out.length > 0 && out.at(-1) === "") out.pop();
  return out;
};

describe("parseCsvFile", () => {
  it("golden-1 terbaca sama dengan isi CSV", () => {
    expect(parseCsvFile(goldenBytes(), FILE_LIMITS)).toEqual({ ok: true, rows: goldenRows() });
  });

  it("BOM dibuang dan sel berawalan = tetap teks", () => {
    const result = parseCsvFile(enc('﻿A,B\r\n=1+1,"x,y"\r\n'), FILE_LIMITS);
    expect(result).toEqual({
      ok: true,
      rows: [
        ["A", "B"],
        ["=1+1", "x,y"],
      ],
    });
  });

  it.each([
    ["ZIP/XLSX yang diberi nama CSV", buildXlsx([{ name: "S", rows: [["a"]] }])],
    ["byte NUL", new Uint8Array([0x41, 0x00, 0x42])],
    ["bukan UTF-8", new Uint8Array([0xff, 0xfe, 0x41])],
    ["kutip tidak tertutup", enc('A,"B\nC,D')],
  ])("menolak %s", (_, bytes) => {
    expect(parseCsvFile(bytes, FILE_LIMITS)).toEqual({ ok: false, error: "INVALID_FILE" });
  });

  it("batas ukuran dan baris", () => {
    expect(parseCsvFile(goldenBytes(), small({ maxBytes: 1000 }))).toEqual({
      ok: false,
      error: "FILE_TOO_LARGE",
    });
    expect(parseCsvFile(goldenBytes(), small({ maxRows: 50 }))).toEqual({
      ok: false,
      error: "TOO_MANY_ROWS",
    });
    expect(parseCsvFile(goldenBytes(), small({ maxRows: 68 })).ok).toBe(true);
  });
});

const goldenAsXlsx = (): XlsxCell[][] =>
  goldenRows().map((row) =>
    row.map((v): XlsxCell => {
      if (v === "") return null;
      if (v === "#REF!") return { error: v };
      return /^\d+$/.test(v) ? Number(v) : v;
    }),
  );

describe("parseXlsxFile", () => {
  it("golden-1 sebagai XLSX: nilai sama dengan CSV, kecuali sel galat formula", async () => {
    const bytes = buildXlsx([{ name: TARGET_SHEET, rows: goldenAsXlsx() }]);
    const result = await parseXlsxFile(bytes, FILE_LIMITS);
    if (!result.ok) throw new Error(result.error);
    const expected = goldenRows().map((row) => trimEnd(row.map((v) => (v === "#REF!" ? "" : v))));
    expect(result.rows.map(trimEnd)).toEqual(expected);
  });

  it("formula tidak dievaluasi: nilai tersimpan dibaca, tanpa nilai = kosong", async () => {
    const rows: XlsxCell[][] = [
      [{ formula: "SUM(1,1)", cached: 2 }, { formula: "A1*100" }, { error: "#REF!" }, true, "x"],
    ];
    const result = await parseXlsxFile(buildXlsx([{ name: "Data", rows }]), FILE_LIMITS);
    expect(result).toEqual({ ok: true, rows: [["2", "", "", "TRUE", "x"]] });
  });

  it("memilih tab template; satu sheet lain dipakai; banyak sheet tanpa tab template ditolak", async () => {
    const two = buildXlsx([
      { name: "Ringkasan", rows: [["bukan ini"]] },
      { name: TARGET_SHEET, rows: [["ini"]] },
    ]);
    expect(await parseXlsxFile(two, FILE_LIMITS)).toEqual({ ok: true, rows: [["ini"]] });
    const single = buildXlsx([{ name: "Sheet1", rows: [["satu"]] }]);
    expect(await parseXlsxFile(single, FILE_LIMITS)).toEqual({ ok: true, rows: [["satu"]] });
    const ambiguous = buildXlsx([
      { name: "A", rows: [["a"]] },
      { name: "B", rows: [["b"]] },
    ]);
    expect(await parseXlsxFile(ambiguous, FILE_LIMITS)).toEqual({
      ok: false,
      error: "INVALID_FILE",
    });
  });

  it.each([
    ["CSV yang diberi nama XLSX", enc("A,B\n1,2\n")],
    ["ZIP terpotong", buildXlsx([{ name: "S", rows: [["a"]] }]).slice(0, 60)],
  ])("menolak %s", async (_, bytes) => {
    expect(await parseXlsxFile(bytes, FILE_LIMITS)).toEqual({ ok: false, error: "INVALID_FILE" });
  });

  it("isi ZIP terlalu besar setelah diekstrak (zip bomb) ditolak sebelum dibuka", async () => {
    const padding = "<!--" + " ".repeat(20_000) + "-->";
    const bytes = buildXlsx([{ name: "S", rows: [["a"]] }], { "xl/pad.xml": padding });
    expect(bytes.byteLength).toBeLessThan(5_000);
    expect(await parseXlsxFile(bytes, small({ maxUncompressedBytes: 10_000 }))).toEqual({
      ok: false,
      error: "FILE_TOO_LARGE",
    });
  });

  it("batas ukuran file dan baris", async () => {
    const bytes = buildXlsx([{ name: "S", rows: goldenAsXlsx() }]);
    expect(await parseXlsxFile(bytes, small({ maxBytes: 100 }))).toEqual({
      ok: false,
      error: "FILE_TOO_LARGE",
    });
    expect(await parseXlsxFile(bytes, small({ maxRows: 10 }))).toEqual({
      ok: false,
      error: "TOO_MANY_ROWS",
    });
  });
});

describe("FileSheetSource", () => {
  const files = new Map<string, Uint8Array>([["src/up.csv", goldenBytes()]]);
  const source = new FileSheetSource(
    { download: async (path) => files.get(path) ?? null },
    FILE_LIMITS,
  );

  it("membaca file sesuai jenis sumber", async () => {
    const read = await source.readRows({ sourceType: "csv", reference: null }, "src/up.csv");
    expect(read.ok && read.rows.length).toBe(68);
  });

  it("file tidak ada atau belum diunggah", async () => {
    expect(await source.readRows({ sourceType: "csv", reference: null }, "src/lain.csv")).toEqual({
      ok: false,
      error: "NOT_FOUND",
    });
    expect(await source.readRows({ sourceType: "xlsx", reference: null }, null)).toEqual({
      ok: false,
      error: "NOT_FOUND",
    });
  });

  it("Google Sheets belum diaktifkan (adapter ditunda)", async () => {
    const sheet = {
      sourceType: "google_sheets" as const,
      reference: { spreadsheetId: "x", gid: null },
    };
    expect(await source.readRows(sheet, null)).toEqual({ ok: false, error: "NOT_CONFIGURED" });
    expect(await source.readTitle()).toEqual({ ok: false, error: "NOT_CONFIGURED" });
  });
});

describe("pemetaan baris data_sources", () => {
  it.each([
    ["3 days", 72],
    ["72:00:00", 72],
    ["1 day 02:30:00", 26.5],
    ["00:00:00", 0],
  ])("interval %s = %d jam", (text, hours) => {
    expect(intervalHours(text)).toBe(hours);
  });

  const row = {
    id: "s",
    training_id: "t",
    source_type: "google_sheets",
    spreadsheet_id: "sheet-id",
    gid: "0",
    header_aliases: { name: ["nama lengkap"] },
    status_mapping: { selesai: "passed" },
    freshness_threshold: "3 days",
    enabled: true,
    trainings: { start_date: "2026-09-23", end_date: "2026-09-30" },
  };

  it("Google Sheets: referensi sheet dan ID file Drive", () => {
    expect(toDataSource(row)).toMatchObject({
      reference: { spreadsheetId: "sheet-id", gid: "0" },
      driveFileId: "sheet-id",
      trainingPeriod: { start: "2026-09-23", end: "2026-09-30" },
      freshnessThresholdHours: 72,
    });
  });

  it("CSV: tanpa referensi; konfigurasi rusak diabaikan, periode kosong", () => {
    const csv = {
      ...row,
      source_type: "csv",
      spreadsheet_id: null,
      header_aliases: "rusak",
      status_mapping: { x: "bukan-status" },
      trainings: { start_date: null, end_date: null },
    };
    expect(toDataSource(csv)).toMatchObject({
      reference: null,
      driveFileId: null,
      headerAliases: {},
      statusMapping: {},
      trainingPeriod: null,
    });
  });
});
