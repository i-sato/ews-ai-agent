import { describe, expect, it } from "vitest";
import { classifyAuthError, loginInputSchema, parseLoginForm } from "@/lib/auth/login-input";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("parseLoginForm", () => {
  it("menerima email dan kata sandi, email dirapikan", () => {
    const result = parseLoginForm(form({ email: " Pengelola@Example.TEST ", password: "x" }));
    expect(result.success && result.data).toEqual({
      email: "pengelola@example.test",
      password: "x",
      next: undefined,
    });
  });

  it("mengabaikan field internal Next.js", () => {
    const result = parseLoginForm(
      form({ email: "a@example.test", password: "x", $ACTION_ID_abc: "", next: "/reports" }),
    );
    expect(result.success).toBe(true);
  });

  it.each([
    ["email kosong", { email: "", password: "x" }],
    ["email tidak valid", { email: "bukan-email", password: "x" }],
    ["kata sandi kosong", { email: "a@example.test", password: "" }],
    ["kata sandi terlalu panjang", { email: "a@example.test", password: "x".repeat(129) }],
  ])("menolak %s", (_, fields) => {
    expect(parseLoginForm(form(fields)).success).toBe(false);
  });
});

describe("loginInputSchema", () => {
  it("strict: menolak field tak dikenal", () => {
    const result = loginInputSchema.safeParse({
      email: "a@example.test",
      password: "x",
      role: "admin",
    });
    expect(result.success).toBe(false);
  });
});

describe("classifyAuthError", () => {
  it("kredensial salah dan email tak terdaftar mendapat pesan yang sama", () => {
    expect(classifyAuthError({ status: 400, code: "invalid_credentials" })).toBe("invalid");
    expect(classifyAuthError({ status: 400, code: "email_not_confirmed" })).toBe("invalid");
  });

  it("membedakan pembatasan percobaan dan layanan tidak tersedia", () => {
    expect(classifyAuthError({ status: 429 })).toBe("rateLimited");
    expect(classifyAuthError({ code: "over_request_rate_limit" })).toBe("rateLimited");
    expect(classifyAuthError({ status: 500 })).toBe("unavailable");
    expect(classifyAuthError({})).toBe("unavailable");
  });
});
