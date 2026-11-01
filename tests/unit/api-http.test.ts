// F2-08: format galat §7.3 dengan request_id (SH-ERR-01), batas body JSON, verifikasi CRON_SECRET.
import { describe, expect, it } from "vitest";
import { verifyCronSecret } from "@/lib/api/cron";
import { MAX_JSON_BYTES, errorResponse, readJson, resultResponse } from "@/lib/api/http";

const RID = "00000000-0000-4000-8000-0000000000aa";

describe("errorResponse dan resultResponse", () => {
  it("galat validasi: details berupa daftar field (§7.3)", async () => {
    const fields = [{ field: "batchId", reason: "invalid_format" }];
    const res = errorResponse(RID, {
      code: "VALIDATION_ERROR",
      message: "Tidak valid.",
      details: { fields },
    });
    expect(res.status).toBe(400);
    expect(res.headers.get("x-request-id")).toBe(RID);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Tidak valid.",
        request_id: RID,
        details: fields,
      },
    });
  });

  it.each([
    ["UNAUTHENTICATED", 401],
    ["FORBIDDEN", 403],
    ["NOT_FOUND", 404],
    ["CONFLICT", 409],
    ["TOO_LARGE", 413],
    ["BLOCKED", 422],
    ["SOURCE_UNAVAILABLE", 503],
    ["INTERNAL_ERROR", 500],
  ] as const)("%s → %d", (code, status) => {
    expect(errorResponse(RID, { code, message: "x" }).status).toBe(status);
  });

  it("429 menyertakan Retry-After", () => {
    const res = errorResponse(RID, {
      code: "RATE_LIMITED",
      message: "Terlalu sering.",
      details: { retryAfterSeconds: 360 },
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("360");
  });

  it("hasil sukses dengan status yang diminta", async () => {
    const res = resultResponse(RID, { ok: true, value: { a: 1 } }, 201);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ a: 1 });
  });
});

describe("readJson", () => {
  const post = (body: string, headers: Record<string, string> = {}) =>
    new Request("http://localhost/api", { method: "POST", body, headers });

  it("JSON valid", async () => {
    expect(await readJson(post('{"a":1}'), RID)).toEqual({ ok: true, value: { a: 1 } });
  });

  it("bukan JSON → 400", async () => {
    const result = await readJson(post("{a:"), RID);
    expect(result.ok || result.response.status).toBe(400);
  });

  it("melebihi batas → 413, dari header maupun isi", async () => {
    const declared = await readJson(
      post("{}", { "content-length": String(MAX_JSON_BYTES + 1) }),
      RID,
    );
    expect(declared.ok || declared.response.status).toBe(413);
    const actual = await readJson(post(`"${"x".repeat(MAX_JSON_BYTES)}"`), RID);
    expect(actual.ok || actual.response.status).toBe(413);
  });
});

describe("verifyCronSecret", () => {
  const SECRET = "rahasia-cron-uji-0123456789";

  it("hanya Bearer dengan secret yang sama", () => {
    expect(verifyCronSecret(`Bearer ${SECRET}`, SECRET)).toBe(true);
    expect(verifyCronSecret(`Bearer ${SECRET}x`, SECRET)).toBe(false);
    expect(verifyCronSecret(SECRET, SECRET)).toBe(false);
    expect(verifyCronSecret(null, SECRET)).toBe(false);
  });

  it("secret kosong atau pendek selalu ditolak", () => {
    expect(verifyCronSecret("Bearer ", "")).toBe(false);
    expect(verifyCronSecret("Bearer pendek", "pendek")).toBe(false);
    expect(verifyCronSecret("Bearer x", undefined)).toBe(false);
  });
});
