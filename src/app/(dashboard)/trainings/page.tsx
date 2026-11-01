import type { Metadata } from "next";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { Pager } from "@/components/trainings/Pager";
import { TrainingCards } from "@/components/trainings/TrainingCards";
import { TrainingFilters } from "@/components/trainings/TrainingFilters";
import { TrainingTable } from "@/components/trainings/TrainingTable";
import styles from "@/components/trainings/trainings.module.css";
import { PageHeader } from "@/components/ui/PageHeader";
import page from "@/components/ui/page.module.css";
import { requireUser } from "@/lib/auth/require-role";
import { trainingViewDeps } from "@/lib/container";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listTrainings } from "@/modules/ingestion/application/list-trainings";
import { type RawSearchParams, hrefWith, pickParams } from "./search-params";

export const metadata: Metadata = { title: "Pelatihan" };

const FILTER_KEYS = ["q", "year", "team", "phase"] as const;

// Web-Pelatihan.dc.html dan M-Pelatihan.dc.html. Angka dari snapshot valid terakhir (§8.6).
export default async function TrainingsPage(props: { searchParams: Promise<RawSearchParams> }) {
  const access = await requireUser();
  if (!access.ok) return <AccessDenied reason={access.reason} />;
  const raw = await props.searchParams;
  const filters = pickParams(raw, FILTER_KEYS);
  const deps = trainingViewDeps(await createSupabaseServerClient());
  const result = await listTrainings(deps, { ...filters, ...pickParams(raw, ["page"]) });
  const year = new Date().getFullYear();
  return (
    <>
      <PageHeader
        title="Pelatihan"
        subtitle="Daftar pelatihan per tahun dan tim kerja · satu spreadsheet per kelas"
      />
      <div className={page.body}>
        <TrainingFilters values={filters} years={[year - 1, year, year + 1]} />
        {result.ok ? (
          <section className={styles.card} aria-label="Daftar pelatihan">
            {result.value.rows.length === 0 ? (
              <p className={styles.empty}>Belum ada pelatihan yang sesuai filter.</p>
            ) : (
              <>
                <TrainingTable rows={result.value.rows} />
                <TrainingCards rows={result.value.rows} />
              </>
            )}
            <Pager
              {...result.value}
              noun="pelatihan"
              note="Kategori dihitung dari status item pada snapshot valid terakhir."
              hrefFor={(n) => hrefWith("/trainings", filters, { page: String(n) })}
            />
          </section>
        ) : (
          <p className={styles.empty} role="alert">
            {result.error.message}
          </p>
        )}
      </div>
    </>
  );
}
