-- Seed referensi (bukan data peserta). Dijalankan oleh `supabase db reset`.
-- Indikator disemai berstatus draft; Pengelola PK menyetujuinya lewat aplikasi (spesifikasi §9.4).

insert into public.work_teams (code, name, alias) values
  ('GTA', 'Government Transformation Academy', 'ASN Digital'),
  ('KDD', 'Keterampilan Digital Dasar', null),
  ('DTA', 'Digital Talent Academy', 'Talenta Digital');

insert into public.work_team_years (work_team_id, year, monthly_template_id, annual_template_id)
select id, 2026,
  '1U0OliACRPKCughuWex3RGxwJieXOjUACX_oiOPLQxnU',
  '1qMGuESTtjpFn5Dfp5wUqdDzBNTVJEnZ_vEHKbydMbPk'
from public.work_teams;

insert into public.report_templates (report_scope, template_reference, placeholders) values
  ('monthly', '1U0OliACRPKCughuWex3RGxwJieXOjUACX_oiOPLQxnU',
   array['{{Nama_Program}}', '{{MM_month}}', '{{YY_year}}', '{{Detail_Laporan}}']),
  ('annual', '1qMGuESTtjpFn5Dfp5wUqdDzBNTVJEnZ_vEHKbydMbPk',
   array['{{Nama_Tim_Kerja}}', '{{YY_year}}', '{{Detail_Laporan}}']);

insert into public.pk_documents (year, source_kind, title) values
  (2026, 'sheet', 'PK'),
  (2026, 'docs', 'PK_2026'),
  (2026, 'pdf', 'PK_2026');

with doc as (
  select id from public.pk_documents where year = 2026 and source_kind = 'sheet'
), team as (
  select code, id from public.work_teams
)
insert into public.pk_indicators (
  pk_document_id, code, definition, work_team_id, indicator_type, unit,
  target_value, baseline_value, participant_rule, pass_rule, recognized_levels,
  period_start, period_end
)
select doc.id, v.code, v.definition, team.id, v.indicator_type, v.unit,
  v.target_value, v.baseline_value, v.participant_rule::jsonb, v.pass_rule::jsonb,
  v.recognized_levels, date '2026-01-01', date '2026-12-31'
from doc, (values
  ('IKSK 1.1',
   'Persentase peserta pelatihan SDM bidang komdigi yang bertalenta digital (DEX, VBL non-sertifikasi)',
   'DTA', 'percentage', '%', 87, 87,
   '{"lms_percentage_gte": 90, "certification_type": "non_certification"}',
   '{"source_status_in": ["Lulus Pelatihan - Nilai"], "certificate": "completion"}',
   array['basic']),
  ('IKSK 2.1',
   'Persentase peserta pelatihan SDM aparatur bidang komdigi yang bertalenta digital',
   'GTA', 'percentage', '%', 99, 99,
   '{"live": {"attendance_pct_gte": 90}, "self_paced": {"lms_activity_pct_gte": 90}}',
   '{"live": {"absence_pct_lte": 10, "final_score_gte": 65}, "self_paced": {"all_lms_activities": true}}',
   array[]::text[]),
  ('IKSK 3.1',
   'Persentase peserta pelatihan keterampilan dasar yang mengalami peningkatan keterampilan digital',
   'KDD', 'percentage', '%', 95, 95,
   '{"activity_pct_gte": 90}',
   '{"post_test_gte": 60, "task_required_for_themes": true}',
   array[]::text[]),
  ('IKSK 3.2',
   'Jumlah peserta pelatihan SDM bidang komdigi yang bertalenta digital (kumulatif)',
   null, 'cumulative_count', 'orang', 78319, 54969,
   '{}',
   '{"completed_training": true}',
   array[]::text[])
) as v(code, definition, team_code, indicator_type, unit, target_value, baseline_value,
       participant_rule, pass_rule, recognized_levels)
left join team on team.code = v.team_code;

-- Target antara bulanan (spesifikasi §8.7).
insert into public.pk_indicator_targets (pk_indicator_id, month, target_value)
select i.id, m, case
    when i.code = 'IKSK 1.1' then case when m <= 4 then 0 else 87 end
    when i.code = 'IKSK 2.1' then case when m <= 3 then 0 else 99 end
    when i.code = 'IKSK 3.1' then case when m <= 3 then 0 else 95 end
  end
from public.pk_indicators i, generate_series(1, 12) as m
where i.code in ('IKSK 1.1', 'IKSK 2.1', 'IKSK 3.1');

-- IKSK 3.2: baru Oktober dan November yang terverifikasi; bulan lain diisi dari Manual PK hlm. 8–10.
insert into public.pk_indicator_targets (pk_indicator_id, month, target_value, action_plan)
select i.id, m.month, m.target_value, m.note
from public.pk_indicators i, (values
  (10, 75969::numeric, null::text),
  (11, 78319, null),
  (12, 78319, 'Sama dengan target tahunan; konfirmasi ke Manual PK')
) as m(month, target_value, note)
where i.code = 'IKSK 3.2';

-- Ambang di bawah adalah contoh awal, bukan aturan resmi; wajib disetujui Pengelola PK (§8.2).
insert into public.risk_rule_versions (version, configuration, effective_at) values
  ('1.1', '{
    "not_started_days": 3,
    "not_started_critical_remaining_days": 3,
    "stagnant_days": 5,
    "pass_pending_days_before_end": 7,
    "lms_consistency_tolerance_pp": 1,
    "freshness_threshold_hours": 72
  }', '2026-10-01T00:00:00+07:00'),
  -- 1.2 (F3-04): menambah ambang BEHIND_SCHEDULE dan MODULE_INCOMPLETE. Tetap contoh, belum disetujui.
  ('1.2', '{
    "not_started_days": 3,
    "not_started_critical_remaining_days": 3,
    "stagnant_days": 5,
    "pass_pending_days_before_end": 7,
    "lms_consistency_tolerance_pp": 1,
    "freshness_threshold_hours": 72,
    "behind_schedule_tolerance_pp": 10,
    "module_due_warning_days": 3
  }', '2026-11-01T00:00:00+07:00'),
  -- 1.3 (F3-05): jendela tren proyeksi indikator. DATA_STALE memakai freshness_threshold_hours.
  ('1.3', '{
    "not_started_days": 3,
    "not_started_critical_remaining_days": 3,
    "stagnant_days": 5,
    "pass_pending_days_before_end": 7,
    "lms_consistency_tolerance_pp": 1,
    "freshness_threshold_hours": 72,
    "behind_schedule_tolerance_pp": 10,
    "module_due_warning_days": 3,
    "indicator_projection_window_days": 30
  }', '2026-11-02T00:00:00+07:00');
