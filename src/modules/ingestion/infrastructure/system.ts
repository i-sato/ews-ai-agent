import type { Clock, DriveMetadata, IdGenerator } from "../application/ports";

export const systemClock: Clock = { now: () => new Date() };

export const cryptoIds: IdGenerator = { uuid: () => crypto.randomUUID() };

/** Metadata Drive belum tersedia selama adapter Google ditunda (docs/decisions.md). */
export const unavailableDriveMetadata: DriveMetadata = { modifiedTime: async () => null };
