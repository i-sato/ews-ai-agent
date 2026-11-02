import { describe, expect, it } from "vitest";
import { plannedTargetFor } from "./indicator-targets";

const period = { start: "2026-01-01", end: "2026-12-31" };
const iksk11 = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, value: i + 1 <= 4 ? 0 : 87 }));
const iksk32 = [
  { month: 10, value: 75_969 },
  { month: 11, value: 78_319 },
  { month: 12, value: 78_319 },
];

describe("plannedTargetFor (target antara bulanan, §8.7)", () => {
  it("memakai bulan berjalan menurut tanggal WIB", () => {
    expect(plannedTargetFor(iksk11, "2026-04-30", period)).toBe(0);
    expect(plannedTargetFor(iksk11, "2026-05-01", period)).toBe(87);
    expect(plannedTargetFor(iksk32, "2026-10-28", period)).toBe(75_969);
  });

  it("bulan tanpa target antara → null (tidak dapat dinilai)", () => {
    expect(plannedTargetFor(iksk32, "2026-09-15", period)).toBeNull();
  });

  it("nilai target kosong atau negatif → null", () => {
    expect(plannedTargetFor([{ month: 10, value: null }], "2026-10-28", period)).toBeNull();
    expect(plannedTargetFor([{ month: 10, value: -1 }], "2026-10-28", period)).toBeNull();
  });

  it("di luar periode PK → null, termasuk pergantian tahun", () => {
    expect(plannedTargetFor(iksk11, "2027-01-01", period)).toBeNull();
    expect(plannedTargetFor(iksk11, "2025-12-31", period)).toBeNull();
  });
});
