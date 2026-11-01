import { describe, expect, it } from "vitest";
import { HOME_PATH, isPublicPath, loginUrlFor, safeNextPath } from "@/lib/auth/paths";

describe("safeNextPath (cegah open redirect)", () => {
  it("mempertahankan path relatif beserta query", () => {
    expect(safeNextPath("/reports?year=2026")).toBe("/reports?year=2026");
    expect(safeNextPath("/trainings/abc")).toBe("/trainings/abc");
  });

  it.each([
    ["URL absolut", "https://contoh.invalid/phish"],
    ["protocol-relative", "//contoh.invalid"],
    ["backslash", "/\\contoh.invalid"],
    ["skema javascript", "javascript:alert(1)"],
    ["path tanpa garis miring", "dashboard"],
    ["kembali ke login", "/login?next=/reports"],
    ["kosong", ""],
  ])("menolak %s", (_, raw) => {
    expect(safeNextPath(raw)).toBe(HOME_PATH);
  });

  it("menolak nilai bukan string", () => {
    expect(safeNextPath(undefined)).toBe(HOME_PATH);
    expect(safeNextPath(["/reports"])).toBe(HOME_PATH);
  });
});

describe("isPublicPath", () => {
  it("hanya login, pernyataan kepatuhan, dan health yang publik", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/compliance")).toBe(true);
    expect(isPublicPath("/api/health")).toBe(true);
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/login-admin")).toBe(false);
  });
});

describe("loginUrlFor", () => {
  it("menyertakan tujuan asal", () => {
    expect(loginUrlFor("/reports", "?year=2026")).toBe("/login?next=%2Freports%3Fyear%3D2026");
  });

  it("tanpa parameter bila tujuan adalah halaman awal", () => {
    expect(loginUrlFor("/dashboard", "")).toBe("/login");
    expect(loginUrlFor("/", "")).toBe("/login");
  });
});
