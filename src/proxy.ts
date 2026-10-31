import { type NextRequest, NextResponse } from "next/server";
import { HOME_PATH, LOGIN_PATH, isPublicPath, loginUrlFor } from "@/lib/auth/paths";
import { CSP_HEADER, buildCsp, createNonce } from "@/lib/security/csp";
import { redirectWithSession, updateSession } from "@/lib/supabase/proxy-session";

// Next.js 16: pengganti middleware.ts. Memasang CSP bernonce (SH-HDR-01) dan memperbarui sesi.
// Hanya pemeriksaan awal; otorisasi sebenarnya di server (layout dan route handler).
export async function proxy(request: NextRequest) {
  const csp = buildCsp({ nonce: createNonce(), dev: process.env.NODE_ENV === "development" });
  const { response, signedIn } = await updateSession(request, { [CSP_HEADER]: csp });
  return withCsp(route(request, response, signedIn), csp);
}

function route(request: NextRequest, response: NextResponse, signedIn: boolean) {
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

function withCsp(response: NextResponse, csp: string) {
  response.headers.set(CSP_HEADER, csp);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
