-- STATUS "Submit" pada sheet = pendaftar dalam seleksi penerimaan (keputusan pemilik, 1 Nov 2026).
-- Status ini belum menjadi peserta pelatihan; "Pelatihan" memakai `in_progress` yang sudah ada.
alter table public.training_enrollments
  drop constraint training_enrollments_enrollment_status_check;
alter table public.training_enrollments
  add constraint training_enrollments_enrollment_status_check check (
    enrollment_status in (
      'passed', 'not_passed', 'cancelled', 'in_progress', 'in_selection', 'unmapped'
    )
  );
