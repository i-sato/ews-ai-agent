import { describe, expect, it } from "vitest";
import { authErrorBody } from "@/lib/auth/api-errors";
import { ROLES, ROLE_LABELS, hasRole, isCrossTeam, isRole } from "@/lib/auth/roles";

describe("roles", () => {
  it("sama dengan check constraint profiles.role", () => {
    expect(ROLES).toEqual(["admin", "pk_manager", "training_manager", "viewer"]);
  });

  it("setiap role punya label Indonesia", () => {
    for (const role of ROLES) expect(ROLE_LABELS[role]).toBeTruthy();
  });

  it("isRole menolak nilai di luar daftar", () => {
    expect(isRole("admin")).toBe(true);
    expect(isRole("Admin")).toBe(false);
    expect(isRole("superadmin")).toBe(false);
    expect(isRole(null)).toBe(false);
  });

  it("hasRole hanya untuk role yang diizinkan", () => {
    expect(hasRole("admin", ["admin"])).toBe(true);
    expect(hasRole("viewer", ["admin", "pk_manager"])).toBe(false);
    expect(hasRole("viewer", [])).toBe(false);
  });

  it("hanya admin dan pengelola PK yang lintas tim", () => {
    expect(ROLES.filter(isCrossTeam)).toEqual(["admin", "pk_manager"]);
  });
});

describe("authErrorBody (spesifikasi §7.3)", () => {
  it("401 untuk belum masuk", () => {
    expect(authErrorBody("unauthenticated", "req-1")).toEqual({
      status: 401,
      body: {
        error: {
          code: "UNAUTHENTICATED",
          message: "Silakan masuk terlebih dahulu.",
          request_id: "req-1",
        },
      },
    });
  });

  it("403 yang sama untuk role tidak sesuai dan profil nonaktif", () => {
    const forbidden = authErrorBody("forbidden", "req-2");
    expect(forbidden.status).toBe(403);
    expect(authErrorBody("inactive", "req-2")).toEqual(forbidden);
  });
});
