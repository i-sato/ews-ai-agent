import { describe, expect, it } from "vitest";
import { assessParticipant, type ParticipantSnapshot, type RuleConfig } from "./participant-rules";

const cfg: RuleConfig = {
  notStartedDays: 3,
  notStartedCriticalRemainingDays: 3,
  stagnantDays: 5,
  passPendingDaysBeforeEnd: 7,
  lmsConsistencyTolerancePp: 1,
};

const snap = (over: Partial<ParticipantSnapshot> = {}): ParticipantSnapshot => ({
  completedItems: 14,
  totalItems: 34,
  lmsPercentage: 41.18,
  qualityFlags: [],
  enrollmentStatus: "in_progress",
  inDenominator: false,
  daysSinceLastChange: 1,
  ...over,
});

const clock = { daysSinceStart: 8, daysUntilEnd: 10 };

describe("assessParticipant", () => {
  it("NOT_STARTED waspada, lalu kritis menjelang akhir", () => {
    const s = snap({ completedItems: 0, lmsPercentage: 0 });
    expect(assessParticipant(s, clock, cfg)).toEqual({ status: "warning", rules: ["NOT_STARTED"] });
    expect(assessParticipant(s, { daysSinceStart: 9, daysUntilEnd: 2 }, cfg).status).toBe(
      "critical",
    );
  });

  it("NOT_STARTED belum berlaku pada hari-hari awal", () => {
    const s = snap({ completedItems: 0, lmsPercentage: 0 });
    expect(assessParticipant(s, { daysSinceStart: 1, daysUntilEnd: 10 }, cfg).rules).toEqual([]);
  });

  it("PROGRESS_STAGNANT bila item selesai tidak berubah ≥ N hari", () => {
    const r = assessParticipant(snap({ daysSinceLastChange: 5 }), clock, cfg);
    expect(r).toEqual({ status: "warning", rules: ["PROGRESS_STAGNANT"] });
  });

  it("tanpa snapshot sebelumnya tidak dianggap stagnan", () => {
    expect(assessParticipant(snap({ daysSinceLastChange: null }), clock, cfg).rules).toEqual([]);
  });

  it("PASS_PENDING: sudah masuk penyebut, belum lulus, mendekati akhir", () => {
    const s = snap({ completedItems: 34, lmsPercentage: 100, inDenominator: true });
    expect(assessParticipant(s, { daysSinceStart: 8, daysUntilEnd: 3 }, cfg).rules).toEqual([
      "PASS_PENDING",
    ]);
  });

  it("DATA_INVALID: PERSENTASE LMS tidak konsisten dengan item (contoh baris Pembatalan)", () => {
    const s = snap({ completedItems: 0, lmsPercentage: 100 });
    expect(assessParticipant(s, clock, cfg)).toEqual({
      status: "invalid",
      rules: ["DATA_INVALID"],
    });
  });

  it("DATA_INVALID: galat formula dan persentase di luar rentang", () => {
    expect(assessParticipant(snap({ qualityFlags: ["formula_error"] }), clock, cfg).status).toBe(
      "invalid",
    );
    expect(assessParticipant(snap({ lmsPercentage: 120 }), clock, cfg).status).toBe("invalid");
  });

  it("toleransi 1 poin persentase", () => {
    expect(assessParticipant(snap({ lmsPercentage: 42 }), clock, cfg).status).toBe("normal");
  });

  it("peserta lulus atau batal tidak dinilai risiko", () => {
    expect(assessParticipant(snap({ enrollmentStatus: "passed" }), clock, cfg).rules).toEqual([]);
    expect(
      assessParticipant(
        snap({ enrollmentStatus: "cancelled", lmsPercentage: 100, completedItems: 0 }),
        clock,
        cfg,
      ).status,
    ).toBe("normal");
  });
});
