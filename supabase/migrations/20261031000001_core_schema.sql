-- Skema inti EWS AI Agent (spesifikasi §6.1, §6.2).
-- Perubahan berikutnya memakai migration baru; file ini tidak diedit setelah diterapkan.

-- gen_random_uuid() bawaan PostgreSQL 13+, tanpa ekstensi tambahan.

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Organisasi, pengguna, tim kerja ------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'viewer'
    check (role in ('admin', 'pk_manager', 'training_manager', 'viewer')),
  organization_id uuid references public.organizations(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.work_teams (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z]{2,6}$'),
  name text not null,
  alias text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Keanggotaan tim untuk pembatasan akses (keputusan §15.1 no. 1).
create table public.profile_work_teams (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  work_team_id uuid not null references public.work_teams(id),
  primary key (profile_id, work_team_id)
);

create table public.work_team_years (
  id uuid primary key default gen_random_uuid(),
  work_team_id uuid not null references public.work_teams(id),
  year int not null check (year between 2020 and 2100),
  report_folder_id text,
  monthly_template_id text,
  annual_template_id text,
  unique (work_team_id, year)
);

-- Pelatihan dan sumber data -------------------------------------------------

create table public.trainings (
  id uuid primary key default gen_random_uuid(),
  work_team_year_id uuid not null references public.work_team_years(id),
  code text not null unique,
  name text not null,
  scheme_code text,
  level text check (level in ('basic', 'intermediate', 'advanced')),
  delivery_method text check (delivery_method in ('live', 'self_paced', 'blended')),
  certification_type text check (certification_type in ('non_certification', 'certification')),
  portal_url text,
  portal_training_id text unique check (portal_training_id ~ '^[0-9]{4,6}$'),
  id_confirmed_by uuid not null references public.profiles(id),
  id_confirmed_at timestamptz not null,
  registration_start date,
  registration_end date,
  start_date date,
  end_date date,
  schedule_source text check (schedule_source in ('manual', 'official_api')),
  schedule_verified_by uuid references public.profiles(id),
  schedule_verified_at timestamptz,
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date),
  check (registration_end is null or start_date is null or registration_end <= start_date)
);

create table public.data_sources (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings(id),
  source_type text not null check (source_type in ('google_sheets', 'csv', 'xlsx')),
  spreadsheet_id text,
  gid text,
  layout jsonb not null default '{"metadata_row":1,"header_row":2,"data_start_row":3}',
  column_mapping jsonb not null default '{}',
  header_aliases jsonb not null default '{}',
  status_mapping jsonb not null default '{}',
  sync_schedule text,
  freshness_threshold interval not null default interval '3 days',
  last_fetched_at timestamptz,
  source_modified_at timestamptz,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.data_sources(id),
  source_type text not null check (source_type in ('google_sheets', 'csv', 'xlsx')),
  source_reference text,
  status text not null default 'staged'
    check (status in ('staged', 'committed', 'rejected', 'expired', 'unchanged')),
  idempotency_key text unique,
  row_counts jsonb not null default '{}',
  ignored_counts jsonb not null default '{}',
  reconciliation jsonb not null default '{}',
  detected_layout jsonb not null default '{}',
  content_hash text,
  fetched_at timestamptz not null default now(),
  content_changed_at timestamptz,
  source_updated_at timestamptz,
  source_updated_at_uncertain boolean not null default false,
  expires_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.data_sources(id),
  trigger text not null check (trigger in ('scheduled', 'manual')),
  import_batch_id uuid references public.import_batches(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'unchanged', 'failed')),
  error_summary text,
  requested_by uuid references public.profiles(id)
);

-- Peserta dan progres --------------------------------------------------------

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  participant_number text not null unique,
  name text not null,
  organization_id uuid references public.organizations(id),
  anonymized_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.training_enrollments (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings(id),
  participant_id uuid not null references public.participants(id),
  source_status text,
  enrollment_status text not null default 'unmapped'
    check (enrollment_status in ('passed', 'not_passed', 'cancelled', 'in_progress', 'unmapped')),
  onboarding_status boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (training_id, participant_id)
);

create table public.training_modules (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings(id),
  catalog_version int not null default 1,
  catalog_status text not null default 'draft'
    check (catalog_status in ('draft', 'approved', 'superseded')),
  module_code text not null,
  name text not null,
  source_name text not null,
  module_type text not null
    check (module_type in ('overview', 'material', 'video', 'quiz', 'final_assessment')),
  unit_group text,
  sequence int not null check (sequence > 0),
  source_column text,
  created_at timestamptz not null default now(),
  unique (training_id, catalog_version, sequence)
);

