import { describe, expect, it } from "vitest";
import { projectParticipant } from "./projection";

const p = (percentage: number, capturedAt: string, catalogVersion = 1) => ({
  percentage,
  capturedAt,
  catalogVersion,
});

describe("projectParticipant", () => {
  it("laju linear dan sisa hari", () => {
    expect(
      projectParticipant(p(20, "2026-10-01T00:00:00Z"), p(40, "2026-10-05T00:00:00Z")),
    ).toEqual({
      available: true,
      velocityPerDay: 5,
      remainingDays: 12,
    });
  });

  it("stagnan atau menurun: sisa hari tidak tersedia", () => {
    const r = projectParticipant(p(40, "2026-10-01T00:00:00Z"), p(35, "2026-10-03T00:00:00Z"));
    expect(r).toMatchObject({ available: true, remainingDays: null });
  });

  it("sudah 100%", () => {
    const r = projectParticipant(p(90, "2026-10-01T00:00:00Z"), p(100, "2026-10-02T00:00:00Z"));
    expect(r).toMatchObject({ remainingDays: 0 });
  });

  it("versi katalog berbeda tidak dapat dibandingkan", () => {
    const r = projectParticipant(
      p(20, "2026-10-01T00:00:00Z", 1),
      p(40, "2026-10-05T00:00:00Z", 2),
    );
    expect(r).toEqual({ available: false, reason: "CATALOG_CHANGED" });
  });

  it("interval nol atau negatif", () => {
    const r = projectParticipant(p(20, "2026-10-05T00:00:00Z"), p(40, "2026-10-05T00:00:00Z"));
    expect(r).toEqual({ available: false, reason: "NON_POSITIVE_INTERVAL" });
  });
});
