import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authErrorBody } from "./api-errors";
import { type CurrentUser, authorize } from "./current-user";
import type { Role } from "./roles";

export type ApiAccess = { ok: true; user: CurrentUser } | { ok: false; response: Response };

/** Route handler `/api/v1`: 401 tanpa sesi, 403 bila profil nonaktif atau role tidak sesuai. */
export async function requireApiRole(
  roles: readonly Role[] | undefined,
  requestId: string,
): Promise<ApiAccess> {
  const access = await authorize(await createSupabaseServerClient(), roles);
  if (access.ok) return access;
  const { status, body } = authErrorBody(access.reason, requestId);
  return { ok: false, response: Response.json(body, { status }) };
}
