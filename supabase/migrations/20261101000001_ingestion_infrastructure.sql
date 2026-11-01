-- F2-07: infrastruktur ingestion.
-- * Kolom yang dibutuhkan port F2-06 (hash per baris, waktu label UPDATE TERAKHIR).
-- * Bucket privat untuk file impor CSV/XLSX (SH-UPLOAD-03): tanpa policy di storage.objects,
--   sehingga hanya service role di server yang dapat membaca dan menulis.
-- * Dua fungsi transaksional yang hanya dapat dijalankan service role, dipanggil setelah use case
--   memeriksa otorisasi (lihat komentar di 20261031000002_rls_policies.sql).

alter table public.import_batches add column label_updated_at timestamptz;
alter table public.participant_progress_snapshots add column row_hash text;

-- Batas 5 MB (keputusan F2-07, SH-UPLOAD-01). Pemeriksaan isi file tetap di server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'imports', 'imports', false, 5242880,
  array['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do nothing;

-- Pelatihan dan sumber Google Sheets-nya dalam satu transaksi (RegisterTraining, §3.7).
create function public.ingestion_register_training(p_training jsonb, p_source jsonb)
returns void
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.trainings (
    id, work_team_year_id, code, name, scheme_code, portal_url, portal_training_id,
    start_date, end_date, id_confirmed_by, id_confirmed_at
  ) values (
    (p_training->>'id')::uuid,
    (p_training->>'workTeamYearId')::uuid,
    p_training->>'code',
    p_training->>'name',
    p_training->>'schemeCode',
    p_training->>'portalUrl',
    p_training->>'portalTrainingId',
    (p_training->>'startDate')::date,
    (p_training->>'endDate')::date,
    (p_training->>'idConfirmedBy')::uuid,
    (p_training->>'idConfirmedAt')::timestamptz
  );
  insert into public.data_sources (id, training_id, source_type, spreadsheet_id, gid)
  values (
    (p_source->>'id')::uuid,
    (p_source->>'trainingId')::uuid,
    'google_sheets',
    p_source->>'spreadsheetId',
    p_source->>'gid'
  );
end;
$$;

-- Instansi dicari menurut nama (kolom name tidak unik); dibuat bila belum ada.
create function private.ingestion_organization(p_name text)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
begin
  if coalesce(p_name, '') = '' then
    return null;
  end if;
  select id into v_id from public.organizations where name = p_name order by created_at limit 1;
  if v_id is null then
    insert into public.organizations (name) values (p_name) returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- Satu peserta: peserta, enrollment, snapshot progres, dan progres per item.
create function private.ingestion_commit_participant(
  p_participant jsonb, p_training uuid, p_batch jsonb
)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_batch_id uuid := (p_batch->>'id')::uuid;
  v_version int := (p_batch->>'catalogVersion')::int;
  v_captured timestamptz := (p_batch->>'capturedAt')::timestamptz;
  v_person uuid;
  v_enrollment uuid;
begin
  insert into public.participants (participant_number, name, organization_id)
  values (
    p_participant->>'participantNumber',
    p_participant->>'participantName',
    private.ingestion_organization(p_participant->>'organization')
  )
  on conflict (participant_number) do update
    set name = excluded.name, organization_id = excluded.organization_id
  returning id into v_person;

  insert into public.training_enrollments (
    training_id, participant_id, source_status, enrollment_status, onboarding_status
  ) values (
    p_training, v_person,
    p_participant->>'sourceStatus',
    p_participant->>'enrollmentStatus',
    (p_participant->>'onboardingStatus')::boolean
  )
  on conflict (training_id, participant_id) do update
    set source_status = excluded.source_status,
        enrollment_status = excluded.enrollment_status,
        onboarding_status = excluded.onboarding_status,
        updated_at = now()
  returning id into v_enrollment;

  insert into public.participant_progress_snapshots (
    enrollment_id, completion_percentage, completed_items, total_items, quality_flags,
    captured_at, import_batch_id, row_hash
  ) values (
    v_enrollment,
    (p_participant->>'completionPercentage')::numeric,
    (p_participant->>'completedItems')::int,
    (p_participant->>'totalItems')::int,
    array(select jsonb_array_elements_text(p_participant->'qualityFlags')),
    v_captured, v_batch_id, p_participant->>'rowHash'
  );

  insert into public.participant_module_progress (
    enrollment_id, module_id, status, captured_at, import_batch_id
  )
  select v_enrollment, m.id, item->>'status', v_captured, v_batch_id
  from jsonb_array_elements(p_participant->'modules') as item
  join public.training_modules m
    on m.training_id = p_training
   and m.catalog_version = v_version
   and m.sequence = (item->>'sequence')::int;
end;
$$;

-- Commit impor dalam satu transaksi (CommitImport/SyncSheet, §3.4 langkah 4). Batch harus masih
-- berstatus staged (diperiksa lebih dulu); idempotency_key unik mencegah commit ganda (§7.4).
create function public.ingestion_commit_import(p jsonb)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_batch jsonb := p->'batch';
  v_training uuid := (v_batch->>'trainingId')::uuid;
  v_version int := (p->'catalog'->>'version')::int;
  v_context jsonb;
  v_participant jsonb;
begin
  update public.import_batches
     set status = 'committed',
         idempotency_key = p->>'idempotencyKey',
         content_hash = v_batch->>'contentHash',
         fetched_at = (v_batch->'freshness'->>'fetchedAt')::timestamptz,
         content_changed_at = (v_batch->'freshness'->>'contentChangedAt')::timestamptz,
         source_updated_at = (v_batch->'freshness'->>'sourceUpdatedAt')::timestamptz,
         source_updated_at_uncertain =
           (v_batch->'freshness'->>'sourceUpdatedAtUncertain')::boolean,
         label_updated_at = (v_batch->'freshness'->>'labelUpdatedAt')::timestamptz,
         row_counts = coalesce(v_batch->'summary', '{}'::jsonb),
         expires_at = null
   where id = (v_batch->>'id')::uuid and status = 'staged';
  if not found then
    raise exception 'Batch % tidak berstatus staged', v_batch->>'id' using errcode = 'P0001';
  end if;

  if p->'catalog'->>'action' = 'create' then
    insert into public.training_modules (
      training_id, catalog_version, catalog_status, module_code, name, source_name,
      module_type, sequence, source_column
    )
    select v_training, v_version, 'draft', item->>'moduleCode', item->>'name',
           item->>'sourceName', item->>'moduleType', (item->>'sequence')::int,
           item->>'sourceColumn'
    from jsonb_array_elements(p->'catalog'->'items') as item;
  end if;

  v_context := jsonb_build_object(
    'id', v_batch->>'id',
    'catalogVersion', v_version,
    'capturedAt', v_batch->'freshness'->>'fetchedAt'
  );
  for v_participant in select value from jsonb_array_elements(p->'participants') loop
    perform private.ingestion_commit_participant(v_participant, v_training, v_context);
  end loop;
end;
$$;

revoke all on function public.ingestion_register_training(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.ingestion_commit_import(jsonb) from public, anon, authenticated;
revoke all on function private.ingestion_organization(text) from public, anon, authenticated;
revoke all on function private.ingestion_commit_participant(jsonb, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.ingestion_register_training(jsonb, jsonb) to service_role;
grant execute on function public.ingestion_commit_import(jsonb) to service_role;
grant usage on schema private to service_role;
grant execute on function private.ingestion_organization(text) to service_role;
grant execute on function private.ingestion_commit_participant(jsonb, uuid, jsonb) to service_role;
