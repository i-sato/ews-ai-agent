import { redirect } from "next/navigation";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type AuthorizationResult, type CurrentUser, authorize } from "./current-user";
import { LOGIN_PATH } from "./paths";
import type { Role } from "./roles";

export type PageAccess =
  { ok: true; user: CurrentUser } | { ok: false; reason: "inactive" | "forbidden" };

// Satu pembacaan profil per request, dipakai bersama layout dan halaman.
const currentAccess = cache(async (): Promise<AuthorizationResult> =>
  authorize(await createSupabaseServerClient()),
);

/**
 * Untuk Server Component dan Server Action. Tanpa sesi: dialihkan ke login. Role tidak sesuai
 * atau profil nonaktif: dikembalikan `ok: false` untuk dirender sebagai "Akses ditolak".
 * Setiap halaman yang memuat data wajib memanggil ini sendiri; layout tidak melindungi halaman.
 */
export async function requireRole(roles?: readonly Role[]): Promise<PageAccess> {
  const access = await currentAccess();
  if (!access.ok) {
    if (access.reason === "unauthenticated") redirect(LOGIN_PATH);
    return { ok: false, reason: access.reason };
  }
  if (roles && !roles.includes(access.user.role)) return { ok: false, reason: "forbidden" };
  return access;
}

export function requireUser(): Promise<PageAccess> {
  return requireRole();
}
