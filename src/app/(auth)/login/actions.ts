"use server";

import { redirect } from "next/navigation";
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

  redirect(safeNextPath(input.data.next));
}
