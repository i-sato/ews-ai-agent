export type ItemType = "overview" | "material" | "video" | "quiz" | "final_assessment";

const PREFIXES: ReadonlyArray<[RegExp, ItemType]> = [
  [/^overview\b/i, "overview"],
  [/^video\s*:/i, "video"],
  [/^kuis\b/i, "quiz"],
  [/^final assessment\b/i, "final_assessment"],
];

/** Jenis item dari awalan judul; selain itu materi (spesifikasi §3.3). */
export function inferItemType(title: string): ItemType {
  const trimmed = title.trim();
  const match = PREFIXES.find(([pattern]) => pattern.test(trimmed));
  return match ? match[1] : "material";
}
