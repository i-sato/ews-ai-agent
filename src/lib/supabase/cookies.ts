import type { CookieOptions } from "@supabase/ssr";

// SH-SESS-01: bawaan @supabase/ssr menulis cookie tanpa HttpOnly agar klien browser bisa
// membacanya. EWS tidak memakai klien Supabase di browser, jadi cookie sesi dipaksa HttpOnly.
export const SESSION_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
} as const satisfies CookieOptions;

export function hardenCookie(options: CookieOptions): CookieOptions {
  return { ...options, ...SESSION_COOKIE_OPTIONS };
}
