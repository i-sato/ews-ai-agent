export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Parameter yang dikenal saja, sebagai teks tunggal; kosong dibuang (skema use case strict). */
export function pickParams(raw: RawSearchParams, keys: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = raw[key];
    const text = Array.isArray(value) ? value[0] : value;
    if (text) out[key] = text;
  }
  return out;
}

export function hrefWith(
  path: string,
  params: Record<string, string>,
  extra: Record<string, string>,
) {
  const query = new URLSearchParams({ ...params, ...extra }).toString();
  return query ? `${path}?${query}` : path;
}
