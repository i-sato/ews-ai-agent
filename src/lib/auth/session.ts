import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "./paths";

/** Pastikan ada sesi valid (divalidasi ke Supabase Auth). Tanpa sesi: ke halaman login. */
export async function requireSession(): Promise<{ userId: string }> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(LOGIN_PATH);
  return { userId: data.user.id };
}
