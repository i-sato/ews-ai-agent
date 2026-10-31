import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublicConfig } from "./config";
import { SESSION_COOKIE_OPTIONS, hardenCookie } from "./cookies";

/** Klien Supabase untuk Server Component, Server Action, dan route handler (sesi pengguna). */
export async function createSupabaseServerClient() {
  const store = await cookies();
  const { url, anonKey } = supabasePublicConfig();
  return createServerClient(url, anonKey, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const c of list) store.set(c.name, c.value, hardenCookie(c.options));
        } catch {
          // Server Component tidak boleh menulis cookie; sesi diperbarui oleh src/proxy.ts.
        }
      },
    },
  });
}
