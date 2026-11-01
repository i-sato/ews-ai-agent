import { describe, expect, it } from "vitest";
import {
  MAIN_MENU,
  MOBILE_TABS,
  MORE_HREF,
  MORE_MENU,
  isActivePath,
} from "@/components/navigation/menu";

describe("menu utama (docs/design)", () => {
  it("berisi tepat tujuh menu sesuai urutan desain web", () => {
    expect(MAIN_MENU.map((m) => m.label)).toEqual([
      "Dashboard",
      "Pelatihan",
      "Peserta",
      "Pemantauan Risiko",
      "Indikator PK",
      "Laporan",
      "Pengaturan",
    ]);
  });

  it("memakai rute sesuai docs/design/README.md", () => {
    expect(MAIN_MENU.map((m) => m.href)).toEqual([
      "/dashboard",
      "/trainings",
      "/participants",
      "/risk-monitoring",
      "/pk-indicators",
      "/reports",
      "/settings",
    ]);
  });

  it("tab bawah mobile sesuai M-Dashboard.dc.html", () => {
    expect(MOBILE_TABS.map((t) => [t.label, t.href])).toEqual([
      ["Dashboard", "/dashboard"],
      ["Pelatihan", "/trainings"],
      ["Risiko", "/risk-monitoring"],
      ["Laporan", "/reports"],
      ["Lainnya", MORE_HREF],
    ]);
  });

  it("layar Lainnya berisi menu sisanya sesuai M-Lainnya.dc.html", () => {
    expect(MORE_MENU.map((m) => m.label)).toEqual(["Peserta", "Indikator PK", "Pengaturan"]);
  });

  it("setiap menu web terjangkau dari mobile", () => {
    const reachable = MOBILE_TABS.flatMap((t) => t.matches);
    for (const m of MAIN_MENU) expect(reachable).toContain(m.href);
  });
});

describe("isActivePath", () => {
  it("aktif untuk rute itu sendiri dan turunannya", () => {
    expect(isActivePath("/trainings", "/trainings")).toBe(true);
    expect(isActivePath("/trainings/abc/import", "/trainings")).toBe(true);
  });

  it("tidak aktif untuk rute lain yang berawalan sama", () => {
    expect(isActivePath("/reports-archive", "/reports")).toBe(false);
    expect(isActivePath("/dashboard", "/trainings")).toBe(false);
  });
});
