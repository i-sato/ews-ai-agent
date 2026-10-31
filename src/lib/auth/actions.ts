"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "./paths";

// SH-SESS-03: logout di server; refresh token sesi ini dicabut di Supabase Auth.
export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect(LOGIN_PATH);
}