create table public.training_learning_plans (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings(id),
  module_id uuid not null references public.training_modules(id),
  is_required boolean not null default true,
  planned_due_date date,
  origin text not null default 'manual' check (origin in ('manual', 'ai_suggestion')),
  version int not null default 1,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  unique (training_id, module_id, version)
);

create table public.participant_progress_snapshots (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.training_enrollments(id),
  completion_percentage numeric(5,2) check (completion_percentage between 0 and 100),
  completed_items int check (completed_items >= 0),
  total_items int check (total_items >= 0),
  quality_flags text[] not null default '{}',
  captured_at timestamptz not null default now(),
  import_batch_id uuid not null references public.import_batches(id),
  unique (enrollment_id, import_batch_id)
);

create table public.participant_module_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.training_enrollments(id),
  module_id uuid not null references public.training_modules(id),
  status text not null check (status in ('completed', 'in_progress', 'not_started', 'unknown')),
  completion_percentage numeric(5,2) check (completion_percentage between 0 and 100),
  captured_at timestamptz not null default now(),
  import_batch_id uuid not null references public.import_batches(id),
  unique (enrollment_id, module_id, import_batch_id)
);

-- Indikator PK ---------------------------------------------------------------

create table public.pk_documents (
  id uuid primary key default gen_random_uuid(),
  year int not null check (year between 2020 and 2100),
  source_kind text not null check (source_kind in ('sheet', 'docs', 'pdf')),
  drive_file_id text,
  title text not null,
  version int not null default 1,
  storage_path text,
  checksum text,
  approval_status text not null default 'draft'
    check (approval_status in ('draft', 'approved', 'superseded')),
  created_at timestamptz not null default now(),
  unique (year, source_kind, version)
);

create table public.pk_indicators (
  id uuid primary key default gen_random_uuid(),
  pk_document_id uuid references public.pk_documents(id),
  goal_code text,
  code text not null,
  definition text not null,
  work_team_id uuid references public.work_teams(id), -- null = lintas tim
  indicator_type text not null
    check (indicator_type in ('percentage', 'cumulative_count', 'out_of_scope')),
  unit text not null,
  target_value numeric(12,2),
  baseline_value numeric(12,2),
  polarity text not null default 'higher_is_better'
    check (polarity in ('higher_is_better', 'lower_is_better')),
  participant_rule jsonb not null default '{}',
  pass_rule jsonb not null default '{}',
  recognized_levels text[] not null default '{}',
  reporting_period text not null default 'monthly',
  period_start date not null,
  period_end date not null,
  version int not null default 1,
  approval_status text not null default 'draft'
    check (approval_status in ('draft', 'ai_suggested', 'approved', 'superseded')),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (code, period_start, version),
  check (period_end >= period_start),
  check (indicator_type = 'out_of_scope' or target_value > 0)
);

create table public.pk_indicator_targets (
  id uuid primary key default gen_random_uuid(),
  pk_indicator_id uuid not null references public.pk_indicators(id),
  month int not null check (month between 1 and 12),
  target_value numeric(12,2) check (target_value >= 0),
  action_plan text,
  unique (pk_indicator_id, month)
);

create table public.training_indicator_mappings (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings(id),
  pk_indicator_id uuid not null references public.pk_indicators(id),
  mapping_status text not null default 'draft'
    check (mapping_status in ('draft', 'ai_suggested', 'approved', 'rejected')),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  unique (training_id, pk_indicator_id)
);

-- Risiko dan tindak lanjut ---------------------------------------------------

create table public.risk_rule_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  configuration jsonb not null,
  approved_by uuid references public.profiles(id),
  effective_at timestamptz not null
);

create table public.risk_assessments (
  id uuid primary key default gen_random_uuid(),
  training_id uuid references public.trainings(id),
  enrollment_id uuid references public.training_enrollments(id),
  indicator_id uuid references public.pk_indicators(id),
  status text not null
    check (status in ('critical', 'warning', 'normal', 'stale', 'invalid', 'not_assessable')),
  triggered_rules text[] not null default '{}',
  score numeric(6,2),
  evidence jsonb not null,
  rule_version_id uuid not null references public.risk_rule_versions(id),
  assessed_at timestamptz not null default now(),
  check (training_id is not null or indicator_id is not null)
);

