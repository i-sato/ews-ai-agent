/**
 * Allowlist host untuk permintaan keluar (SH-API-02).
 * Tambah host hanya lewat keputusan tercatat di docs/decisions.md.
 */
export const ALLOWED_HOSTS = new Set([
  "sheets.googleapis.com",
  "www.googleapis.com",
  "docs.google.com",
  // Penukaran token service account Google (keputusan S15, 1 Nov 2026).
  "oauth2.googleapis.com",
  "digitalent.komdigi.go.id",
]);

export function isAllowedUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.port === "" && ALLOWED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}
