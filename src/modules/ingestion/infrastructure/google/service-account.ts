import { createSign } from "node:crypto";
import { z } from "zod";
import { type GoogleResult, requestJson } from "./http";

/** Akses baca saja (spesifikasi §3.5, §5.1). */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
];

export const TOKEN_URL = "https://oauth2.googleapis.com/token";
const EXPIRY_MARGIN_MS = 60_000;

const tokenResponse = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
  token_type: z.string(),
});

export interface ServiceAccount {
  email: string;
  privateKey: string;
}

/** Kredensial dari environment server; null bila belum diisi (integrasi Google nonaktif). */
export function serviceAccountFromEnv(): ServiceAccount | null {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !key) return null;
  return { email, privateKey: key.replace(/\\n/g, "\n") };
}

const b64url = (value: string) => Buffer.from(value).toString("base64url");

/**
 * Token akses service account (JWT bearer, RFC 7523) ditandatangani sendiri sehingga penukaran
 * token juga melewati jalur HTTP yang divalidasi. Token dipakai ulang sampai 1 menit sebelum habis.
 */
export class GoogleTokenProvider {
  private cached: { token: string; expiresAt: number } | null = null;

  constructor(
    private readonly account: ServiceAccount,
    private readonly now: () => number = Date.now,
  ) {}

  private assertion(): string {
    const iat = Math.floor(this.now() / 1000);
    const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = b64url(
      JSON.stringify({
        iss: this.account.email,
        scope: GOOGLE_SCOPES.join(" "),
        aud: TOKEN_URL,
        iat,
        exp: iat + 3600,
      }),
    );
    const signature = createSign("RSA-SHA256")
      .update(`${header}.${claims}`)
      .sign(this.account.privateKey, "base64url");
    return `${header}.${claims}.${signature}`;
  }

  async token(): Promise<GoogleResult<string>> {
    if (this.cached && this.cached.expiresAt - EXPIRY_MARGIN_MS > this.now()) {
      return { ok: true, data: this.cached.token };
    }
    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: this.assertion(),
    });
    const headers = { "content-type": "application/x-www-form-urlencoded" };
    const init = { method: "POST", body, headers };
    const res = await requestJson({ url: TOKEN_URL, init, schema: tokenResponse });
    if (!res.ok) return res;
    const expiresAt = this.now() + res.data.expires_in * 1000;
    this.cached = { token: res.data.access_token, expiresAt };
    return { ok: true, data: res.data.access_token };
  }
}

let shared: GoogleTokenProvider | null | undefined;

/** Satu penyedia token per proses agar token dipakai ulang antar-request. */
export function sharedGoogleTokens(): GoogleTokenProvider | null {
  if (shared === undefined) {
    const account = serviceAccountFromEnv();
    shared = account ? new GoogleTokenProvider(account) : null;
  }
  return shared;
}
