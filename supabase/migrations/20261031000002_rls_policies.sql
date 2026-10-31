-- RLS dan grant minimum (SH-AUTHZ-01, SH-AUTHZ-02, keputusan §15.1 no. 1).
--
-- Model akses:
--   admin, pk_manager      : lintas tim kerja
--   training_manager       : tim kerja sendiri (profile_work_teams), boleh menulis data pelatihan
--   viewer                 : tim kerja sendiri, hanya agregat; tidak membaca data peserta
-- Tulis data hasil impor, snapshot, assessment, dan audit dilakukan server (service role)
-- setelah use case memeriksa otorisasi. Klien tidak pernah memegang service role.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.current_app_role() returns text
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.active
$$;

create or replace function private.is_cross_team() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.current_app_role() in ('admin', 'pk_manager'), false)
$$;

create or replace function private.has_role(roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.current_app_role() = any(roles), false)
$$;

create or replace function private.can_access_team(team_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_cross_team() or exists (
    select 1 from public.profile_work_teams m
    join public.profiles p on p.id = m.profile_id and p.active
    where m.profile_id = auth.uid() and m.work_team_id = team_id
  )
$$;

create or replace function private.training_team(training_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select y.work_team_id from public.trainings t
  join public.work_team_years y on y.id = t.work_team_year_id
  where t.id = training_id
$$;

create or replace function private.can_access_training(training_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_access_team(private.training_team(training_id))
$$;

create or replace function private.can_manage_training(training_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role(array['admin'])
    or (private.has_role(array['training_manager']) and private.can_access_training(training_id))
$$;

create or replace function private.can_read_participants(training_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not private.has_role(array['viewer']) and private.can_access_training(training_id)
$$;

create or replace function private.enrollment_training(enrollment_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select e.training_id from public.training_enrollments e where e.id = enrollment_id
$$;

create or replace function private.report_team(report_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select y.work_team_id from public.generated_reports r
  join public.work_team_years y on y.id = r.work_team_year_id
  where r.id = report_id
$$;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;

-- Grant minimum ----------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

grant select on all tables in schema public to authenticated;
grant insert, update on public.trainings, public.data_sources, public.training_learning_plans,
  public.followup_actions, public.training_indicator_mappings, public.pk_documents,
  public.pk_indicators, public.pk_indicator_targets, public.risk_rule_versions,
  public.generated_reports, public.report_trainings to authenticated;

-- Aktifkan RLS di semua tabel ----------------------------------------------------

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('alter table public.%I force row level security', t.tablename);
  end loop;
end $$;

-- Referensi umum ------------------------------------------------------------------

create policy read_all on public.organizations for select to authenticated
  using (private.current_app_role() is not null);
create policy read_all on public.work_teams for select to authenticated
  using (private.current_app_role() is not null);
create policy read_all on public.work_team_years for select to authenticated
  using (private.current_app_role() is not null);

create policy read_self_or_admin on public.profiles for select to authenticated
  using (id = auth.uid() or private.has_role(array['admin']));
create policy read_self_or_admin on public.profile_work_teams for select to authenticated
  using (profile_id = auth.uid() or private.has_role(array['admin']));

-- Pelatihan dan sumber ------------------------------------------------------------

create policy read_team on public.trainings for select to authenticated
  using (private.can_access_training(id));
create policy insert_manager on public.trainings for insert to authenticated
  with check (id_confirmed_by = auth.uid());
-- Restrictive: harus juga lolos syarat role dan tim.
create policy insert_manager_team on public.trainings as restrictive for insert to authenticated
  with check (
    private.has_role(array['admin'])
    or (private.has_role(array['training_manager']) and private.can_access_team(
      (select y.work_team_id from public.work_team_years y where y.id = work_team_year_id)))
  );
create policy update_manager on public.trainings for update to authenticated
  using (private.can_manage_training(id)) with check (private.can_manage_training(id));

create policy read_team on public.data_sources for select to authenticated
  using (private.can_access_training(training_id));
create policy write_manager on public.data_sources for insert to authenticated
  with check (private.can_manage_training(training_id));
create policy update_manager on public.data_sources for update to authenticated
  using (private.can_manage_training(training_id))
  with check (private.can_manage_training(training_id));

create policy read_team on public.import_batches for select to authenticated
  using (private.can_access_training(
    (select s.training_id from public.data_sources s where s.id = source_id)));
create policy read_team on public.sync_runs for select to authenticated
  using (private.can_access_training(
    (select s.training_id from public.data_sources s where s.id = source_id)));

create policy read_team on public.training_modules for select to authenticated
  using (private.can_access_training(training_id));
create policy read_team on public.training_learning_plans for select to authenticated
  using (private.can_access_training(training_id));
create policy write_manager on public.training_learning_plans for insert to authenticated
  with check (private.can_manage_training(training_id));
create policy update_manager on public.training_learning_plans for update to authenticated
  using (private.can_manage_training(training_id))
  with check (private.can_manage_training(training_id));

-- Data peserta (bukan untuk viewer) ---------------------------------------------

create policy read_authorized on public.participants for select to authenticated
  using (exists (
    select 1 from public.training_enrollments e
    where e.participant_id = participants.id and private.can_read_participants(e.training_id)
  ));
create policy read_authorized on public.training_enrollments for select to authenticated
  using (private.can_read_participants(training_id));
create policy read_authorized on public.participant_progress_snapshots for select to authenticated
  using (private.can_read_participants(private.enrollment_training(enrollment_id)));
create policy read_authorized on public.participant_module_progress for select to authenticated
  using (private.can_read_participants(private.enrollment_training(enrollment_id)));

-- Indikator PK --------------------------------------------------------------------

create policy read_all on public.pk_documents for select to authenticated
  using (private.current_app_role() is not null);
create policy read_all on public.pk_indicators for select to authenticated
  using (private.current_app_role() is not null);
create policy read_all on public.pk_indicator_targets for select to authenticated
  using (private.current_app_role() is not null);
create policy read_all on public.risk_rule_versions for select to authenticated
  using (private.current_app_role() is not null);

create policy write_pk on public.pk_documents for insert to authenticated
  with check (private.is_cross_team());
create policy update_pk on public.pk_documents for update to authenticated
  using (private.is_cross_team()) with check (private.is_cross_team());
create policy write_pk on public.pk_indicators for insert to authenticated
  with check (private.is_cross_team());
create policy update_pk on public.pk_indicators for update to authenticated
  using (private.is_cross_team()) with check (private.is_cross_team());
create policy write_pk on public.pk_indicator_targets for insert to authenticated
  with check (private.is_cross_team());
create policy update_pk on public.pk_indicator_targets for update to authenticated
  using (private.is_cross_team()) with check (private.is_cross_team());
create policy write_pk on public.risk_rule_versions for insert to authenticated
  with check (private.has_role(array['pk_manager']));

create policy read_team on public.training_indicator_mappings for select to authenticated
  using (private.can_access_training(training_id));
create policy write_pk on public.training_indicator_mappings for insert to authenticated
  with check (private.is_cross_team());
create policy update_pk on public.training_indicator_mappings for update to authenticated
  using (private.is_cross_team()) with check (private.is_cross_team());

-- Risiko dan tindak lanjut ---------------------------------------------------------

create policy read_scoped on public.risk_assessments for select to authenticated
  using (
    (training_id is null and private.current_app_role() is not null)
    or (training_id is not null and private.can_access_training(training_id)
        and (enrollment_id is null or private.can_read_participants(training_id)))
  );

create policy read_scoped on public.followup_actions for select to authenticated
  using (exists (
    select 1 from public.risk_assessments a
    where a.id = risk_assessment_id
      and (a.training_id is null or private.can_access_training(a.training_id))
  ));
create policy write_manager on public.followup_actions for insert to authenticated
  with check (private.has_role(array['admin', 'pk_manager', 'training_manager']));
create policy update_manager on public.followup_actions for update to authenticated
  using (owner_id = auth.uid() or private.has_role(array['admin', 'pk_manager']))
  with check (owner_id = auth.uid() or private.has_role(array['admin', 'pk_manager']));

-- Laporan -------------------------------------------------------------------------

create policy read_all on public.report_templates for select to authenticated
  using (private.current_app_role() is not null);

create policy read_team on public.generated_reports for select to authenticated
  using (private.can_access_team(private.report_team(id)));
create policy write_manager on public.generated_reports for insert to authenticated
  with check (
    created_by = auth.uid()
    and private.has_role(array['admin', 'pk_manager', 'training_manager'])
    and private.can_access_team(
      (select y.work_team_id from public.work_team_years y where y.id = work_team_year_id))
  );
create policy update_manager on public.generated_reports for update to authenticated
  using (private.can_access_team(private.report_team(id))
         and private.has_role(array['admin', 'pk_manager', 'training_manager']))
  with check (private.can_access_team(private.report_team(id)));

create policy read_team on public.report_trainings for select to authenticated
  using (private.can_access_team(private.report_team(report_id)));
create policy write_manager on public.report_trainings for insert to authenticated
  with check (private.can_access_team(private.report_team(report_id))
              and private.can_access_training(training_id));
create policy update_manager on public.report_trainings for update to authenticated
  using (private.can_access_team(private.report_team(report_id)))
  with check (private.can_access_training(training_id));
create policy read_team on public.report_assets for select to authenticated
  using (private.can_access_team(private.report_team(report_id)));

-- Admin saja ------------------------------------------------------------------------

create policy read_admin on public.audit_logs for select to authenticated
  using (private.has_role(array['admin']));
create policy read_admin on public.ai_provider_configs for select to authenticated
  using (private.has_role(array['admin']));
create policy read_admin on public.ai_usage_logs for select to authenticated
  using (private.has_role(array['admin']));
