import { describe, expect, it } from "vitest";
import {
  achievementRate,
  assessIndicator,
  cumulativeRealization,
  gap,
  percentageRealization,
} from "./indicator";

describe("indikator persentase (IKSK 1.1, 2.1, 3.1)", () => {
  it("sheet contoh DTA: 33/33 dan 45/45 → 100%", () => {
    expect(percentageRealization(33, 33)).toBe(100);
    expect(percentageRealization(45, 45)).toBe(100);
  });

  it("contoh desain: 125 lulus ÷ 132 peserta ≥ 90% → 94,7%; capaian 108,9% dari 87%", () => {
    const p = percentageRealization(125, 132);
    expect(p).toBe(94.7);
    expect(achievementRate(p as number, 87)).toBe(108.9);
  });

  it("penyebut nol tidak dapat dinilai", () => {
    expect(percentageRealization(0, 0)).toBeNull();
  });

  it("lulus melebihi penyebut ditolak", () => {
    expect(() => percentageRealization(5, 4)).toThrow(RangeError);
  });
});

describe("indikator jumlah kumulatif (IKSK 3.2)", () => {
  it("baseline 2025 + peserta 2026", () => {
    expect(cumulativeRealization(54_969, 19_241)).toBe(74_210);
  });

  it("gap terhadap target antara Oktober", () => {
    expect(gap(74_210, 75_969)).toBe(-1_759);
  });

  it("nilai negatif ditolak", () => {
    expect(() => cumulativeRealization(-1, 0)).toThrow(RangeError);
  });
});

describe("achievementRate", () => {
  it.each([
    [10, 0],
    [10, -5],
    [10, null],
  ])("target %s/%s tidak valid → null", (r, t) => {
    expect(achievementRate(r, t)).toBeNull();
  });

  it("realisasi nol dan melampaui target", () => {
    expect(achievementRate(0, 200)).toBe(0);
    expect(achievementRate(250, 200)).toBe(125);
  });
});

describe("assessIndicator", () => {
  it("IKSK 3.2: di bawah target antara dan proyeksi di bawah target → kritis", () => {
    expect(
      assessIndicator({
        realization: 74_210,
        plannedTarget: 75_969,
        finalTarget: 78_319,
        projectedFinal: 77_400,
      }),
    ).toEqual({
      status: "critical",
      triggeredRules: ["TARGET_GAP", "TARGET_UNLIKELY"],
      gap: -1_759,
      achievementRate: 94.8,
    });
  });

  it("IKSK 2.1: hanya di bawah target antara → waspada", () => {
    const r = assessIndicator({
      realization: 97.8,
      plannedTarget: 99,
      finalTarget: 99,
      projectedFinal: 99.2,
    });
    expect(r.status).toBe("warning");
    expect(r.triggeredRules).toEqual(["TARGET_GAP"]);
  });

  it("di atas target antara → normal", () => {
    const r = assessIndicator({
      realization: 94.7,
      plannedTarget: 87,
      finalTarget: 87,
      projectedFinal: 94,
    });
    expect(r.status).toBe("normal");
  });

  it("tanpa realisasi → tidak dapat dinilai", () => {
    const r = assessIndicator({
      realization: null,
      plannedTarget: 87,
      finalTarget: 87,
      projectedFinal: null,
    });
    expect(r.status).toBe("not_assessable");
  });

  it("deterministik untuk input yang sama", () => {
    const input = { realization: 50, plannedTarget: 60, finalTarget: 80, projectedFinal: 70 };
    expect(assessIndicator(input)).toEqual(assessIndicator(input));
  });
});
