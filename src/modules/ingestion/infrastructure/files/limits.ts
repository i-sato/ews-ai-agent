// Batas impor file (SH-UPLOAD-01; keputusan F2-07 di docs/decisions.md).
export interface FileLimits {
  maxBytes: number;
  maxRows: number;
  /** Total ukuran isi ZIP (XLSX) setelah diekstrak; mencegah zip bomb. */
  maxUncompressedBytes: number;
}

export const FILE_LIMITS: FileLimits = {
  maxBytes: 5 * 1024 * 1024,
  maxRows: 5000,
  maxUncompressedBytes: 50 * 1024 * 1024,
};

const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];

/** Signature ZIP `PK\x03\x04` (XLSX adalah arsip ZIP). */
export function isZip(bytes: Uint8Array): boolean {
  return ZIP_SIGNATURE.every((b, i) => bytes[i] === b);
}
