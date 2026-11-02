import { describe, expect, it } from "vitest";
import { parseRuleConfig } from "@/modules/risk-engine/application/rule-config";

const v11 = {
  not_started_days: 3,
  not_started_critical_remaining_days: 3,
  stagnant_days: 5,
  pass_pending_days_before_end: 7,
  lms_consistency_tolerance_pp: 1,
  freshness_threshold_hours: 72,
};

describe("parseRuleConfig", () => {
  it("versi 1.1 tanpa ambang jadwal: rule jadwal belum dikonfigurasi", () => {
    const r = parseRuleConfig(v11);
    expect(r.ok && r.value.schedule).toBeNull();
    expect(r.ok && r.value.participant.stagnantDays).toBe(5);
  });

  it("versi 1.2 memuat ambang jadwal", () => {
    const r = parseRuleConfig({
      ...v11,
      behind_schedule_tolerance_pp: 10,
      module_due_warning_days: 3,
    });
    expect(r.ok && r.value.schedule).toEqual({
      behindScheduleTolerancePp: 10,
      moduleDueWarningDays: 3,
    });
  });

  it("ambang jadwal tidak lengkap atau di luar rentang ditolak", () => {
    expect(parseRuleConfig({ ...v11, behind_schedule_tolerance_pp: 10 })).toMatchObject({
      ok: false,
      fields: ["module_due_warning_days"],
    });
    const bad = { ...v11, behind_schedule_tolerance_pp: 150, module_due_warning_days: 3 };
    expect(parseRuleConfig(bad).ok).toBe(false);
  });

  it("versi 1.1: ambang kesegaran terbaca, jendela proyeksi belum ada", () => {
    const r = parseRuleConfig(v11);
    expect(r.ok && r.value.freshnessThresholdHours).toBe(72);
    expect(r.ok && r.value.projectionWindowDays).toBeNull();
  });

  it("versi 1.3 memuat jendela proyeksi indikator", () => {
    const r = parseRuleConfig({ ...v11, indicator_projection_window_days: 30 });
    expect(r.ok && r.value.projectionWindowDays).toBe(30);
  });

  it("ambang kesegaran atau jendela tidak valid ditolak", () => {
    expect(parseRuleConfig({ ...v11, freshness_threshold_hours: 0 })).toMatchObject({
      ok: false,
      fields: ["freshness_threshold_hours"],
    });
    expect(parseRuleConfig({ ...v11, indicator_projection_window_days: 0 }).ok).toBe(false);
    const { freshness_threshold_hours: _f, ...noFreshness } = v11;
    void _f;
    const r = parseRuleConfig(noFreshness);
    expect(r.ok && r.value.freshnessThresholdHours).toBeNull();
  });

  it("ambang rule individu wajib ada; tanpa nilai bawaan", () => {
    const missing: Record<string, number> = { ...v11 };
    delete missing.stagnant_days;
    expect(parseRuleConfig(missing)).toMatchObject({ ok: false, fields: ["stagnant_days"] });
    expect(parseRuleConfig(null).ok).toBe(false);
    expect(parseRuleConfig({ ...v11, not_started_days: -1 }).ok).toBe(false);
  });
});
