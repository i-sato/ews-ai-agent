// F2-05: golden dataset sintetis meniru struktur dua sheet contoh (spesifikasi §3.2.3).
// Angka acuan di *.expected.json berasal dari tabel §3.2.3, lalu dicocokkan dengan isi CSV
// melalui parser domain yang sudah ada.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { detectLayout } from "@/modules/ingestion/domain/sheet-layout";
import {
  cekSyncFlag,
  mapEnrollmentStatus,
  mapOnboarding,
  mapItemStatus,
} from "@/modules/ingestion/domain/status-mapping";
import { columnLetter } from "@/modules/ingestion/domain/text";
import { parseSpreadsheetTitle } from "@/modules/ingestion/domain/title-parser";
import { parseUpdateLabel } from "@/modules/ingestion/domain/update-label";
import {
  GOLDEN_SHEETS,
  type GoldenExpected,
  SHEETS_DIR,
  TEAM_CODES,
  goldenFiles,
} from "../fixtures/golden/golden-sheets";
import { parseCsv } from "../support/csv";

const read = (name: string) => readFileSync(`${SHEETS_DIR}${name}`, "utf8");

describe("file golden sesuai generator", () => {
  it.each(Object.entries(goldenFiles()))("%s tidak bergeser", (name, content) => {
    expect(read(name)).toBe(content);
  });

  it("tanpa pola NO REGISTRASI riil (12 digit-1/2 digit) di seluruh fixture", () => {
    for (const name of readdirSync(SHEETS_DIR)) expect(read(name)).not.toMatch(/\d{12}-\d{1,2}/);
  });
});

