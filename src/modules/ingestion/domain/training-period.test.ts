import { describe, expect, it } from "vitest";
import { dayOfTraining, formatDateRange, scheduleState, trainingPhase } from "./training-period";

describe("trainingPhase", () => {
  const period = { startDate: "2026-10-21", endDate: "2026-10-31" };

  it.each([
    ["2026-10-20", "planned"],
    ["2026-10-21", "in_progress"],
    ["2026-10-31", "in_progress"],
    ["2026-11-01", "completed"],
  ] as const)("%s → %s", (today, phase) => {
    expect(trainingPhase({ ...period, cancelled: false }, today)).toBe(phase);
  });

  it("dibatalkan dan tanpa tanggal", () => {
    expect(trainingPhase({ ...period, cancelled: true }, "2026-10-25")).toBe("cancelled");
    expect(trainingPhase({ startDate: null, endDate: null, cancelled: false }, "2026-10-25")).toBe(
      "planned",
    );
  });
});

describe("dayOfTraining", () => {
  it("hari ke-n dari total hari pelaksanaan", () => {
    expect(dayOfTraining("2026-10-21", "2026-10-31", "2026-10-28")).toEqual({ day: 8, total: 11 });
  });

  it("di luar periode tidak ada", () => {
    expect(dayOfTraining("2026-10-21", "2026-10-31", "2026-11-01")).toBeNull();
    expect(dayOfTraining(null, "2026-10-31", "2026-10-25")).toBeNull();
  });
});

describe("formatDateRange", () => {
  it.each([
    ["2026-10-21", "2026-10-31", "21–31 Okt 2026"],
    ["2026-09-28", "2026-10-05", "28 Sep–5 Okt 2026"],
    ["2026-12-28", "2027-01-05", "28 Des 2026–5 Jan 2027"],
    ["2026-10-21", "2026-10-21", "21 Okt 2026"],
  ])("%s s.d. %s", (start, end, text) => {
    expect(formatDateRange(start, end)).toBe(text);
  });

  it("tanpa tanggal", () => {
    expect(formatDateRange(null, "2026-10-31")).toBeNull();
  });
});

describe("scheduleState", () => {
  it("terverifikasi, perlu verifikasi, atau tautan belum ada", () => {
    expect(scheduleState({ portalUrl: "x", verifiedAt: "2026-10-20T00:00:00Z" })).toBe("verified");
    expect(scheduleState({ portalUrl: "x", verifiedAt: null })).toBe("needs_verification");
    expect(scheduleState({ portalUrl: null, verifiedAt: null })).toBe("no_link");
  });
});
