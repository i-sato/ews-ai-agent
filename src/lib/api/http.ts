// Respons API dengan format galat spesifikasi §7.3: tanpa stack trace, secret, atau PII; selalu
// menyertakan request_id (SH-ERR-01).
import type { AppErrorCode, Result } from "@/modules/ingestion/application/errors";

type ApiErrorCode = AppErrorCode | "UNAUTHENTICATED" | "INTERNAL_ERROR" | "NOT_CONFIGURED";

export const HTTP_STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_LARGE: 413,
  BLOCKED: 422,
  RATE_LIMITED: 429,
  SOURCE_UNAVAILABLE: 503,
  NOT_CONFIGURED: 503,
  INTERNAL_ERROR: 500,
};

const NO_STORE = { "Cache-Control": "no-store" };

export function newRequestId(): string {
  return crypto.randomUUID();
}

/** `details.fields` (galat validasi) menjadi array `details` §7.3; detail lain apa adanya. */
function detailsOf(details: Record<string, unknown> | undefined) {
  if (!details) return {};
  if (Array.isArray(details.fields)) return { details: details.fields };
  return { details };
}

export function errorResponse(
  requestId: string,
  error: { code: keyof typeof HTTP_STATUS; message: string; details?: Record<string, unknown> },
): Response {
  const headers: Record<string, string> = { ...NO_STORE, "X-Request-Id": requestId };
  const retry = error.details?.retryAfterSeconds;
  if (typeof retry === "number") headers["Retry-After"] = String(retry);
  const body = {
    error: {
      code: error.code,
      message: error.message,
      request_id: requestId,
      ...detailsOf(error.details),
    },
  };
  return Response.json(body, { status: HTTP_STATUS[error.code], headers });
}

export function resultResponse<T>(requestId: string, result: Result<T>, status = 200): Response {
  if (!result.ok) return errorResponse(requestId, result.error);
  return Response.json(result.value, {
    status,
    headers: { ...NO_STORE, "X-Request-Id": requestId },
  });
}

export const MAX_JSON_BYTES = 64 * 1024;

/** Body JSON dengan batas ukuran (SH-API-01); galat 400/413 dalam format §7.3. */
export async function readJson(
  request: Request,
  requestId: string,
): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  const length = Number(request.headers.get("content-length") ?? 0);
  const tooLarge = { code: "TOO_LARGE" as const, message: "Permintaan terlalu besar." };
  if (length > MAX_JSON_BYTES) return { ok: false, response: errorResponse(requestId, tooLarge) };
  const text = await request.text();
  if (text.length > MAX_JSON_BYTES)
    return { ok: false, response: errorResponse(requestId, tooLarge) };
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    const invalid = { code: "VALIDATION_ERROR" as const, message: "Body bukan JSON yang valid." };
    return { ok: false, response: errorResponse(requestId, invalid) };
  }
}
