import { describe, expect, it } from "vitest";
import {
  cekSyncFlag,
  isFormulaError,
  mapEnrollmentStatus,
  mapItemStatus,
  mapOnboarding,
} from "./status-mapping";

describe("pemetaan status", () => {
  it.each([
    ["Lulus Pelatihan - Nilai", "passed"],
    ["  tidak lulus pelatihan -  nilai ", "not_passed"],
    ["Pembatalan", "cancelled"],
    ["Submit", "in_selection"],
    ["Pelatihan", "in_progress"],
    [" pelatihan ", "in_progress"],
    ["Sedang Berjalan", "unmapped"],
  ])("STATUS %s → %s", (raw, expected) => {
    expect(mapEnrollmentStatus(raw)).toBe(expected);
  });

  it("menerima pemetaan dari konfigurasi sumber", () => {
    expect(mapEnrollmentStatus("Kompeten", { kompeten: "passed" })).toBe("passed");
  });

  it("ONBOARDING kosong menjadi null", () => {
    expect([
      mapOnboarding("Onboarding"),
      mapOnboarding("Tidak Onboarding"),
      mapOnboarding(""),
    ]).toEqual([true, false, null]);
  });

  it("status item", () => {
    expect([
      mapItemStatus("Selesai"),
      mapItemStatus("Belum Mengerjakan"),
      mapItemStatus("?"),
    ]).toEqual(["completed", "not_started", "unknown"]);
  });

  it("galat formula dan Cek Sync", () => {
    expect(isFormulaError("#REF!")).toBe(true);
    expect(isFormulaError("0")).toBe(false);
    expect([cekSyncFlag("OK"), cekSyncFlag("Error Sync"), cekSyncFlag("#N/A")]).toEqual([
      "ok",
      "error_sync",
      "formula_error",
    ]);
  });
});
