import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabasePublicConfig } from "@/lib/supabase/config";

/**
 * Klien service role (melewati RLS). Hanya di server dan hanya dipakai adapter infrastructure
 * setelah use case memeriksa otorisasi (SH-SECRET-01; dijaga aturan lint).
 */
export function createSupabaseServiceClient(): SupabaseClient {
  if (typeof window !== "undefined") throw new Error("Service role hanya boleh dipakai di server.");
  const key = z.string().min(1).parse(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return createClient(supabasePublicConfig().url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
