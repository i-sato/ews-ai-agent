import type { Clock, DriveMetadata, IdGenerator } from "../application/ports";

export const systemClock: Clock = { now: () => new Date() };

export const cryptoIds: IdGenerator = { uuid: () => crypto.randomUUID() };

/** Metadata Drive saat kredensial service account belum diisi. */
export const unavailableDriveMetadata: DriveMetadata = { modifiedTime: async () => null };
