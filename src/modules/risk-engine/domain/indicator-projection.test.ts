import { describe, expect, it } from "vitest";
import { type RealizationPoint, projectIndicator } from "./indicator-projection";

const period = { start: "2026-01-01", end: "2026-12-31" };
const pt = (date: string, value: number, documentVersion = 1): RealizationPoint => ({
  date,
  value,
  documentVersion,
});

describe("projectIndicator (proyeksi akhir periode)", () => {
  it("kumulatif: tren linear 30 hari diperpanjang ke akhir periode", () => {
    // 72.710 → 74.210 dalam 30 hari = 50/hari; 64 hari tersisa sampai 31 Des.
    const r = projectIndicator([pt("2026-09-28", 72_710), pt("2026-10-28", 74_210)], {
      kind: "cumulative_count",
      period,
      windowDays: 30,
    });
    expect(r).toEqual({
      available: true,
      projectedFinal: 77_410,
      velocityPerDay: 50,
      basis: { from: "2026-09-28", to: "2026-10-28" },
    });
  });

  it("memakai titik terlama di dalam jendela, bukan sebelum jendela", () => {
    const r = projectIndicator(
      [pt("2026-08-01", 60_000), pt("2026-10-08", 73_210), pt("2026-10-28", 74_210)],
      { kind: "cumulative_count", period, windowDays: 30 },
    );
    expect(r.available && r.basis.from).toBe("2026-10-08");
  });

  it("persentase dibatasi 0–100", () => {
    const up = projectIndicator([pt("2026-10-01", 90), pt("2026-10-28", 99)], {
      kind: "percentage",
      period,
      windowDays: 30,
    });
    expect(up.available && up.projectedFinal).toBe(100);
    const down = projectIndicator([pt("2026-10-01", 40), pt("2026-10-28", 10)], {
      kind: "percentage",
      period,
      windowDays: 30,
    });
    expect(down.available && down.projectedFinal).toBe(0);
  });

  it("persentase boleh turun (tren menurun tetap diproyeksikan)", () => {
    const r = projectIndicator([pt("2026-10-18", 98.8), pt("2026-10-28", 97.8)], {
      kind: "percentage",
      period,
      windowDays: 30,
    });
    expect(r.available && r.projectedFinal).toBe(91.4);
  });

  it("kumulatif menurun akibat koreksi sumber → tidak tersedia", () => {
    const r = projectIndicator([pt("2026-10-18", 74_300), pt("2026-10-28", 74_210)], {
      kind: "cumulative_count",
      period,
      windowDays: 30,
    });
    expect(r).toEqual({ available: false, reason: "NEGATIVE_TREND" });
  });

  it("kurang dari dua titik di jendela → tidak tersedia", () => {
    const opts = { kind: "cumulative_count" as const, period, windowDays: 30 };
    expect(projectIndicator([], opts)).toEqual({ available: false, reason: "INSUFFICIENT_DATA" });
    expect(projectIndicator([pt("2026-10-28", 1)], opts).available).toBe(false);
    expect(projectIndicator([pt("2026-08-01", 1), pt("2026-10-28", 2)], opts)).toEqual({
      available: false,
      reason: "INSUFFICIENT_DATA",
    });
  });

  it("titik pada tanggal sama → interval tidak positif", () => {
    const r = projectIndicator([pt("2026-10-28", 1), pt("2026-10-28", 2)], {
      kind: "cumulative_count",
      period,
      windowDays: 30,
    });
    expect(r).toEqual({ available: false, reason: "NON_POSITIVE_INTERVAL" });
  });

  it("perubahan PK pada periode berjalan: titik versi lama tidak dibandingkan", () => {
    const opts = { kind: "cumulative_count" as const, period, windowDays: 30 };
    expect(projectIndicator([pt("2026-10-10", 1, 1), pt("2026-10-28", 2, 2)], opts)).toEqual({
      available: false,
      reason: "DOCUMENT_CHANGED",
    });
    const mixed = [pt("2026-10-05", 1, 1), pt("2026-10-10", 10, 2), pt("2026-10-28", 28, 2)];
    expect(projectIndicator(mixed, opts).available).toBe(true);
  });

  it("titik di luar periode PK diabaikan; urutan masukan tidak berpengaruh", () => {
    const opts = { kind: "cumulative_count" as const, period, windowDays: 30 };
    const a = projectIndicator(
      [pt("2026-10-28", 74_210), pt("2027-01-02", 90_000), pt("2026-09-28", 72_710)],
      opts,
    );
    expect(a.available && a.projectedFinal).toBe(77_410);
  });

  it("jendela belum dikonfigurasi → tidak tersedia", () => {
    const r = projectIndicator([pt("2026-09-28", 1), pt("2026-10-28", 2)], {
      kind: "cumulative_count",
      period,
      windowDays: null,
    });
    expect(r).toEqual({ available: false, reason: "NO_RULE_CONFIG" });
  });
});
