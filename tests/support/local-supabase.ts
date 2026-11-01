// Helper tes untuk Supabase LOKAL saja. Membuat akun sintetis (@example.test) lewat Admin API.
import { type SupabaseClient, createClient } from "@supabase/supabase-js";

export type TestRole = "admin" | "pk_manager" | "training_manager" | "viewer";
export type TestUser = { email: string; displayName: string; role: TestRole; active?: boolean };

// Kata sandi sintetis untuk akun uji di Supabase lokal; memenuhi SH-AUTH-05.
export const TEST_PASSWORD = "Uji-Sintetis-2026";

export const TEST_USERS = {
  trainingManager: {
    email: "e2e.pengelola@example.test",
    displayName: "Pengelola Uji",
    role: "training_manager",
  },
  viewer: { email: "e2e.viewer@example.test", displayName: "Viewer Uji", role: "viewer" },
  admin: { email: "e2e.admin@example.test", displayName: "Admin Uji", role: "admin" },
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
  return id;
}