create table public.followup_actions (
  id uuid primary key default gen_random_uuid(),
  risk_assessment_id uuid not null references public.risk_assessments(id),
  description text not null,
  origin text not null default 'manual' check (origin in ('manual', 'ai_suggestion')),
  owner_id uuid references public.profiles(id),
  due_date date,
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'dropped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Laporan --------------------------------------------------------------------

create table public.report_templates (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'google_docs',
  report_scope text not null check (report_scope in ('training', 'monthly', 'annual')),
  template_reference text not null,
  placeholders text[] not null default '{}',
  version int not null default 1,
  status text not null default 'active' check (status in ('active', 'retired')),
  unique (report_scope, template_reference, version)
);

create table public.generated_reports (
  id uuid primary key default gen_random_uuid(),
  work_team_year_id uuid not null references public.work_team_years(id),
  report_scope text not null check (report_scope in ('training', 'monthly', 'annual')),
  period_start date not null,
  period_end date not null,
  data_cutoff_at timestamptz not null,
  is_provisional boolean not null default false,
  template_id uuid references public.report_templates(id),
  status text not null default 'draft'
    check (status in ('draft', 'validated', 'pending_approval', 'approved', 'published', 'failed')),
  document_reference text,
  idempotency_key text unique,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table public.report_trainings (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.generated_reports(id) on delete cascade,
  training_id uuid not null references public.trainings(id),
  status_at_cutoff text not null
    check (status_at_cutoff in ('completed', 'in_progress', 'planned', 'cancelled')),
  import_batch_id uuid references public.import_batches(id),
  included boolean not null default true,
  exclusion_reason text,
  unique (report_id, training_id),
  check (included or exclusion_reason is not null)
);

create table public.report_assets (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.generated_reports(id) on delete cascade,
  kind text not null check (kind in ('table', 'image', 'pdf')),
  storage_path text not null,
  checksum text not null,
  created_at timestamptz not null default now()
);

-- Audit dan AI ---------------------------------------------------------------

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  resource_type text not null,
  resource_id text,
  details jsonb not null default '{}', -- tanpa PII, secret, atau isi dokumen
  request_id text,
  created_at timestamptz not null default now()
);

create table public.ai_provider_configs (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('gemini', 'anthropic', 'openai')),
  model text not null,
  secret_ref text, -- referensi ke secret manager / vault, bukan key
  key_last4 text check (key_last4 is null or length(key_last4) = 4),
  is_active boolean not null default false,
  max_output_tokens int not null default 2048 check (max_output_tokens > 0),
  timeout_ms int not null default 30000 check (timeout_ms > 0),
  monthly_budget_usd numeric(10,2),
  key_rotated_at timestamptz,
  validated_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index uq_ai_provider_single_active
  on public.ai_provider_configs(is_active) where is_active;

create table public.ai_usage_logs (
  id bigint generated always as identity primary key,
  provider text not null,
  model text not null,
  actor_id uuid references public.profiles(id),
  input_tokens int,
  output_tokens int,
  duration_ms int,
  estimated_cost_usd numeric(10,4),
  assessment_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Indeks ---------------------------------------------------------------------

create index idx_trainings_team_year on public.trainings(work_team_year_id);
create index idx_trainings_status on public.trainings(status);
create index idx_trainings_period on public.trainings(start_date, end_date);
create index idx_data_sources_training on public.data_sources(training_id);
create index idx_import_batches_source on public.import_batches(source_id, fetched_at desc);
create index idx_enrollments_training on public.training_enrollments(training_id);
create index idx_enrollments_participant on public.training_enrollments(participant_id);
create index idx_modules_training on public.training_modules(training_id);
create index idx_progress_enrollment_time
  on public.participant_progress_snapshots(enrollment_id, captured_at desc);
create index idx_module_progress_module on public.participant_module_progress(module_id);
create index idx_module_progress_enrollment
  on public.participant_module_progress(enrollment_id, captured_at desc);
create index idx_pk_targets_indicator on public.pk_indicator_targets(pk_indicator_id);
create index idx_mappings_indicator on public.training_indicator_mappings(pk_indicator_id);
create index idx_risk_training_status on public.risk_assessments(training_id, status);
create index idx_risk_indicator on public.risk_assessments(indicator_id, assessed_at desc);
create index idx_reports_team_period on public.generated_reports(work_team_year_id, period_start);
create index idx_audit_resource on public.audit_logs(resource_type, resource_id);

-- Trigger updated_at -----------------------------------------------------------

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_trainings_updated before update on public.trainings
  for each row execute function public.set_updated_at();
create trigger trg_data_sources_updated before update on public.data_sources
  for each row execute function public.set_updated_at();
create trigger trg_enrollments_updated before update on public.training_enrollments
  for each row execute function public.set_updated_at();
create trigger trg_followups_updated before update on public.followup_actions
  for each row execute function public.set_updated_at();
create trigger trg_reports_updated before update on public.generated_reports
  for each row execute function public.set_updated_at();
create trigger trg_ai_configs_updated before update on public.ai_provider_configs
  for each row execute function public.set_updated_at();
