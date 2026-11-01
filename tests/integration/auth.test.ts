// Supabase Auth lokal: pendaftaran mandiri ditolak (SH-AUTH-03), logout mencabut refresh token
// (SH-SESS-03). Butuh `supabase start` dan `pnpm db:env`.
import { beforeAll, describe, expect, it } from "vitest";
import { TEST_PASSWORD, TEST_USERS, anonClient, ensureTestUser } from "../support/local-supabase";

const user = TEST_USERS.trainingManager;

beforeAll(async () => {
  await ensureTestUser(user);
});

describe("SH-AUTH-03 pendaftaran mandiri", () => {
  it("signup ditolak", async () => {
    const { data, error } = await anonClient().auth.signUp({
      email: "pendaftar.baru@example.test",
      password: TEST_PASSWORD,
    });
    expect(data.user).toBeNull();
    expect(error?.code).toBe("signup_disabled");
  });
});

describe("SH-AUTH-05 kebijakan kata sandi", () => {
  it("kata sandi lemah ditolak", async () => {
    const client = anonClient();
    await client.auth.signInWithPassword({ email: user.email, password: TEST_PASSWORD });
    const { error } = await client.auth.updateUser({ password: "pendek" });
    expect(error?.code).toBe("weak_password");
  });
});

describe("SH-SESS-03 logout", () => {
  it("refresh token tidak dapat dipakai lagi setelah signOut", async () => {
    const client = anonClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: user.email,
      password: TEST_PASSWORD,
    });
    expect(error).toBeNull();
    const refreshToken = data.session?.refresh_token ?? "";
    const accessToken = data.session?.access_token ?? "";

    await client.auth.signOut({ scope: "local" });

    const other = anonClient();
    const refreshed = await other.auth.refreshSession({ refresh_token: refreshToken });
    expect(refreshed.data.session).toBeNull();
    expect(refreshed.error).not.toBeNull();

    const current = await other.auth.getUser(accessToken);
    expect(current.data.user).toBeNull();
  });
});
