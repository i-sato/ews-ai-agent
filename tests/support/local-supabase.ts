// Helper tes untuk Supabase LOKAL saja. Membuat akun sintetis (@example.test) lewat Admin API.
import { type SupabaseClient, createClient } from "@supabase/supabase-js";

export type TestRole = "admin" | "pk_manager" | "training_manager" | "viewer";
export type TestUser = {
  email: string;
  displayName: string;
  role: TestRole;
  active?: boolean;
  /** Kode tim kerja dari seed (DTA, GTA, KDD). */
  teams?: readonly string[];
};

// Kata sandi sintetis untuk akun uji di Supabase lokal; memenuhi SH-AUTH-05.
export const TEST_PASSWORD = "Uji-Sintetis-2026";

export const TEST_USERS = {
  trainingManager: {
    email: "e2e.pengelola@example.test",
    displayName: "Pengelola Uji",
    role: "training_manager",
    teams: ["DTA"],
  },
  viewer: {
    email: "e2e.viewer@example.test",
    displayName: "Viewer Uji",
    role: "viewer",
    teams: ["GTA"],
  },
  pkManager: { email: "e2e.pk@example.test", displayName: "Pengelola PK Uji", role: "pk_manager" },
  gtaManager: {
    email: "e2e.pengelola.gta@example.test",
    displayName: "Pengelola GTA Uji",
    role: "training_manager",
    teams: ["GTA"],
  },
  admin: { email: "e2e.admin@example.test", displayName: "Admin Uji", role: "admin" },
  inactive: {
    email: "e2e.nonaktif@example.test",
    displayName: "Nonaktif Uji",
    role: "training_manager",
    active: false,
  },
} as const satisfies Record<string, TestUser>;

export function localSupabaseEnv() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Env bisa sudah tersedia dari CI.
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const host = url ? new URL(url).hostname : "";
  if (!["127.0.0.1", "localhost"].includes(host) || !anonKey || !serviceKey) {
    throw new Error(
      "Tes auth hanya untuk Supabase lokal. Jalankan `supabase start` dan `pnpm db:env`.",
    );
  }
  return { url, anonKey, serviceKey };
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export function adminClient(): SupabaseClient {
  const { url, serviceKey } = localSupabaseEnv();
  return createClient(url, serviceKey, noSession);
}

export function anonClient(): SupabaseClient {
  const { url, anonKey } = localSupabaseEnv();
  return createClient(url, anonKey, noSession);
}

async function findUserId(admin: SupabaseClient, email: string): Promise<string | undefined> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.email === email)?.id;
}

/** Buat atau perbarui akun uji beserta profilnya. Mengembalikan id pengguna. */
export async function ensureTestUser(user: TestUser): Promise<string> {
  const admin = adminClient();
  const attrs = { password: TEST_PASSWORD, email_confirm: true, user_metadata: {} };
  let id = await findUserId(admin, user.email);
  if (id) {
    const { error } = await admin.auth.admin.updateUserById(id, attrs);
    if (error) throw error;
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email: user.email, ...attrs });
    if (error) throw error;
    id = data.user.id;
  }
  const { error } = await admin.from("profiles").upsert({
    id,
    display_name: user.displayName,
    role: user.role,
    active: user.active ?? true,
  });
  if (error) throw error;
  await setTeams(admin, id, user.teams ?? []);
  return id;
}

async function setTeams(admin: SupabaseClient, profileId: string, codes: readonly string[]) {
  const { data: teams, error } = await admin.from("work_teams").select("id").in("code", codes);
  if (error) throw error;
  const keep = teams.map((t) => String(t.id));
  let stale = admin.from("profile_work_teams").delete().eq("profile_id", profileId);
  if (keep.length > 0) stale = stale.not("work_team_id", "in", `(${keep.join(",")})`);
  const removed = await stale;
  if (removed.error) throw removed.error;
  if (keep.length === 0) return;
  const rows = keep.map((id) => ({ profile_id: profileId, work_team_id: id }));
  const upserted = await admin
    .from("profile_work_teams")
    .upsert(rows, { onConflict: "profile_id,work_team_id", ignoreDuplicates: true });
  if (upserted.error) throw upserted.error;
}

/** Klien anon yang sudah masuk sebagai akun uji (sesi tidak disimpan). */
export async function signedInClient(user: TestUser): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: TEST_PASSWORD,
  });
  if (error) throw error;
  return client;
}

export async function setUserMetadata(userId: string, metadata: Record<string, unknown>) {
  const { error } = await adminClient().auth.admin.updateUserById(userId, {
    user_metadata: metadata,
  });
  if (error) throw error;
}
