-- pgTAP: fungsi transaksional ingestion hanya untuk service role; bucket impor privat;
-- commit menulis peserta, snapshot ber-hash, dan progres item; commit ganda ditolak (F2-07).
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select ok(not has_function_privilege('authenticated', 'public.ingestion_commit_import(jsonb)', 'execute'),
  'authenticated tidak dapat menjalankan commit impor');
select ok(not has_function_privilege('anon', 'public.ingestion_register_training(jsonb, jsonb)', 'execute'),
  'anon tidak dapat mendaftarkan pelatihan');
select ok(has_function_privilege('service_role', 'public.ingestion_commit_import(jsonb)', 'execute'),
  'service role dapat menjalankan commit impor');
select is((select public from storage.buckets where id = 'imports'), false, 'bucket imports privat');
select is((select count(*)::int from pg_policies where schemaname = 'storage'
  and tablename = 'objects' and (qual like '%imports%' or with_check like '%imports%')), 0,
  'tidak ada policy klien untuk bucket imports');

-- Data uji sintetis.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1', 'pgtap.admin@example.test');
insert into public.profiles (id, display_name, role)
values ('00000000-0000-0000-0000-0000000000d1', 'Admin pgTAP', 'admin');

set local role service_role;

select lives_ok($$
  select public.ingestion_register_training(
    jsonb_build_object(
      'id', '00000000-0000-0000-0000-0000000000e1',
      'workTeamYearId', (select y.id from public.work_team_years y join public.work_teams w
                         on w.id = y.work_team_id where w.code = 'DTA' and y.year = 2026),
      'code', 'DTA-99901', 'name', 'Pelatihan pgTAP', 'portalTrainingId', '99901',
      'startDate', '2026-09-23', 'endDate', '2026-09-30',
      'idConfirmedBy', '00000000-0000-0000-0000-0000000000d1',
      'idConfirmedAt', '2026-10-13T05:00:00Z'),
    jsonb_build_object('id', '00000000-0000-0000-0000-0000000000e2',
      'trainingId', '00000000-0000-0000-0000-0000000000e1',
      'spreadsheetId', '1SintetisPgtapSpreadsheet_0123456789', 'gid', '0'))
$$, 'pelatihan dan sumber tersimpan');

insert into public.import_batches (id, source_id, source_type, status)
values ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000e2',
  'google_sheets', 'staged');

create temporary table commit_payload as select jsonb_build_object(
  'idempotencyKey', 'pgtap-key-0001',
  'catalog', jsonb_build_object('action', 'create', 'version', 1, 'items', jsonb_build_array(
    jsonb_build_object('sequence', 1, 'moduleCode', 'M01', 'name', 'OVERVIEW',
      'sourceName', 'OVERVIEW', 'moduleType', 'overview', 'sourceColumn', 'J'),
    jsonb_build_object('sequence', 2, 'moduleCode', 'M02', 'name', 'KUIS 1',
      'sourceName', 'KUIS 1', 'moduleType', 'quiz', 'sourceColumn', 'K'))),
  'batch', jsonb_build_object('id', '00000000-0000-0000-0000-0000000000e3',
    'trainingId', '00000000-0000-0000-0000-0000000000e1', 'contentHash', 'abc',
    'summary', jsonb_build_object('participants', 1),
    'freshness', jsonb_build_object('fetchedAt', '2026-10-13T05:00:00Z',
      'contentChangedAt', '2026-10-13T05:00:00Z', 'sourceUpdatedAt', null,
      'sourceUpdatedAtUncertain', false, 'labelUpdatedAt', null)),
  'participants', jsonb_build_array(jsonb_build_object(
    'participantNumber', 'PGTAP-001', 'participantName', 'Peserta pgTAP',
    'organization', 'Instansi pgTAP', 'sourceStatus', 'Lulus Pelatihan - Nilai',
    'enrollmentStatus', 'passed', 'onboardingStatus', true, 'completionPercentage', 50,
    'completedItems', 1, 'totalItems', 2, 'qualityFlags', jsonb_build_array('lms_mismatch'),
    'rowHash', 'hash-001',
    'modules', jsonb_build_array(
      jsonb_build_object('sequence', 1, 'status', 'completed'),
      jsonb_build_object('sequence', 2, 'status', 'not_started'))))
) as p;

select lives_ok($$ select public.ingestion_commit_import((select p from commit_payload)) $$,
  'commit impor berhasil');
select is((select status from public.import_batches where id = '00000000-0000-0000-0000-0000000000e3'),
  'committed', 'batch menjadi committed');
select is((select count(*)::int from public.training_modules
  where training_id = '00000000-0000-0000-0000-0000000000e1' and catalog_status = 'draft'), 2,
  'katalog v1 draf dibuat');
select is((select row_hash || ':' || array_to_string(quality_flags, ',')
  from public.participant_progress_snapshots
  where import_batch_id = '00000000-0000-0000-0000-0000000000e3'), 'hash-001:lms_mismatch',
  'snapshot menyimpan hash baris dan bendera kualitas');
select is((select count(*)::int from public.participant_module_progress
  where import_batch_id = '00000000-0000-0000-0000-0000000000e3'), 2, 'progres per item tersimpan');
select throws_ok($$ select public.ingestion_commit_import((select p from commit_payload)) $$,
  'P0001', null, 'commit ulang batch yang sudah committed ditolak');

select * from finish();
rollback;
