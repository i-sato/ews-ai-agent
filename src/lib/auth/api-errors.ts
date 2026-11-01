// Galat otorisasi untuk route handler dengan format spesifikasi §7.3 (tanpa detail internal).
export type AuthFailureReason = "unauthenticated" | "inactive" | "forbidden";

const FAILURES = {
  unauthenticated: {
    status: 401,
    code: "UNAUTHENTICATED",
    message: "Silakan masuk terlebih dahulu.",
  },
  inactive: { status: 403, code: "FORBIDDEN", message: "Anda tidak memiliki akses." },
  forbidden: { status: 403, code: "FORBIDDEN", message: "Anda tidak memiliki akses." },
} as const;

export function authErrorBody(reason: AuthFailureReason, requestId: string) {
  const { status, code, message } = FAILURES[reason];
  return { status, body: { error: { code, message, request_id: requestId } } };
}
