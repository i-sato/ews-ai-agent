import type { NextRequest } from "next/server";
import { HOME_PATH, LOGIN_PATH, isPublicPath, loginUrlFor } from "@/lib/auth/paths";
import { redirectWithSession, updateSession } from "@/lib/supabase/proxy-session";

// Next.js 16: pengganti middleware.ts. Hanya pemeriksaan awal; otorisasi sebenarnya di server
// (layout dan route handler), bukan di sini.
export async function proxy(request: NextRequest) {
  const { response, signedIn } = await updateSession(request);
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) return response;
  if (!signedIn && !isPublicPath(pathname)) {
    return redirectWithSession(new URL(loginUrlFor(pathname, search), request.url), response);
  }
  if (signedIn && pathname === LOGIN_PATH) {
    return redirectWithSession(new URL(HOME_PATH, request.url), response);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
