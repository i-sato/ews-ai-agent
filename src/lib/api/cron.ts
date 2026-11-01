import { timingSafeEqual } from "node:crypto";

/**
 * Verifikasi header `Authorization: Bearer <CRON_SECRET>` dengan perbandingan waktu-konstan.
 * Secret kosong atau terlalu pendek selalu ditolak.
 */
export function verifyCronSecret(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 16 || !header?.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
