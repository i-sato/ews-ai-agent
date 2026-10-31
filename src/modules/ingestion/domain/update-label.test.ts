import { describe, expect, it } from "vitest";
import { parseUpdateLabel } from "./update-label";

describe("parseUpdateLabel", () => {
  const period2026 = { start: "2026-09-23", end: "2026-09-30" };

  it("mengambil tahun dari periode pelatihan (WIB)", () => {
    expect(parseUpdateLabel("UPDATE TERAKHIR: 13 OKTOBER 11:43 WIB", period2026)).toEqual({
      ok: true,
      sourceUpdatedAt: "2026-10-13T11:43:00+07:00",
      yearUncertain: false,
    });
  });

  it("periode lintas tahun ditandai tidak pasti", () => {
    const r = parseUpdateLabel("UPDATE TERAKHIR: 2 JANUARI 09.05 WIB", {
      start: "2026-12-20",
      end: "2027-01-10",
    });
    expect(r).toEqual({
      ok: true,
      sourceUpdatedAt: "2027-01-02T09:05:00+07:00",
      yearUncertain: true,
    });
  });

  it("tanpa periode terkonfigurasi tidak menebak tahun", () => {
    expect(parseUpdateLabel("UPDATE TERAKHIR: 2 SEPTEMBER 11:00 WIB", null)).toEqual({
      ok: false,
      reason: "YEAR_UNKNOWN",
    });
  });

  it("label tidak dikenali", () => {
    expect(parseUpdateLabel("TOTAL PENDAFTAR 50", period2026)).toEqual({
      ok: false,
      reason: "UNPARSEABLE",
    });
  });
});
