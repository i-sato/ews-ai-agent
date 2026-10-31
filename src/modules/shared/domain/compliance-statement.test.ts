import { describe, expect, it } from "vitest";
import { COMPLIANCE_STATEMENT, formatIndonesianDate } from "./compliance-statement";

describe("COMPLIANCE_STATEMENT (§11.3)", () => {
  it("berversi dengan tanggal berlaku ISO", () => {
    expect(COMPLIANCE_STATEMENT.version).toMatch(/^\d+\.\d+$/);
    expect(COMPLIANCE_STATEMENT.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("masih draf sampai ditinjau fungsi hukum", () => {
    expect(COMPLIANCE_STATEMENT.status).toBe("draft");
  });

  it.each([
    "UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi",
    "PP No. 71 Tahun 2019",
    "Perpres No. 95 Tahun 2018 tentang Sistem Pemerintahan Berbasis Elektronik",
    "Perpres No. 39 Tahun 2019 tentang Satu Data Indonesia",
    "tidak dikirim ke penyedia AI dalam bentuk yang mengidentifikasi peserta",
    "keputusan tetap berada pada petugas yang berwenang",
  ])("memuat: %s", (phrase) => {
    expect(COMPLIANCE_STATEMENT.text).toContain(phrase);
  });

  it("tanpa spasi ganda dari penyambungan string", () => {
    expect(COMPLIANCE_STATEMENT.text).not.toMatch(/\s{2,}/);
  });
});

describe("formatIndonesianDate", () => {
  it("format tanggal Indonesia", () => {
    expect(formatIndonesianDate("2026-10-31")).toBe("31 Oktober 2026");
    expect(formatIndonesianDate("2026-01-05")).toBe("5 Januari 2026");
  });

  it("menolak format lain", () => {
    expect(() => formatIndonesianDate("31-10-2026")).toThrow(RangeError);
    expect(() => formatIndonesianDate("2026-13-01")).toThrow(RangeError);
  });
});
