import { type Result, fail } from "./errors";
import type { Actor, SourceType, UploadStore } from "./ports";
import { IMPORT_ROLES, type ImportDeps, previewImport } from "./preview-import";
import { type PreviewImportOutput, parseInput, previewUploadInput } from "./schemas";
import { fileKeyFor } from "./source-snapshot";

export interface UploadDeps extends ImportDeps {
  uploads: UploadStore;
}

export interface UploadedFile {
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
}

/** Ekstensi dan MIME yang diterima per jenis sumber (SH-UPLOAD-02). Isi tetap dicek adapter. */
const ACCEPTED: Record<Exclude<SourceType, "google_sheets">, { ext: string; mime: string[] }> = {
  csv: { ext: ".csv", mime: ["text/csv", "application/vnd.ms-excel", "text/plain"] },
  xlsx: {
    ext: ".xlsx",
    mime: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  },
};

function acceptsFile(type: SourceType, file: UploadedFile): boolean {
  if (type === "google_sheets") return false;
  const rule = ACCEPTED[type];
  const mime = file.contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return file.fileName.toLowerCase().endsWith(rule.ext) && rule.mime.includes(mime);
}

/**
 * Unggah CSV/XLSX lalu pratinjau (§7.1 `POST /imports/preview`). File disimpan dengan `uploadId`
 * dari server di bucket privat; klien tidak menentukan path.
 */
export async function previewUpload(
  deps: UploadDeps,
  request: { sourceId: string; file: UploadedFile },
  actor: Actor,
): Promise<Result<PreviewImportOutput>> {
  const { file } = request;
  const meta = {
    sourceId: request.sourceId,
    fileName: file.fileName,
    contentType: file.contentType,
  };
  const input = parseInput(previewUploadInput, meta);
  if (!input.ok)
    return fail("VALIDATION_ERROR", "Permintaan tidak valid.", { fields: input.fields });
  if (!IMPORT_ROLES.includes(actor.role)) return fail("FORBIDDEN", "Anda tidak memiliki akses.");
  if (file.bytes.byteLength > deps.settings.maxUploadBytes) {
    return fail("TOO_LARGE", "Ukuran file melebihi batas impor.");
  }
  const source = await deps.imports.findSource(input.value.sourceId);
  if (!source) return fail("NOT_FOUND", "Sumber data tidak ditemukan.");
  if (!acceptsFile(source.sourceType, file)) {
    return fail("VALIDATION_ERROR", "Jenis file tidak sesuai dengan sumber data (CSV atau XLSX).");
  }
  const uploadId = deps.ids.uuid();
  await deps.uploads.save(fileKeyFor(source, uploadId) as string, file.bytes, file.contentType);
  return previewImport(deps, { sourceId: source.id, uploadId }, actor);
}
