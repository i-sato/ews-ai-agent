import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { supabasePublicConfig } from "./config";
import { SESSION_COOKIE_OPTIONS, hardenCookie } from "./cookies";

/**
 * Memperbarui token sesi di proxy dan mengembalikan respons yang membawa cookie baru.
 * `getUser()` memvalidasi token ke Supabase Auth, sehingga sesi yang sudah dicabut ditolak.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = supabasePublicConfig();
  const supabase = createServerClient(url, anonKey, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        for (const c of list) request.cookies.set(c.name, c.value);
        response = NextResponse.next({ request });
        for (const c of list) response.cookies.set(c.name, c.value, hardenCookie(c.options));
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  return { response, signedIn: data.user !== null };
}

/** Redirect yang tetap membawa cookie sesi hasil pembaruan. */
export function redirectWithSession(target: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(target);
  for (const c of from.cookies.getAll()) redirect.cookies.set(c);
  const cacheControl = from.headers.get("cache-control");
  if (cacheControl) redirect.headers.set("cache-control", cacheControl);
  return redirect;
}
