import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { CompletionOverview, FreshnessStrip, Funnel } from "@/components/trainings/DetailOverview";
import { ModuleTab, ParticipantTab } from "@/components/trainings/DetailTabs";
import { ScheduleSection } from "@/components/trainings/ScheduleSection";
import styles from "@/components/trainings/detail.module.css";
import { PHASE_LABELS } from "@/components/trainings/format";
import { PageHeader } from "@/components/ui/PageHeader";
import page from "@/components/ui/page.module.css";
import { TRAINING_MANAGERS } from "@/lib/api/roles";
import { requireUser } from "@/lib/auth/require-role";
import { trainingViewDeps } from "@/lib/container";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  type TrainingDetail,
  getTrainingDetail,
} from "@/modules/ingestion/application/training-detail";
import { type RawSearchParams, hrefWith, pickParams } from "../search-params";

export const metadata: Metadata = { title: "Detail pelatihan" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<RawSearchParams> };

function subtitle(t: TrainingDetail["training"], items: number | null): string {
  const parts = [t.period ?? "Jadwal belum diisi", PHASE_LABELS[t.phase]];
  if (t.phase === "in_progress" && t.day) parts.push(`hari ke-${t.day.day} dari ${t.day.total}`);
  if (items !== null) parts.push(`${items} item modul`);
  return parts.join(" · ");
}

function PeopleTab({
  detail,
  category,
  href,
}: {
  detail: TrainingDetail;
  category: string | undefined;
  href: (p: Record<string, string>) => string;
}) {
  if (detail.participants) {
    return (
      <ParticipantTab participants={detail.participants} category={category ?? ""} href={href} />
    );
  }
  return (
    <p className={styles.notice} role="status">
      Daftar peserta hanya untuk pengelola dan admin. Anda melihat ringkasan agregat.
    </p>
  );
}

function Tabs({
  detail,
  query,
  href,
}: {
  detail: TrainingDetail;
  query: Record<string, string>;
  href: (p: Record<string, string>) => string;
}) {
  const summary = detail.summary;
  if (!summary) return null;
  const tab = query.tab === "peserta" ? "peserta" : "modul";
  return (
    <section className={styles.section} aria-label="Rincian pelatihan">
      <nav className={styles.tabs} aria-label="Rincian pelatihan">
        <Link
          className={styles.tab}
          href={href({ tab: "modul" })}
          aria-current={tab === "modul" ? "page" : undefined}
        >
          Modul · {summary.items.length} item
        </Link>
        <Link
          className={styles.tab}
          href={href({ tab: "peserta" })}
          aria-current={tab === "peserta" ? "page" : undefined}
        >
          Peserta · {summary.funnel.registered}
        </Link>
      </nav>
      {tab === "modul" ? <ModuleTab summary={summary} type={query.type ?? ""} href={href} /> : null}
      {tab === "peserta" ? (
        <PeopleTab detail={detail} category={query.category} href={href} />
      ) : null}
    </section>
  );
}

// Web-PelatihanDetail.dc.html dan M-PelatihanDetail.dc.html (§8.6).
export default async function TrainingDetailPage(props: Props) {
  const access = await requireUser();
  if (!access.ok) return <AccessDenied reason={access.reason} />;
  const { id } = await props.params;
  const query = pickParams(await props.searchParams, ["tab", "type", "category", "page"]);
  const deps = trainingViewDeps(await createSupabaseServerClient());
  const input = { trainingId: id, category: query.category, page: query.page };
  const actor = { id: access.user.id, role: access.user.role };
  const result = await getTrainingDetail(deps, input, actor);
  if (!result.ok) notFound();
  const detail = result.value;
  const t = detail.training;
  const href = (p: Record<string, string>) => hrefWith(`/trainings/${t.id}`, {}, p);
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Link href="/trainings">Pelatihan</Link> › {t.code}
          </>
        }
        title={t.name}
        subtitle={subtitle(t, detail.summary?.items.length ?? null)}
      />
      <div className={`${page.body} ${styles.stack}`}>
        <FreshnessStrip detail={detail} />
        <ScheduleSection detail={detail} canEdit={TRAINING_MANAGERS.includes(actor.role)} />
        {detail.summary ? <Funnel summary={detail.summary} /> : null}
        {detail.summary ? <CompletionOverview summary={detail.summary} /> : null}
        <Tabs detail={detail} query={query} href={href} />
      </div>
    </>
  );
}
