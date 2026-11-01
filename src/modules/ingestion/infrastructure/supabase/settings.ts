import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const configuration = z.object({ lms_consistency_tolerance_pp: z.number().min(0) });

/**
 * Toleransi konsistensi LMS dari versi aturan risiko yang berlaku (`effective_at` ≤ sekarang).
 * Persetujuan versi aturan ditegakkan di F3-07.
 */
export async function activeLmsTolerance(writer: SupabaseClient, now: Date): Promise<number> {
  const { data, error } = await writer
    .from("risk_rule_versions")
    .select("configuration")
    .lte("effective_at", now.toISOString())
    .order("effective_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`risk_rule_versions gagal dibaca (${error.code})`);
  if (!data) throw new Error("Belum ada versi aturan risiko yang berlaku.");
  return configuration.parse(data.configuration).lms_consistency_tolerance_pp;
}
