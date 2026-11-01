import { z } from "zod";

export const loginInputSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    password: z.string().min(1).max(128),
    next: z.string().max(2048).optional(),
  })
  .strict();

export type LoginInput = z.infer<typeof loginInputSchema>;

/** Ambil hanya field yang dikenal; FormData juga membawa field internal Next.js. */
export function parseLoginForm(form: FormData) {
  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : undefined;
  };
  return loginInputSchema.safeParse({
    email: field("email") ?? "",
    password: field("password") ?? "",
    next: field("next") || undefined,
  });
}

export const LOGIN_MESSAGES = {
  invalid: "Email atau kata sandi salah.",
  rateLimited: "Terlalu banyak percobaan masuk. Coba lagi beberapa menit lagi.",
  unavailable: "Layanan masuk sedang tidak tersedia. Coba lagi nanti.",
} as const;

export type LoginFailure = keyof typeof LOGIN_MESSAGES;

/** Petakan galat Supabase Auth ke pesan generik; tidak membedakan email tak terdaftar. */
export function classifyAuthError(error: { status?: number; code?: string }): LoginFailure {
  if (error.status === 429 || error.code === "over_request_rate_limit") return "rateLimited";
  if (error.status !== undefined && error.status >= 400 && error.status < 500) return "invalid";
  return "unavailable";
}
