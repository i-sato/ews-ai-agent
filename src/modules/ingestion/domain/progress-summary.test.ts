import { describe, expect, it } from "vitest";
import {
  type ProgressRow,
  type SummaryItem,
  categoryOf,
  stopPoint,
  summarizeProgress,
} from "./progress-summary";

const ITEMS: SummaryItem[] = [1, 2, 3, 4].map((sequence) => ({
  sequence,
  code: `M0${sequence}`,
  name: `ITEM ${sequence}`,
  type: sequence === 3 ? "quiz" : "material",
}));

function row(done: number, over: Partial<ProgressRow> = {}): ProgressRow {
  return {
    enrollmentStatus: "in_progress",
    onboardingStatus: done > 0,
    completionPercentage: (done / 4) * 100,
    qualityFlags: [],
    statuses: ITEMS.map((_, i) => (i < done ? "completed" : "not_started")),
    ...over,
  };
}

describe("categoryOf (§8.6)", () => {
  it("belum mulai, sebagian, tuntas", () => {
    expect([categoryOf(row(0)), categoryOf(row(2)), categoryOf(row(4))]).toEqual([
      "not_started",
      "partial",
      "completed",
    ]);
  });

  it("bendera DATA_INVALID menjadi perlu dicek", () => {
    for (const flag of ["formula_error", "lms_mismatch", "lms_invalid"]) {
      expect(categoryOf(row(4, { qualityFlags: [flag] }))).toBe("check");
    }
    expect(categoryOf(row(4, { qualityFlags: ["error_sync"] }))).toBe("completed");
  });
});

describe("stopPoint", () => {
  it("item pertama yang belum selesai untuk peserta sebagian", () => {
    expect(stopPoint(row(2).statuses)).toEqual({ index: 2, skipped: 0 });
  });

  it("item yang dilewati dihitung", () => {
    const statuses = ["completed", "not_started", "completed", "completed"] as const;
    expect(stopPoint([...statuses])).toEqual({ index: 1, skipped: 2 });
  });

  it("tanpa titik berhenti bila belum mulai atau tuntas", () => {
    expect(stopPoint(row(0).statuses)).toBeNull();
    expect(stopPoint(row(4).statuses)).toBeNull();
  });
});

describe("summarizeProgress", () => {
  const rows: ProgressRow[] = [
    row(4, { enrollmentStatus: "passed" }),
    row(4, { enrollmentStatus: "passed", qualityFlags: ["formula_error"] }),
    row(2, { enrollmentStatus: "not_passed" }),
    row(2),
    row(1),
    row(0, { onboardingStatus: false }),
    row(0, { enrollmentStatus: "in_selection", onboardingStatus: null }),
    row(0, { enrollmentStatus: "cancelled", onboardingStatus: null, completionPercentage: 100 }),
  ];
  const summary = summarizeProgress(rows, ITEMS);

  it("funnel: pendaftar tanpa batal, diterima tanpa seleksi", () => {
    expect(summary.funnel).toEqual({
      registered: 7,
      accepted: 6,
      onboarded: 5,
      started: 5,
      completedAll: 2,
      passed: 2,
    });
  });

  it("kategori dan penyebut tanpa peserta perlu dicek, seleksi, dan batal", () => {
    expect(summary.categories).toEqual({ not_started: 1, partial: 3, completed: 1, check: 1 });
    expect(summary.denominator).toBe(5);
  });

  it("selesai, belum selesai, dan berhenti per item", () => {
    expect(summary.items.map((i) => [i.code, i.done, i.notDone, i.stopHere])).toEqual([
      ["M01", 4, 1, 0],
      ["M02", 3, 2, 1],
      ["M03", 1, 4, 2],
      ["M04", 1, 4, 0],
    ]);
  });

  it("titik berhenti terbanyak dan rata-rata LMS penyebut", () => {
    expect(summary.topStops).toEqual([
      { code: "M03", name: "ITEM 3", type: "quiz", count: 2 },
      { code: "M02", name: "ITEM 2", type: "material", count: 1 },
    ]);
    expect(summary.otherStops).toEqual({ participants: 0, items: 0 });
    expect(summary.averageLms).toBe(45);
  });

  it("tanpa data", () => {
    const empty = summarizeProgress([], ITEMS);
    expect(empty.averageLms).toBeNull();
    expect(empty.topStops).toEqual([]);
    expect(empty.denominator).toBe(0);
  });
});
