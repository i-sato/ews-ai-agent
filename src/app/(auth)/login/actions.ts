"use server";

import { redirect } from "next/navigation";
import { loadCurrentUser } from "@/lib/auth/current-user";
import { LOGIN_MESSAGES, classifyAuthError, parseLoginForm } from "@/lib/auth/login-input";
import { safeNextPath } from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

// SH-AUTH-01: login email + kata sandi lewat Supabase Auth, seluruhnya di server.
export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const input = parseLoginForm(form);
  if (!input.success) return { error: LOGIN_MESSAGES.invalid };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: input.data.email,
    password: input.data.password,
  });
  if (error) return { error: LOGIN_MESSAGES[classifyAuthError(error)] };

  // Akun tanpa profil aktif tidak boleh memegang sesi (SH-AUTHZ-01).
  const access = await loadCurrentUser(supabase);
  if (!access.ok) {
    await supabase.auth.signOut({ scope: "local" });
    return { error: LOGIN_MESSAGES.inactive };
  }

  redirect(safeNextPath(input.data.next));
}
