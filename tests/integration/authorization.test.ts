// SH-AUTHZ-01: role diverifikasi di server dari tabel profiles, bukan dari klien.
// Butuh `supabase start` dan `pnpm db:env`.
import { beforeAll, describe, expect, it } from "vitest";
import { authorize, loadCurrentUser } from "@/lib/auth/current-user";
import type { Role } from "@/lib/auth/roles";
import {
  TEST_USERS,
  type TestUser,
  anonClient,
  ensureTestUser,
  setUserMetadata,
  signedInClient,
} from "../support/local-supabase";

const ids = new Map<string, string>();

beforeAll(async () => {
  for (const user of Object.values(TEST_USERS)) ids.set(user.email, await ensureTestUser(user));
});

const ROLE_USERS: [Role, TestUser][] = [
  ["admin", TEST_USERS.admin],
  ["pk_manager", TEST_USERS.pkManager],
  ["training_manager", TEST_USERS.trainingManager],
  ["viewer", TEST_USERS.viewer],
];

describe("matriks role × izin", () => {
  const cases: [string, readonly Role[], Role[]][] = [
    ["khusus admin", ["admin"], ["admin"]],
    ["lintas tim", ["admin", "pk_manager"], ["admin", "pk_manager"]],
    ["pengelola", ["admin", "training_manager"], ["admin", "training_manager"]],
  ];

  for (const [name, allowed, expected] of cases) {
    it.each(ROLE_USERS)(`${name}: %s`, async (role, user) => {
      const result = await authorize(await signedInClient(user), allowed);
      if (expected.includes(role)) expect(result).toMatchObject({ ok: true, user: { role } });
      else expect(result).toEqual({ ok: false, reason: "forbidden" });
    });
  }
});

describe("sumber role", () => {
  it("tanpa sesi ditolak sebagai belum masuk", async () => {
    expect(await authorize(anonClient())).toEqual({ ok: false, reason: "unauthenticated" });
  });

  it("user_metadata.role yang dipalsukan diabaikan", async () => {
    const viewer = TEST_USERS.viewer;
    await setUserMetadata(ids.get(viewer.email) ?? "", { role: "admin" });
    const client = await signedInClient(viewer);
    const { data } = await client.auth.getUser();
    expect(data.user?.user_metadata.role).toBe("admin");

    expect(await authorize(client, ["admin"])).toEqual({ ok: false, reason: "forbidden" });
    expect(await loadCurrentUser(client)).toMatchObject({ ok: true, user: { role: "viewer" } });
    await setUserMetadata(ids.get(viewer.email) ?? "", {});
  });

  it("profil nonaktif ditolak walaupun kata sandi benar", async () => {
    const result = await authorize(await signedInClient(TEST_USERS.inactive));
    expect(result).toEqual({ ok: false, reason: "inactive" });
  });

  it("pengguna tidak dapat mengubah role sendiri lewat API", async () => {
    const user = TEST_USERS.trainingManager;
    const client = await signedInClient(user);
    const { error } = await client
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", ids.get(user.email) ?? "");
    expect(error?.code).toBe("42501");
    expect(await loadCurrentUser(client)).toMatchObject({ user: { role: "training_manager" } });
  });
});

describe("cakupan tim kerja (keputusan no. 1, usulan bawaan)", () => {
  it("pengelola pelatihan terbatas ke timnya", async () => {
    const result = await loadCurrentUser(await signedInClient(TEST_USERS.trainingManager));
    expect(result).toMatchObject({ ok: true, user: { crossTeam: false } });
    expect(result.ok && result.user.workTeamIds).toHaveLength(1);
  });

  it("admin dan pengelola PK lintas tim", async () => {
    for (const user of [TEST_USERS.admin, TEST_USERS.pkManager]) {
      const result = await loadCurrentUser(await signedInClient(user));
      expect(result).toMatchObject({ ok: true, user: { crossTeam: true } });
    }
  });
});
