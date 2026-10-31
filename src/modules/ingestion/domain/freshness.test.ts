import { describe, expect, it } from "vitest";
import { assessFreshness } from "./freshness";

const base = {
  fetchedAt: "2026-10-30T10:00:00+07:00",
  contentChangedAt: "2026-10-29T16:20:00+07:00",
  driveModifiedAt: null,
  labelUpdatedAt: "2026-10-13T11:43:00+07:00",
  thresholdHours: 72,
  now: "2026-10-30T10:00:00+07:00",
};

describe("assessFreshness", () => {
  it("isi berubah tetapi label tidak: segar dengan peringatan ringan", () => {
    expect(assessFreshness(base)).toEqual({
      referenceAt: base.contentChangedAt,
      isStale: false,
      labelNotUpdated: true,
    });
  });

  it("memakai yang terbaru antara perubahan isi dan modifiedTime Drive", () => {
    const r = assessFreshness({ ...base, driveModifiedAt: "2026-10-30T08:00:00+07:00" });
    expect(r.referenceAt).toBe("2026-10-30T08:00:00+07:00");
  });

  it("fetchedAt baru tidak membuat data segar", () => {
    const r = assessFreshness({ ...base, contentChangedAt: "2026-10-20T00:00:00+07:00" });
    expect(r.isStale).toBe(true);
  });

  it("tanpa waktu perubahan sama sekali dianggap kedaluwarsa", () => {
    const r = assessFreshness({ ...base, contentChangedAt: null, labelUpdatedAt: null });
    expect(r).toEqual({ referenceAt: null, isStale: true, labelNotUpdated: false });
  });
});
