import { withApi } from "@/lib/api/handler";
import { errorResponse, readJson, resultResponse } from "@/lib/api/http";
import { TRAINING_MANAGERS } from "@/lib/api/roles";
import { ingestionDeps } from "@/lib/container";
import { previewImport } from "@/modules/ingestion/application/preview-import";
import { previewUpload } from "@/modules/ingestion/application/preview-upload";

// Ruang untuk field form selain file (SH-UPLOAD-01: batas file ditegakkan use case dan adapter).
const FORM_OVERHEAD = 64 * 1024;

async function readUpload(request: Request, maxBytes: number) {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes + FORM_OVERHEAD) return null;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return undefined;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const upload = { fileName: file.name, contentType: file.type, bytes };
  return { sourceId: String(form.get("sourceId") ?? ""), file: upload };
}

// §7.1, §3.4: multipart (sourceId + file CSV/XLSX) atau JSON { sourceId } untuk Google Sheets.
export function POST(request: Request) {
  return withApi(TRAINING_MANAGERS, async ({ requestId, actor, session }) => {
    const deps = await ingestionDeps(session);
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
      const body = await readJson(request, requestId);
      if (!body.ok) return body.response;
      return resultResponse(requestId, await previewImport(deps, body.value, actor));
    }
    const upload = await readUpload(request, deps.settings.maxUploadBytes);
    if (upload === null) {
      return errorResponse(requestId, {
        code: "TOO_LARGE",
        message: "Ukuran file melebihi batas impor.",
      });
    }
    if (!upload) {
      return errorResponse(requestId, {
        code: "VALIDATION_ERROR",
        message: "File belum dilampirkan.",
      });
    }
    return resultResponse(requestId, await previewUpload(deps, upload, actor));
  });
}
