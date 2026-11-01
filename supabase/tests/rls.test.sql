-- pgTAP: RLS aktif, akses lintas tim ditolak, role tidak dapat diubah klien. Hitungan dibatasi
-- ke data tes ini agar tidak bergantung pada isi database lokal.
-- (SH-AUTHZ-01, SH-AUTHZ-02, SH-AUTHZ-03).
-- Jalankan: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select is(
  (select count(*)::int from pg_tables t join pg_class c on c.relname = t.tablename
   join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
   where t.schemaname = 'public' and not c.relrowsecurity),
  0, 'semua tabel public memakai RLS');

select is(
  (select count(*)::int from information_schema.role_table_grants
   where grantee = 'anon' and table_schema = 'public'),
  0, 'anon tidak punya grant pada tabel public');

-- Data uji sintetis.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'dta.manager@example.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'gta.viewer@example.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'admin@example.test');
insert into public.profiles (id, display_name, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Pengelola DTA', 'training_manager'),
  ('00000000-0000-0000-0000-0000000000a2', 'Viewer GTA', 'viewer'),
  ('00000000-0000-0000-0000-0000000000a3', 'Admin', 'admin');
insert into public.profile_work_teams (profile_id, work_team_id)
select '00000000-0000-0000-0000-0000000000a1'::uuid, id from public.work_teams where code = 'DTA'
union all
select '00000000-0000-0000-0000-0000000000a2'::uuid, id from public.work_teams where code = 'GTA';

insert into public.trainings (id, work_team_year_id, code, name, portal_training_id,
  id_confirmed_by, id_confirmed_at)
select '00000000-0000-0000-0000-0000000000b1'::uuid, y.id, 'DTA-90001', 'Pelatihan Sintetis DTA', '90001',
  '00000000-0000-0000-0000-0000000000a3', now()
from public.work_team_years y join public.work_teams w on w.id = y.work_team_id
where w.code = 'DTA' and y.year = 2026;

insert into public.participants (id, participant_number, name)
values ('00000000-0000-0000-0000-0000000000c1', 'SYN-0001', 'Peserta Sintetis 01');
insert into public.training_enrollments (training_id, participant_id, enrollment_status)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'passed');

create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Jumlah profil sebenarnya (termasuk akun uji lain di database lokal), dibaca sebelum RLS berlaku.
select set_config('test.total_profiles', (select count(*) from public.profiles)::text, true);

set local role authenticated;

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.trainings where id = '00000000-0000-0000-0000-0000000000b1'), 1,
  'pengelola DTA melihat pelatihan DTA');
select is((select count(*)::int from public.participants where id = '00000000-0000-0000-0000-0000000000c1'), 1,
  'pengelola DTA melihat peserta DTA');
select is((select count(*)::int from public.pk_indicators), 4, 'indikator PK terbaca semua role');
select is((select count(*)::int from public.profiles), 1, 'pengguna hanya membaca profilnya sendiri');
select throws_ok(
  $$ update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '42501', null, 'pengguna tidak dapat menaikkan role sendiri');
select throws_ok(
  $$ insert into public.profile_work_teams (profile_id, work_team_id)
     select '00000000-0000-0000-0000-0000000000a1', id from public.work_teams where code = 'GTA' $$,
  '42501', null, 'pengguna tidak dapat menambah tim kerja sendiri');

select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select is((select count(*)::int from public.trainings where code like 'DTA-%'), 0,
  'viewer GTA tidak melihat pelatihan DTA mana pun');
select is((select count(*)::int from public.participants), 0, 'viewer tidak membaca data peserta');
select throws_ok(
  $$ insert into public.audit_logs (action, resource_type) values ('x', 'y') $$,
  '42501', null, 'audit log tidak dapat ditulis dari klien');

select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select is((select count(*)::int from public.trainings where id = '00000000-0000-0000-0000-0000000000b1'), 1,
  'admin melihat pelatihan tim lain');
select is((select count(*)::int from public.profiles),
  current_setting('test.total_profiles')::int, 'admin membaca semua profil');

select * from finish();
rollback;
