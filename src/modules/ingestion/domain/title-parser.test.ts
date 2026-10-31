import { describe, expect, it } from "vitest";
import { idMismatch, parsePortalUrl, parseSpreadsheetTitle } from "./title-parser";

const TEAMS = ["GTA", "KDD", "DTA"];

describe("parseSpreadsheetTitle", () => {
  it("judul contoh 1", () => {
    expect(parseSpreadsheetTitle("Mirror DTA VBL 13109 IAWD 23 - 30 Sept", TEAMS)).toEqual({
      teamCode: "DTA",
      portalTrainingId: "13109",
      schemeCode: "IAWD",
      period: { start: { day: 23, month: 9 }, end: { day: 30, month: 9 } },
    });
  });

  it("judul contoh 2 dengan pola tanda hubung berbeda", () => {
    const r = parseSpreadsheetTitle("MIRROR - DTA VBL 13107 OIAT 10 -31 Agustus", TEAMS);
    expect(r.teamCode).toBe("DTA");
    expect(r.portalTrainingId).toBe("13107");
    expect(r.schemeCode).toBe("OIAT");
    expect(r.period).toEqual({ start: { day: 10, month: 8 }, end: { day: 31, month: 8 } });
  });

  it("periode lintas bulan", () => {
    const r = parseSpreadsheetTitle("gta 20001 ABC 28 Sept - 3 Okt", TEAMS);
    expect(r.teamCode).toBe("GTA");
    expect(r.period).toEqual({ start: { day: 28, month: 9 }, end: { day: 3, month: 10 } });
  });

  it("mengembalikan null untuk bagian yang tidak dikenali", () => {
    expect(parseSpreadsheetTitle("Rekap peserta", TEAMS)).toEqual({
      teamCode: null,
      portalTrainingId: null,
      schemeCode: null,
      period: null,
    });
  });
});

describe("parsePortalUrl", () => {
  it.each([
    ["https://digitalent.komdigi.go.id/pelatihan/13109", "13109"],
    ["https://digitalent.komdigi.go.id/pelatihan/13109/", "13109"],
    ["http://digitalent.komdigi.go.id/pelatihan/13109", null],
    ["https://digitalent.komdigi.go.id.evil.test/pelatihan/13109", null],
    ["https://digitalent.komdigi.go.id/akademi/13109", null],
    ["bukan url", null],
  ])("%s → %s", (url, expected) => {
    expect(parsePortalUrl(url)).toBe(expected);
  });

  it("peringatan bila ID judul dan portal berbeda", () => {
    expect(idMismatch("13109", "13107")).toBe(true);
    expect(idMismatch("13109", null)).toBe(false);
  });
});
