import type { ZodType } from "zod";
import { isAllowedUrl } from "@/lib/security/url-allowlist";
import type { SheetReadError } from "../../application/ports";

export type GoogleResult<T> = { ok: true; data: T } | { ok: false; error: SheetReadError };

export interface GoogleHttpOptions {
  timeoutMs: number;
  /** Jumlah ulang untuk 429/5xx/galat jaringan (retry terbatas, SH-API-04). */
  retries: number;
}

export const GOOGLE_HTTP: GoogleHttpOptions = { timeoutMs: 10_000, retries: 1 };

const UNAVAILABLE = { ok: false, error: "UNAVAILABLE" } as const;

function statusError(status: number): SheetReadError {
  if (status === 401 || status === 403) return "PERMISSION_DENIED";
  return status === 404 ? "NOT_FOUND" : "UNAVAILABLE";
}

const retryable = (status: number) => status === 429 || status >= 500;

async function parseBody<T>(res: Response, schema: ZodType<T>): Promise<GoogleResult<T>> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return UNAVAILABLE;
  }
  const parsed = schema.safeParse(body);
  return parsed.success ? { ok: true, data: parsed.data } : UNAVAILABLE;
}

export interface GoogleRequest<T> {
  url: string;
  init: RequestInit;
  schema: ZodType<T>;
}

/**
 * Satu-satunya jalur HTTP ke Google. Host wajib di allowlist (SH-API-02), redirect ditolak,
 * timeout, retry terbatas, dan respons divalidasi skema; tidak dipercaya begitu saja (SH-API-04).
 */
export async function requestJson<T>(
  request: GoogleRequest<T>,
  options: GoogleHttpOptions = GOOGLE_HTTP,
): Promise<GoogleResult<T>> {
  const { url, init, schema } = request;
  if (!isAllowedUrl(url)) return UNAVAILABLE;
  for (let attempt = 0; ; attempt++) {
    const last = attempt >= options.retries;
    let res: Response;
    try {
      const signal = AbortSignal.timeout(options.timeoutMs);
      res = await fetch(url, { ...init, redirect: "error", signal });
    } catch {
      if (last) return UNAVAILABLE;
      continue;
    }
    if (retryable(res.status) && !last) continue;
    if (!res.ok) return { ok: false, error: statusError(res.status) };
    return parseBody(res, schema);
  }
}
