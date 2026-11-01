import type { Role } from "@/lib/auth/roles";

/** Role per kelompok endpoint (spesifikasi §11.1). Use case tetap memeriksa ulang. */
export const ADMIN_ONLY: readonly Role[] = ["admin"];
export const TRAINING_MANAGERS: readonly Role[] = ["admin", "training_manager"];
/** Semua role aktif; akses data dibatasi RLS per tim kerja. */
export const ANY_ROLE: readonly Role[] = ["admin", "pk_manager", "training_manager", "viewer"];
