// Galat bernama untuk use case ingestion; route handler memetakannya ke HTTP (spesifikasi §7.3).
export type AppErrorCode =
  | "VALIDATION_ERROR" // 400
  | "FORBIDDEN" // 403
  | "NOT_FOUND" // 404
  | "CONFLICT" // 409
  | "TOO_LARGE" // 413
  | "BLOCKED" // 422: ditahan aturan bisnis (duplikat, katalog berubah)
  | "RATE_LIMITED" // 429
  | "SOURCE_UNAVAILABLE"; // 502/503

export interface AppError {
  code: AppErrorCode;
  /** Pesan untuk pengguna, bahasa Indonesia, tanpa PII atau detail internal. */
  message: string;
  details?: Record<string, unknown>;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export function fail<T = never>(
  code: AppErrorCode,
  message: string,
  details?: Record<string, unknown>,
): Result<T> {
  return { ok: false, error: details ? { code, message, details } : { code, message } };
}
