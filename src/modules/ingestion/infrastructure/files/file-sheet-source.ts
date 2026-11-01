import type { SupabaseClient } from "@supabase/supabase-js";
import type { DataSourceConfig, SheetRead, SheetSource } from "../../application/ports";
import { parseCsvFile } from "./csv-file";
import type { FileLimits } from "./limits";
import { parseXlsxFile } from "./xlsx-file";

export const IMPORT_BUCKET = "imports";

export interface FileStore {
  /** Isi file; null bila tidak ada. */
  download(path: string): Promise<Uint8Array | null>;
}

/** Bucket privat `imports` lewat klien service role (SH-UPLOAD-03). */
export class SupabaseFileStore implements FileStore {
  constructor(private readonly client: SupabaseClient) {}

  async download(path: string): Promise<Uint8Array | null> {
    const { data, error } = await this.client.storage.from(IMPORT_BUCKET).download(path);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  }
}

const NOT_CONFIGURED: SheetRead = { ok: false, error: "NOT_CONFIGURED" };

/**
 * SheetSource untuk unggahan CSV/XLSX. Adapter Google Sheets ditunda sampai host token
 * `oauth2.googleapis.com` disetujui masuk allowlist SH-API-02 (docs/decisions.md).
 */
export class FileSheetSource implements SheetSource {
  constructor(
    private readonly files: FileStore,
    private readonly limits: FileLimits,
  ) {}

  async readRows(
    source: Pick<DataSourceConfig, "sourceType" | "reference">,
    fileKey: string | null,
  ): Promise<SheetRead> {
    if (source.sourceType === "google_sheets") return NOT_CONFIGURED;
    if (fileKey === null) return { ok: false, error: "NOT_FOUND" };
    const bytes = await this.files.download(fileKey);
    if (!bytes) return { ok: false, error: "NOT_FOUND" };
    return source.sourceType === "csv"
      ? parseCsvFile(bytes, this.limits)
      : parseXlsxFile(bytes, this.limits);
  }

  async readTitle(): Promise<{ ok: false; error: "NOT_CONFIGURED" }> {
    return { ok: false, error: "NOT_CONFIGURED" };
  }
}
