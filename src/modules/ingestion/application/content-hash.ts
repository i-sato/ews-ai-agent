import type { NormalizedParticipant } from "../domain/participant-rows";
import type { CatalogItem } from "./ports";

// Hash isi per baris dan per item (spesifikasi §3.5) untuk `content_changed_at` dan deduplikasi.
// Posisi baris, bendera kualitas, dan sel UPDATE TERAKHIR tidak ikut: bukan perubahan isi.

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function canonicalRow(p: NormalizedParticipant): string {
  return JSON.stringify([
    p.participantNumber,
    p.participantName,
    p.organization,
    p.sourceStatus,
    p.onboardingStatus,
    p.completionPercentage,
    p.modules.map((m) => [m.sequence, m.status]),
  ]);
}

function canonicalCatalog(items: readonly CatalogItem[]): string {
  return JSON.stringify(items.map((i) => [i.sequence, i.sourceName, i.sourceColumn]));
}

export interface ContentHashes {
  contentHash: string;
  /** Kunci = nomor registrasi. Nomor ganda menimpa; commit ditahan bila ada duplikat. */
  rowHashes: Map<string, string>;
}

export async function hashContent(
  participants: readonly NormalizedParticipant[],
  catalog: readonly CatalogItem[],
): Promise<ContentHashes> {
  const rowHashes = new Map<string, string>();
  const hashes: string[] = [];
  for (const p of participants) {
    const hash = await sha256Hex(canonicalRow(p));
    rowHashes.set(p.participantNumber, hash);
    hashes.push(hash);
  }
  hashes.sort();
  const contentHash = await sha256Hex(JSON.stringify([canonicalCatalog(catalog), hashes]));
  return { contentHash, rowHashes };
}
