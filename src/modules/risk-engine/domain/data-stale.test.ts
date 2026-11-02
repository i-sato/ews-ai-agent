import { describe, expect, it } from "vitest";
import { type StaleInput, assessDataStale } from "./data-stale";

const base: StaleInput = {
  period: { startDate: "2026-10-21", endDate: "2026-10-31" },
  today: "2026-10-28",
  now: "2026-10-28T03:00:00Z",
  source: {
    fetchedAt: "2026-10-28T02:00:00Z",
    contentChangedAt: "2026-10-27T09:00:00Z",
    driveModifiedAt: null,
    labelUpdatedAt: null,
  },
};
const input = (over: Partial<StaleInput> = {}): StaleInput => ({ ...base, ...over });
const source = (over: Partial<NonNullable<StaleInput["source"]>>) => ({ ...base.source!, ...over });

describe("assessDataStale (§8.2, §3.5)", () => {
  it("isi berubah dalam batas kesegaran → tidak terpicu", () => {
    expect(assessDataStale(input(), 72)).toMatchObject({
      outcome: "clear",
      referenceAt: "2026-10-27T09:00:00Z",
      ageHours: 18,
    });
  });

  it("isi tidak berubah melewati batas selama periode pelatihan → terpicu", () => {
    const r = assessDataStale(
      input({ source: source({ contentChangedAt: "2026-10-24T00:00:00Z" }) }),
      72,
    );
    expect(r).toMatchObject({ outcome: "triggered", ageHours: 99 });
  });

  it("fetched_at baru bukan bukti data baru", () => {
    const stale = source({
      contentChangedAt: "2026-10-20T00:00:00Z",
      fetchedAt: "2026-10-28T02:59:00Z",
    });
    expect(assessDataStale(input({ source: stale }), 72).outcome).toBe("triggered");
  });

  it("modifiedTime Drive yang lebih baru menjadi acuan", () => {
    const s = source({
      contentChangedAt: "2026-10-20T00:00:00Z",
      driveModifiedAt: "2026-10-28T01:00:00Z",
    });
    expect(assessDataStale(input({ source: s }), 72)).toMatchObject({
      outcome: "clear",
      referenceAt: "2026-10-28T01:00:00Z",
    });
  });

  it("label UPDATE TERAKHIR tidak dipakai sebagai acuan", () => {
    const s = source({
      contentChangedAt: "2026-10-20T00:00:00Z",
      labelUpdatedAt: "2026-10-28T00:00:00Z",
    });
    expect(assessDataStale(input({ source: s }), 72).outcome).toBe("triggered");
  });

  it("tanpa data sama sekali selama periode → terpicu (data tidak memadai)", () => {
    expect(assessDataStale(input({ source: null }), 72)).toMatchObject({
      outcome: "triggered",
      reason: "NO_DATA",
      referenceAt: null,
      ageHours: null,
    });
  });

  it("di luar periode pelatihan → tidak berlaku", () => {
    const old = source({ contentChangedAt: "2026-09-01T00:00:00Z" });
    expect(assessDataStale(input({ today: "2026-10-20", source: old }), 72).outcome).toBe(
      "not_applicable",
    );
    expect(assessDataStale(input({ today: "2026-11-01", source: old }), 72).outcome).toBe(
      "not_applicable",
    );
  });

  it("hari pertama dan terakhir pelatihan termasuk periode (tanggal WIB)", () => {
    const old = source({ contentChangedAt: "2026-09-01T00:00:00Z" });
    expect(assessDataStale(input({ today: "2026-10-21", source: old }), 72).outcome).toBe(
      "triggered",
    );
    expect(assessDataStale(input({ today: "2026-10-31", source: old }), 72).outcome).toBe(
      "triggered",
    );
  });

  it("jadwal pelatihan belum diisi → tidak dapat dinilai", () => {
    const period = { startDate: null, endDate: "2026-10-31" };
    expect(assessDataStale(input({ period }), 72)).toMatchObject({
      outcome: "not_assessable",
      reason: "NO_TRAINING_PERIOD",
    });
  });

  it("ambang belum dikonfigurasi → tidak dapat dinilai", () => {
    expect(assessDataStale(input(), null)).toMatchObject({
      outcome: "not_assessable",
      reason: "NO_RULE_CONFIG",
    });
  });
});
