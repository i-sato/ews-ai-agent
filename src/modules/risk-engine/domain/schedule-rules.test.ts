import { describe, expect, it } from "vitest";
import {
  type PlanItem,
  type ScheduleInput,
  type ScheduleRuleConfig,
  assessScheduleRules,
  calendarDaysBetween,
} from "./schedule-rules";

const cfg: ScheduleRuleConfig = { behindScheduleTolerancePp: 10, moduleDueWarningDays: 3 };
const TODAY = "2026-10-28";

/** Sepuluh item M01..M10, tenggat 21..30 Okt 2026 (satu item per hari). */
const CODES = Array.from({ length: 10 }, (_, i) => `M${String(i + 1).padStart(2, "0")}`);
const planItems = (over: Partial<PlanItem> = {}): PlanItem[] =>
  CODES.map((code, i) => ({
    code,
    required: true,
    dueDate: `2026-10-${String(21 + i)}`,
    ...over,
  }));

/** `done` item pertama selesai, sisanya belum. */
const statuses = (done: number, codes = CODES) =>
  codes.map((code, i) => ({
    code,
    status: i < done ? ("completed" as const) : ("not_started" as const),
  }));

const point = (percentage: number, capturedAt: string, catalogVersion = 1) => ({
  percentage,
  capturedAt,
  catalogVersion,
});

const input = (over: Partial<ScheduleInput> = {}): ScheduleInput => ({
  plan: { approved: true, items: planItems() },
  enrollmentStatus: "in_progress",
  items: statuses(8),
  earlier: point(60, "2026-10-24T03:00:00Z"),
  latest: point(80, "2026-10-28T03:00:00Z"),
  today: TODAY,
  ...over,
});

