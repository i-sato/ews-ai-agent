// SH-HDR-01: Content Security Policy dengan nonce per request (dipasang di src/proxy.ts).
export const CSP_HEADER = "Content-Security-Policy";

/** Nonce acak 128 bit, base64. Dibuat baru untuk setiap request. */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

type CspOptions = { nonce: string; dev: boolean };

/**
 * Tanpa `unsafe-inline` untuk skrip. Mode dev menambah `unsafe-eval` (debug React) dan
 * `unsafe-inline` untuk style (overlay Next.js); keduanya tidak ada di produksi.
 */
export function buildCsp({ nonce, dev }: CspOptions): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${dev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  // Di dev (http://localhost) direktif ini memaksa https dan memutus aset.
  if (!dev) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}
