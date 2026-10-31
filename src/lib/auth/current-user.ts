import type { SupabaseClient } from "@supabase/supabase-js";
import { type Role, hasRole, isCrossTeam, isRole } from "./roles";

export type CurrentUser = {
  id: string;
  displayName: string;
  role: Role;
  crossTeam: boolean;
  workTeamIds: string[];
};

export type AuthorizationResult =
  | { ok: true; user: CurrentUser }
  | { ok: false; reason: "unauthenticated" | "inactive" | "forbidden" };

/**
 * SH-AUTHZ-01: identitas dari token yang divalidasi Supabase Auth, role dan tim dari tabel
 * `profiles`/`profile_work_teams` (dibaca dengan sesi pengguna, dibatasi RLS). `user_metadata`
 * dan nilai apa pun dari klien tidak dipakai.
 */
export async function loadCurrentUser(supabase: SupabaseClient): Promise<AuthorizationResult> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, reason: "unauthenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role, active")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!profile?.active || !isRole(profile.role)) return { ok: false, reason: "inactive" };

  const { data: teams, error } = await supabase
    .from("profile_work_teams")
    .select("work_team_id")
    .eq("profile_id", auth.user.id);
  if (error) return { ok: false, reason: "inactive" };

  return {
    ok: true,
    user: {
      id: auth.user.id,
      displayName: String(profile.display_name),
      role: profile.role,
      crossTeam: isCrossTeam(profile.role),
      workTeamIds: teams.map((t) => String(t.work_team_id)),
    },
  };
}

/** Periksa sesi dan, bila diberikan, role yang diizinkan. */
export async function authorize(
  supabase: SupabaseClient,
  roles?: readonly Role[],
): Promise<AuthorizationResult> {
  const result = await loadCurrentUser(supabase);
  if (!result.ok || !roles || hasRole(result.user.role, roles)) return result;
  return { ok: false, reason: "forbidden" };
}