describe("calendarDaysBetween", () => {
  it("menghitung hari kalender tanpa terpengaruh jam atau zona waktu", () => {
    expect(calendarDaysBetween("2026-10-28", "2026-10-31")).toBe(3);
    expect(calendarDaysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(calendarDaysBetween("2026-10-28", "2026-10-27")).toBe(-1);
  });
});

describe("assessScheduleRules: syarat rencana belajar (§8.2)", () => {
  it("tanpa rencana belajar: not_assessable, bukan normal", () => {
    const r = assessScheduleRules(input({ plan: null }), cfg);
    expect(r).toMatchObject({ status: "not_assessable", reason: "NO_APPROVED_PLAN", rules: [] });
  });

  it("rencana belum disetujui: not_assessable", () => {
    const plan = { approved: false, items: planItems() };
    expect(assessScheduleRules(input({ plan }), cfg).reason).toBe("NO_APPROVED_PLAN");
  });

  it("rencana kosong: not_assessable", () => {
    const plan = { approved: true, items: [] };
    expect(assessScheduleRules(input({ plan }), cfg).reason).toBe("NO_APPROVED_PLAN");
  });

  it("ambang belum dikonfigurasi di versi aturan: not_assessable", () => {
    expect(assessScheduleRules(input(), null)).toMatchObject({
      status: "not_assessable",
      reason: "NO_RULE_CONFIG",
    });
  });

  it("katalog item berubah sehingga kode rencana tidak ada di snapshot: not_assessable", () => {
    const items = statuses(8, [...CODES.slice(0, 9), "M11"]);
    expect(assessScheduleRules(input({ items }), cfg).reason).toBe("PLAN_CATALOG_MISMATCH");
  });

  it("rencana tanpa satu pun tenggat: not_assessable", () => {
    const plan = { approved: true, items: planItems({ dueDate: null }) };
    expect(assessScheduleRules(input({ plan }), cfg).reason).toBe("NO_DUE_DATES");
  });

  it("peserta lulus, batal, atau masih seleksi tidak dinilai", () => {
    for (const enrollmentStatus of ["passed", "cancelled", "in_selection"] as const) {
      expect(assessScheduleRules(input({ enrollmentStatus, plan: null }), cfg)).toMatchObject({
        status: "normal",
        rules: [],
      });
    }
  });
});

describe("BEHIND_SCHEDULE", () => {
  it("contoh §8.4: progres aktual jauh di bawah rencana → waspada", () => {
    // Hari ke-8 dari 10 tenggat: rencana 80%; selesai 4 dari 10 item → 40%.
    const r = assessScheduleRules(
      input({
        items: statuses(4),
        latest: point(40, "2026-10-28T03:00:00Z"),
        earlier: point(30, "2026-10-24T03:00:00Z"),
      }),
      cfg,
    );
    expect(r.rules).toContain("BEHIND_SCHEDULE");
    expect(r.metrics).toMatchObject({ plannedProgress: 80, actualProgress: 40, gapPp: -40 });
  });

  it("selisih dalam toleransi tidak memicu rule", () => {
    const r = assessScheduleRules(input({ items: statuses(7) }), cfg);
    expect(r.metrics.gapPp).toBe(-10);
    expect(r.rules).not.toContain("BEHIND_SCHEDULE");
  });

  it("penyelesaian tidak berurutan dihitung dari jumlah item selesai", () => {
    const items = CODES.map((code, i) => ({
      code,
      status: i % 2 === 0 ? ("completed" as const) : ("not_started" as const),
    }));
    const r = assessScheduleRules(input({ items }), cfg);
    expect(r.metrics.actualProgress).toBe(50);
    expect(r.rules).toContain("BEHIND_SCHEDULE");
  });

  it("item tanpa tenggat tidak masuk perhitungan rencana", () => {
    const plan = {
      approved: true,
      items: [...planItems(), { code: "M11", required: false, dueDate: null }],
    };
    const r = assessScheduleRules(input({ plan, items: statuses(8, [...CODES, "M11"]) }), cfg);
    expect(r.metrics).toMatchObject({ plannedProgress: 80, actualProgress: 80 });
  });

  it("status item tidak diketahui tidak dihitung selesai dan dicatat", () => {
    const items = statuses(8).map((s, i) => (i === 0 ? { ...s, status: "unknown" as const } : s));
    const r = assessScheduleRules(input({ items }), cfg);
    expect(r.metrics.actualProgress).toBe(70);
    expect(r.metrics.unknownItems).toEqual(["M01"]);
  });
});

describe("COMPLETION_AT_RISK", () => {
  it("estimasi penyelesaian melewati tenggat → kritis", () => {
    // Laju 2,5 pp/hari dari 70%: perlu 12 hari, tersisa 3 hari sampai tenggat 30 Okt.
    const r = assessScheduleRules(
      input({
        earlier: point(60, "2026-10-24T03:00:00Z"),
        latest: point(70, "2026-10-28T03:00:00Z"),
        items: statuses(7),
      }),
      cfg,
    );
    expect(r.rules).toContain("COMPLETION_AT_RISK");
    expect(r.status).toBe("critical");
    expect(r.metrics).toMatchObject({
      deadline: "2026-10-30",
      availableDays: 3,
      projectedRemainingDays: 12,
    });
  });

  it("estimasi masih dalam tenggat → tidak terpicu", () => {
    // Laju 10 pp/hari dari 80%: perlu 2 hari, tersedia 3 hari (28–30 Okt).
    const r = assessScheduleRules(input({ earlier: point(40, "2026-10-24T03:00:00Z") }), cfg);
    expect(r.metrics.projectedRemainingDays).toBe(2);
    expect(r.rules).not.toContain("COMPLETION_AT_RISK");
  });

  it("tanpa snapshot sebelumnya: rule tidak dapat dinilai, status not_assessable", () => {
    // Rule lain dapat dinilai dan tidak terpicu (hari ke-2, sudah 5 dari 10 item).
    const latest = point(50, "2026-10-22T03:00:00Z");
    const early = { today: "2026-10-22", items: statuses(5), earlier: null, latest };
    const r = assessScheduleRules(input(early), cfg);
    expect(r.outcomes.find((o) => o.rule === "COMPLETION_AT_RISK")).toMatchObject({
      outcome: "not_assessable",
      reason: "INSUFFICIENT_DATA",
    });
    expect(r.status).toBe("not_assessable");
  });

  it("progres menurun akibat koreksi sumber: proyeksi tidak tersedia, bukan kritis", () => {
    const r = assessScheduleRules(input({ earlier: point(90, "2026-10-24T03:00:00Z") }), cfg);
    expect(r.outcomes.find((o) => o.rule === "COMPLETION_AT_RISK")).toMatchObject({
      outcome: "not_assessable",
      reason: "NON_POSITIVE_VELOCITY",
    });
  });

  it("katalog berubah antarsnapshot: proyeksi tidak dapat dibandingkan", () => {
    const r = assessScheduleRules(
      input({
        earlier: point(60, "2026-10-24T03:00:00Z", 1),
        latest: point(80, "2026-10-28T03:00:00Z", 2),
      }),
      cfg,
    );
    expect(r.outcomes.find((o) => o.rule === "COMPLETION_AT_RISK")?.reason).toBe("CATALOG_CHANGED");
  });

  it("tenggat sudah lewat dan belum tuntas → kritis tanpa perlu proyeksi", () => {
    const r = assessScheduleRules(input({ today: "2026-11-02", earlier: null }), cfg);
    expect(r.rules).toContain("COMPLETION_AT_RISK");
    expect(r.status).toBe("critical");
  });

  it("sudah tuntas 100% tidak berisiko", () => {
    const r = assessScheduleRules(
      input({ items: statuses(10), latest: point(100, "2026-10-28T03:00:00Z"), earlier: null }),
      cfg,
    );
    expect(r).toMatchObject({ status: "normal", rules: [] });
  });
});

describe("MODULE_INCOMPLETE", () => {
  it("item wajib lewat tenggat → kritis; mendekati tenggat → waspada", () => {
    // Hari ini 28 Okt: M01..M07 lewat (21–27), M08 hari ini, M09–M10 dalam 1–2 hari.
    const r = assessScheduleRules(input({ items: statuses(6) }), cfg);
    const outcome = r.outcomes.find((o) => o.rule === "MODULE_INCOMPLETE");
    expect(outcome).toMatchObject({ outcome: "triggered", severity: "critical" });
    expect(r.metrics.overdueRequired).toEqual(["M07"]);
    expect(r.metrics.dueSoonRequired).toEqual(["M08", "M09", "M10"]);
  });

  it("tenggat hari ini belum dianggap lewat (batas akhir periode WIB)", () => {
    const r = assessScheduleRules(input({ items: statuses(7) }), cfg);
    expect(r.metrics.overdueRequired).toEqual([]);
    expect(r.outcomes.find((o) => o.rule === "MODULE_INCOMPLETE")?.severity).toBe("warning");
  });

  it("item opsional yang belum selesai tidak memicu rule", () => {
    const plan = { approved: true, items: planItems({ required: false }) };
    const r = assessScheduleRules(input({ plan, items: statuses(6) }), cfg);
    expect(r.rules).not.toContain("MODULE_INCOMPLETE");
  });

  it("tenggat masih jauh → tidak terpicu", () => {
    const r = assessScheduleRules(
      input({
        today: "2026-10-20",
        items: statuses(0),
        earlier: point(0, "2026-10-16T03:00:00Z"),
        latest: point(0, "2026-10-20T03:00:00Z"),
      }),
      cfg,
    );
    expect(r.metrics.dueSoonRequired).toEqual(["M01", "M02", "M03"]);
    expect(r.metrics.overdueRequired).toEqual([]);
  });
});

describe("status gabungan dan determinisme", () => {
  it("semua rule dapat dinilai dan tidak terpicu → normal", () => {
    const r = assessScheduleRules(
      input({
        today: "2026-10-22",
        items: statuses(5),
        earlier: point(30, "2026-10-20T03:00:00Z"),
        latest: point(50, "2026-10-22T03:00:00Z"),
      }),
      cfg,
    );
    expect(r).toMatchObject({ status: "normal", rules: [] });
  });

  it("lebih dari 42 item tetap dinilai", () => {
    const codes = Array.from({ length: 45 }, (_, i) => `M${String(i + 1).padStart(2, "0")}`);
    const plan = {
      approved: true,
      items: codes.map((code) => ({ code, required: true, dueDate: "2026-10-31" })),
    };
    const r = assessScheduleRules(
      input({ plan, items: statuses(45, codes), latest: point(100, "2026-10-28T03:00:00Z") }),
      cfg,
    );
    expect(r).toMatchObject({ status: "normal", rules: [] });
  });

  it("hasil sama untuk input yang sama", () => {
    expect(assessScheduleRules(input(), cfg)).toEqual(assessScheduleRules(input(), cfg));
  });
});
