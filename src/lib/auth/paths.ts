export const LOGIN_PATH = "/login";
export const HOME_PATH = "/dashboard";

const PUBLIC_PATHS = [LOGIN_PATH, "/compliance", "/api/health"];
const BASE = "http://ews.invalid";

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Tujuan setelah login. Hanya path relatif di aplikasi ini (cegah open redirect). */
export function safeNextPath(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) return HOME_PATH;
  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return HOME_PATH;
  }
  if (url.origin !== BASE || isPublicPath(url.pathname)) return HOME_PATH;
  return `${url.pathname}${url.search}`;
}

export function loginUrlFor(pathname: string, search: string): string {
  const next = safeNextPath(`${pathname}${search}`);
  if (next === HOME_PATH || next === "/") return LOGIN_PATH;
  return `${LOGIN_PATH}?next=${encodeURIComponent(next)}`;
}
