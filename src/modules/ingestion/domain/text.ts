const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/** Rapikan spasi tanpa mengubah huruf; untuk judul tampilan. */
export function tidy(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Kunci pencocokan header: rapi dan tanpa peka huruf besar/kecil (spesifikasi §3.3). */
export function headerKey(value: string): string {
  return tidy(value).toLowerCase();
}

/** Dekode entitas HTML yang muncul pada judul item, mis. `&AMP;`. */
export function decodeEntities(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|#39);/gi, (m) => HTML_ENTITIES[m.toLowerCase()] ?? m);
}

/** Huruf kolom spreadsheet dari indeks 0-based (0 → A, 26 → AA). */
export function columnLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}
