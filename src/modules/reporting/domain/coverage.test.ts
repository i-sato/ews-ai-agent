import { describe, expect, it } from "vitest";
import { aggregateRate, buildCoverage, reportPeriod, type TrainingForCoverage } from "./coverage";

type Dates = [startDate: string | null, endDate: string | null];

const t = (id: string, [startDate, endDate]: Dates, over = {}): TrainingForCoverage => ({
  id,
  startDate,
  endDate,
  cancelled: false,
  hasValidSnapshot: true,
  allEnrollmentStatusesFilled: true,
  ...over,
});

describe("reportPeriod", () => {
  it("bulanan memakai nama bulan Indonesia", () => {
    expect(reportPeriod("monthly", 2026, 10)).toEqual({
      scope: "monthly",
      start: "2026-10-01",
      end: "2026-10-31",
      label: "Oktober TA. 2026",
    });
  });

  it("Februari tahun kabisat dan tahunan", () => {
    expect(reportPeriod("monthly", 2028, 2).end).toBe("2028-02-29");
    expect(reportPeriod("annual", 2026)).toMatchObject({ start: "2026-01-01", end: "2026-12-31" });
  });

  it("bulan tidak valid", () => {
    expect(() => reportPeriod("monthly", 2026, 13)).toThrow(RangeError);
  });
});

describe("buildCoverage bulanan", () => {
  const period = reportPeriod("monthly", 2026, 10);
  const trainings = [
    t("selesai", ["2026-10-01", "2026-10-10"]),
    t("berjalan", ["2026-10-20", "2026-11-05"]),
    t("lintas-bulan", ["2026-09-23", "2026-10-02"], { allEnrollmentStatusesFilled: false }),
    t("bulan-lain", ["2026-08-10", "2026-08-31"]),
    t("direncanakan", ["2026-10-30", "2026-11-20"]),
    t("batal", ["2026-10-05", "2026-10-15"], { cancelled: true }),
    t("tanpa-jadwal", [null, null]),
  ];

  it("mencakup semua pelatihan yang beririsan, termasuk yang tidak dihitung", () => {
    const c = buildCoverage(trainings, period, "2026-10-28");
    expect(c).toMatchObject({ cutoff: "2026-10-28", provisional: true });
    expect(c.entries.map((e) => [e.trainingId, e.statusAtCutoff, e.countsTowardTotals])).toEqual([
      ["selesai", "completed", true],
      ["berjalan", "in_progress", true],
      ["lintas-bulan", "completed", true],
      ["direncanakan", "planned", false],
      ["batal", "cancelled", false],
    ]);
  });

  it("menandai pelatihan berjalan sebagai sementara dan menunggu status kelulusan", () => {
    const c = buildCoverage(trainings, period, "2026-10-28");
    expect(c.entries.find((e) => e.trainingId === "berjalan")?.provisional).toBe(true);
    expect(c.entries.find((e) => e.trainingId === "lintas-bulan")?.notes).toEqual([
      "AWAITING_PASS_STATUS",
    ]);
  });

  it("pelatihan tanpa snapshot valid tetap tercantum dengan catatan", () => {
    const c = buildCoverage(
      [t("x", ["2026-10-01", "2026-10-09"], { hasValidSnapshot: false })],
      period,
      "2026-11-02",
    );
    expect(c.provisional).toBe(false);
    expect(c.entries[0]?.notes).toEqual(["NO_VALID_SNAPSHOT"]);
  });
});

describe("aggregateRate", () => {
  it("dihitung dari jumlah, bukan rata-rata persentase", () => {
    // Rata-rata persentase (100% dan 50%) = 75%; dari jumlah = 11/12 = 91,7%.
    expect(
      aggregateRate([
        { numerator: 10, denominator: 10 },
        { numerator: 1, denominator: 2 },
      ]),
    ).toBe(91.7);
    expect(aggregateRate([])).toBeNull();
  });
});
