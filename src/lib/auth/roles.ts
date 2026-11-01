// Role awal (spesifikasi §11.1); nilai sama dengan check constraint profiles.role.
export const ROLES = ["admin", "pk_manager", "training_manager", "viewer"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  pk_manager: "Pengelola PK",
  training_manager: "Pengelola Pelatihan",
  viewer: "Viewer/Pimpinan",
};

/** Role lintas tim kerja (keputusan no. 1, usulan bawaan); lainnya terbatas ke timnya. */
const CROSS_TEAM_ROLES: readonly Role[] = ["admin", "pk_manager"];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function hasRole(role: Role, allowed: readonly Role[]): boolean {
  return allowed.includes(role);
}

export function isCrossTeam(role: Role): boolean {
  return hasRole(role, CROSS_TEAM_ROLES);
}