describe.each(GOLDEN_SHEETS)("$key", (sheet) => {
  const rows = parseCsv(read(`${sheet.key}.csv`));
  const expected = JSON.parse(read(`${sheet.key}.expected.json`)) as GoldenExpected;
  const [meta = [], headers = [], ...data] = rows;
  const layout = detectLayout(headers);
  if (!layout.ok) throw new Error(`layout gagal: ${layout.error.code}`);
  const { identity, items } = layout.layout;
  const cell = (row: string[], index: number) => row[index] ?? "";
  const participants = data.filter((r) => cell(r, identity.participantNumber).trim() !== "");
  const ignored = data.filter((r) => cell(r, identity.participantNumber).trim() === "");
  const completed = (r: string[]) =>
    items.filter((it) => mapItemStatus(cell(r, it.columnIndex)) === "completed").length;
  const statusOf = (r: string[]) => mapEnrollmentStatus(cell(r, identity.status));

  it("expected.json sama dengan definisi generator", () => {
    expect(expected).toMatchObject(sheet.expected);
  });

  it("baris 1 metadata, baris 2 header, setiap baris selebar header", () => {
    expect(cell(meta, 0)).toBe(sheet.updateLabel);
    expect(headers.slice(0, 9)).toContain("NO REGISTRASI");
    for (const r of rows) expect(r).toHaveLength(headers.length);
  });

  it("rentang item, slot kosong, dan Cek Sync terdeteksi", () => {
    expect(items).toHaveLength(expected.items);
    expect(layout.layout.emptySlots).toBe(expected.emptySlots);
    expect(layout.layout.range).toEqual({
      from: expected.itemRange.from,
      to: expected.itemRange.to,
    });
    expect(columnLetter(layout.layout.cekSyncIndex)).toBe(expected.itemRange.cekSync);
    expect(layout.layout.trailingColumns).toBe(0);
  });

  it("jenis item, judul ganda, entitas HTML, dan panjang judul", () => {
    const types = { overview: 0, material: 0, video: 0, quiz: 0, final_assessment: 0 };
    for (const it of items) types[it.type]++;
    expect(types).toEqual(expected.itemTypes);
    const duplicates = items
      .filter((it) => it.duplicateTitle)
      .map((it) => columnLetter(it.columnIndex));
    expect(duplicates).toEqual(expected.duplicateTitleColumns);
    const encoded = items.filter((it) => /&AMP;/.test(it.sourceTitle));
    expect(encoded).toHaveLength(expected.entityTitles);
    for (const it of encoded) expect(it.title).not.toContain("&AMP;");
    const lengths = items.map((it) => it.title.length);
    expect({ min: Math.min(...lengths), max: Math.max(...lengths) }).toEqual(expected.titleLength);
  });

  it("baris tanpa identitas hanya berisi nilai bawaan formula", () => {
    expect(ignored).toHaveLength(expected.ignoredRows);
    for (const r of ignored) {
      expect(cell(r, identity.name)).toBe("");
      expect(cell(r, identity.lmsPercentage)).toBe("0");
      expect(completed(r)).toBe(0);
      expect(cekSyncFlag(cell(r, layout.layout.cekSyncIndex))).toBe("ok");
    }
  });

  it("jumlah peserta per status", () => {
    expect(participants).toHaveLength(expected.participants);
    const status = {
      passed: 0,
      not_passed: 0,
      cancelled: 0,
      in_progress: 0,
      in_selection: 0,
      unmapped: 0,
    };
    for (const r of participants) status[statusOf(r)]++;
    // Kedua sheet contoh berasal dari kelas yang sudah selesai: tanpa Submit/Pelatihan.
    expect(status).toEqual({ ...expected.status, in_progress: 0, in_selection: 0 });
  });

  it("peserta tidak lulus: belum mulai vs berhenti di item tertentu", () => {
    const notPassed = participants.filter((r) => statusOf(r) === "not_passed");
    const stopped = notPassed.filter((r) => completed(r) > 0);
    expect(notPassed.length - stopped.length).toBe(expected.notPassed.notStarted);
    expect(stopped).toHaveLength(expected.notPassed.stoppedMidway);
    expect(stopped.map((r) => completed(r) + 1)).toEqual(expected.notPassed.stopAtItems);
  });

  it("urutan penyelesaian item berurutan", () => {
    for (const r of participants) {
      const done = items.map((it) => mapItemStatus(cell(r, it.columnIndex)) === "completed");
      expect(done.indexOf(false) === -1 || !done.slice(done.indexOf(false)).includes(true)).toBe(
        true,
      );
    }
  });

  it("onboarding: lulus Onboarding, tidak lulus Tidak Onboarding, batal kosong", () => {
    for (const r of participants) {
      const onboarding = mapOnboarding(cell(r, identity.onboarding));
      const expectedOnboarding = { passed: true, not_passed: false, cancelled: null }[
        statusOf(r) as "passed" | "not_passed" | "cancelled"
      ];
      expect(onboarding).toBe(expectedOnboarding);
    }
  });

  it("PERSENTASE LMS cocok dengan rasio item kecuali konflik yang disengaja", () => {
    const conflicts = participants.filter((r) => {
      const lms = Number(cell(r, identity.lmsPercentage));
      return Math.abs(lms - (completed(r) / items.length) * 100) > 1;
    });
    expect(conflicts).toHaveLength(expected.lmsConflicts);
  });

  it("bendera Cek Sync", () => {
    const flags = participants.map((r) => cekSyncFlag(cell(r, layout.layout.cekSyncIndex)));
    expect(flags.filter((f) => f === "formula_error")).toHaveLength(expected.cekSync.formulaError);
    expect(flags.filter((f) => f === "error_sync")).toHaveLength(expected.cekSync.errorSync);
  });

  it("baris 1: total dan jumlah selesai per item cocok dengan hitung ulang", () => {
    const total = (label: string) => Number(cell(meta, meta.indexOf(label) + 1));
    const nonCancelled = participants.filter((r) => statusOf(r) !== "cancelled");
    expect(total("TOTAL PENDAFTAR")).toBe(nonCancelled.length);
    expect(total("TOTAL ONBOARDING")).toBe(
      participants.filter((r) => mapOnboarding(cell(r, identity.onboarding)) === true).length,
    );
    expect(total("TOTAL SELESAI")).toBe(
      participants.filter((r) => statusOf(r) === "passed").length,
    );
    for (const it of items) {
      const count = participants.filter(
        (r) => mapItemStatus(cell(r, it.columnIndex)) === "completed",
      ).length;
      expect(Number(cell(meta, it.columnIndex))).toBe(count);
    }
  });

  it("judul spreadsheet dan UPDATE TERAKHIR terurai", () => {
    const proposal = parseSpreadsheetTitle(sheet.spreadsheetTitle, TEAM_CODES);
    expect(proposal).toMatchObject(expected.titleProposal);
    expect(proposal.period).not.toBeNull();
    const { day, month, time } = expected.updateLabel;
    const parsed = parseUpdateLabel(cell(meta, 0), { start: "2026-01-01", end: "2026-12-31" });
    const iso = `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    expect(parsed).toEqual({
      ok: true,
      sourceUpdatedAt: `${iso}T${time}:00+07:00`,
      yearUncertain: false,
    });
  });

  it("data peserta fiktif", () => {
    for (const r of participants) {
      expect(cell(r, identity.name)).toMatch(/^Peserta Sintetis \d-\d{3}$/);
      expect(cell(r, identity.participantNumber)).toMatch(/^SINT\d-\d{3}$/);
    }
  });
});
