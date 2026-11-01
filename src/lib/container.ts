// Satu-satunya tempat merakit adapter (spesifikasi §4.2). Route handler memanggil fungsi di sini,
// lalu menyerahkan hasilnya ke use case.
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { ParseSourceDeps } from "@/modules/ingestion/application/parse-training-source";
import type { ImportDeps } from "@/modules/ingestion/application/preview-import";
import type { UploadDeps } from "@/modules/ingestion/application/preview-upload";
import type { RegisterDeps } from "@/modules/ingestion/application/register-training";
import type { ScheduleDeps } from "@/modules/ingestion/application/update-schedule";
import {
  FileSheetSource,
  SupabaseFileStore,
} from "@/modules/ingestion/infrastructure/files/file-sheet-source";
import { FILE_LIMITS } from "@/modules/ingestion/infrastructure/files/limits";
import { sharedGoogleTokens } from "@/modules/ingestion/infrastructure/google/service-account";
import {
  GoogleDriveMetadata,
  GoogleSheetSource,
  RoutingSheetSource,
} from "@/modules/ingestion/infrastructure/google/sheets";
import { SupabaseImportRepository } from "@/modules/ingestion/infrastructure/supabase/import-repository";
import { activeLmsTolerance } from "@/modules/ingestion/infrastructure/supabase/settings";
import {
  SupabaseAuditLog,
  SupabaseTrainingRepository,
} from "@/modules/ingestion/infrastructure/supabase/training-repository";
import {
  cryptoIds,
  systemClock,
  unavailableDriveMetadata,
} from "@/modules/ingestion/infrastructure/system";
import { createSupabaseServiceClient } from "@/modules/shared/infrastructure/supabase-service";

export class ConfigurationError extends Error {
  override name = "ConfigurationError";
}

// Angka tidak ditetapkan di kode (keputusan F2-06); wajib diisi di environment.
const importEnv = z.object({
  IMPORT_STAGING_TTL_MINUTES: z.coerce.number().int().positive(),
  MANUAL_SYNC_MIN_INTERVAL_MINUTES: z.coerce.number().int().positive(),
});

function importEnvironment() {
  const parsed = importEnv.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new ConfigurationError(`Pengaturan impor belum diisi: ${missing}`);
  }
  return parsed.data;
}

export type IngestionDeps = ImportDeps & UploadDeps & RegisterDeps & ParseSourceDeps & ScheduleDeps;

/**
 * Dependensi ingestion. `session` = klien sesi pengguna (RLS) untuk pembacaan yang menentukan
 * akses; null untuk sinkron terjadwal (service role penuh). Penulisan selalu service role.
 */
export async function ingestionDeps(session: SupabaseClient | null): Promise<IngestionDeps> {
  const env = importEnvironment();
  const writer = createSupabaseServiceClient();
  const clients = { reader: session ?? writer, writer };
  const files = new SupabaseFileStore(writer);
  // Tanpa kredensial service account, sumber Google mengembalikan NOT_CONFIGURED.
  const tokens = sharedGoogleTokens();
  const google = tokens ? new GoogleSheetSource(tokens, FILE_LIMITS) : null;
  return {
    sheets: new RoutingSheetSource(google, new FileSheetSource(files, FILE_LIMITS)),
    uploads: files,
    drive: tokens ? new GoogleDriveMetadata(tokens) : unavailableDriveMetadata,
    imports: new SupabaseImportRepository(clients),
    trainings: new SupabaseTrainingRepository(clients),
    audit: new SupabaseAuditLog(writer),
    clock: systemClock,
    ids: cryptoIds,
    settings: {
      lmsTolerancePp: await activeLmsTolerance(writer, systemClock.now()),
      stagingTtlMinutes: env.IMPORT_STAGING_TTL_MINUTES,
      manualSyncMinIntervalMinutes: env.MANUAL_SYNC_MIN_INTERVAL_MINUTES,
      maxUploadBytes: FILE_LIMITS.maxBytes,
    },
  };
}
