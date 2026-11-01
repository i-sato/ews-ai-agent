import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiRole } from "@/lib/auth/api";
import type { Role } from "@/lib/auth/roles";
import { ConfigurationError } from "@/lib/container";
import type { Actor } from "@/modules/ingestion/application/ports";
import { verifyCronSecret } from "./cron";
import { errorResponse, newRequestId } from "./http";

export interface ApiContext {
  requestId: string;
  actor: Actor;
  /** Klien sesi pengguna (RLS) untuk pembacaan yang menentukan akses. */
  session: SupabaseClient;
}

/** Galat tak terduga: 500 tanpa detail; pengaturan belum diisi: 503. Log hanya request_id. */
function unexpected(requestId: string, error: unknown): Response {
  if (error instanceof ConfigurationError) {
    const message = "Layanan impor belum dikonfigurasi.";
    return errorResponse(requestId, { code: "NOT_CONFIGURED", message });
  }
  console.error(`[api] ${requestId} ${error instanceof Error ? error.name : "unknown"}`);
  const message = "Terjadi kesalahan pada server.";
  return errorResponse(requestId, { code: "INTERNAL_ERROR", message });
}

/**
 * Pembungkus route `/api/v1`: request_id, sesi dan role dari server (401/403, SH-AUTHZ-01),
 * lalu satu use case. Route tetap ≤ 60 baris (spesifikasi §4.3).
 */
export async function withApi(
  roles: readonly Role[] | undefined,
  run: (ctx: ApiContext) => Promise<Response>,
): Promise<Response> {
  const requestId = newRequestId();
  try {
    const access = await requireApiRole(roles, requestId);
    if (!access.ok) return access.response;
    const actor: Actor = { id: access.user.id, role: access.user.role };
    return await run({ requestId, actor, session: access.client });
  } catch (error) {
    return unexpected(requestId, error);
  }
}

/** Pembungkus route cron: `Authorization: Bearer <CRON_SECRET>` (Vercel Cron). */
export async function withCron(
  request: Request,
  run: (requestId: string) => Promise<Response>,
): Promise<Response> {
  const requestId = newRequestId();
  if (!verifyCronSecret(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    const message = "Silakan masuk terlebih dahulu.";
    return errorResponse(requestId, { code: "UNAUTHENTICATED", message });
  }
  try {
    return await run(requestId);
  } catch (error) {
    return unexpected(requestId, error);
  }
}
