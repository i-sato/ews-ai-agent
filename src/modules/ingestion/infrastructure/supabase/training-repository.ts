import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AuditEntry,
  AuditLog,
  NewDataSource,
  NewTraining,
  TrainingRepository,
} from "../../application/ports";

function failed(operation: string, error: { code?: string } | null): never {
  throw new Error(`${operation} gagal (${error?.code ?? "unknown"})`);
}

/**
 * Service role: pemeriksaan ID ganda harus melihat pelatihan semua tim (§3.7). Hanya dipakai
 * RegisterTraining/ParseTrainingSource yang khusus Admin.
 */
export class SupabaseTrainingRepository implements TrainingRepository {
  constructor(private readonly writer: SupabaseClient) {}

  async teamCodes(): Promise<string[]> {
    const { data, error } = await this.writer.from("work_teams").select("code").eq("active", true);
    if (error) failed("TrainingRepository.teamCodes", error);
    return (data ?? []).map((r) => String(r.code));
  }

  async findWorkTeamYear(teamCode: string, year: number): Promise<{ id: string } | null> {
    const { data, error } = await this.writer
      .from("work_team_years")
      .select("id, work_teams!inner(code)")
      .eq("work_teams.code", teamCode)
      .eq("year", year)
      .maybeSingle();
    if (error) failed("TrainingRepository.findWorkTeamYear", error);
    return data ? { id: String(data.id) } : null;
  }

  async findByPortalTrainingId(portalTrainingId: string) {
    const { data, error } = await this.writer
      .from("trainings")
      .select("id, code")
      .eq("portal_training_id", portalTrainingId)
      .maybeSingle();
    if (error) failed("TrainingRepository.findByPortalTrainingId", error);
    return data ? { id: String(data.id), code: String(data.code) } : null;
  }

  async createWithSource(training: NewTraining, source: NewDataSource): Promise<void> {
    const { error } = await this.writer.rpc("ingestion_register_training", {
      p_training: training,
      p_source: source,
    });
    if (error) failed("TrainingRepository.createWithSource", error);
  }
}

/** Audit log ditulis server (service role); klien tidak dapat menulis (pgTAP rls.test.sql). */
export class SupabaseAuditLog implements AuditLog {
  constructor(private readonly writer: SupabaseClient) {}

  async record(entry: AuditEntry): Promise<void> {
    const { error } = await this.writer.from("audit_logs").insert({
      actor_id: entry.actorId,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId,
      details: entry.details,
    });
    if (error) failed("AuditLog.record", error);
  }
}
