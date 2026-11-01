import Link from "next/link";
import type { TrainingDetail } from "@/modules/ingestion/application/training-detail";
import type { Category, ItemType } from "@/modules/ingestion/application/view-types";
import { ProgressBar } from "./CompletionBar";
import { CATEGORY_LABELS, CATEGORY_ORDER, ITEM_TYPE_LABELS, RISK_NOT_ASSESSED } from "./format";
import { Pager } from "./Pager";
import styles from "./detail.module.css";
import list from "./trainings.module.css";

type Summary = NonNullable<TrainingDetail["summary"]>;
type Participants = NonNullable<TrainingDetail["participants"]>;
type Href = (params: Record<string, string>) => string;

function Chips({
  options,
  current,
  href,
  label,
}: {
  options: [string, string][];
  current: string;
  href: (value: string) => string;
  label: string;
}) {
  return (
    <nav className={styles.chips} aria-label={label}>
      {options.map(([value, text]) => (
        <Link
          key={value}
          className={styles.chip}
          href={href(value)}
          aria-current={value === current}
        >
          {text}
        </Link>
      ))}
    </nav>
  );
}

const TYPE_OPTIONS: [string, string][] = [["", "Semua"], ...Object.entries(ITEM_TYPE_LABELS)];

export function ModuleTab({ summary, type, href }: { summary: Summary; type: string; href: Href }) {
  const items = summary.items.filter((i) => !type || i.type === (type as ItemType));
  const maxStop = Math.max(0, ...summary.items.map((x) => x.stopHere));
  return (
    <>
      <Chips
        label="Jenis item"
        options={TYPE_OPTIONS}
        current={type}
        href={(v) => href(v ? { tab: "modul", type: v } : { tab: "modul" })}
      />
      <div className={list.tableWrap}>
        <table className={list.table}>
          <thead>
            <tr>
              <th>Kode</th>
              <th>Item</th>
              <th>Jenis</th>
              <th>Selesai</th>
              <th className={list.num}>Belum selesai</th>
              <th className={list.num}>Berhenti di sini</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr
                key={i.code}
                className={maxStop > 0 && i.stopHere === maxStop ? styles.hot : undefined}
              >
                <td className={list.mono}>{i.code}</td>
                <td>{i.name}</td>
                <td>{ITEM_TYPE_LABELS[i.type]}</td>
                <td>
                  <ProgressBar
                    value={i.done}
                    max={summary.denominator}
                    label={`${i.done} dari ${summary.denominator} selesai`}
                  />
                  {i.done}
                </td>
                <td className={list.num}>{i.notDone}</td>
                <td className={list.num}>{i.stopHere}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.notice}>
        Selesai dan belum selesai dihitung dari {summary.denominator} peserta valid. “Berhenti di
        sini” = peserta yang sudah mulai dan menuntaskan item sebelumnya, tetapi belum menyelesaikan
        item ini.
      </p>
    </>
  );
}

function Cells({ statuses, stopAt }: { statuses: string[]; stopAt: number }) {
  const done = statuses.filter((s) => s === "completed").length;
  return (
    <div
      className={styles.matrix}
      role="img"
      aria-label={`${done} dari ${statuses.length} item selesai`}
    >
      {statuses.map((s, i) => (
        <span
          key={i}
          className={`${styles.cell} ${s === "completed" ? styles.cellDone : ""} ${i === stopAt ? styles.cellStop : ""}`}
        />
      ))}
    </div>
  );
}

const CATEGORY_OPTIONS: [string, string][] = [
  ["", "Semua"],
  ...CATEGORY_ORDER.map((c): [string, string] => [c, CATEGORY_LABELS[c]]),
];

export function ParticipantTab({
  participants,
  category,
  href,
}: {
  participants: Participants;
  category: string;
  href: Href;
}) {
  const base: Record<string, string> = category ? { tab: "peserta", category } : { tab: "peserta" };
  return (
    <>
      <Chips
        label="Kategori"
        options={CATEGORY_OPTIONS}
        current={category}
        href={(v) => href(v ? { tab: "peserta", category: v } : { tab: "peserta" })}
      />
      <div className={list.tableWrap}>
        <table className={list.table}>
          <thead>
            <tr>
              <th>No. peserta</th>
              <th>Nama</th>
              <th>Kategori</th>
              <th>Selesai</th>
              <th>Titik berhenti</th>
              <th>Item</th>
              <th>Status risiko</th>
            </tr>
          </thead>
          <tbody>
            {participants.rows.map((p) => (
              <tr key={p.number}>
                <td className={list.mono}>{p.number}</td>
                <td>{p.name}</td>
                <td>{CATEGORY_LABELS[p.category as Category]}</td>
                <td>
                  {p.done}/{p.total}
                </td>
                <td>{p.stop ? `${p.stop.code} · ${p.stop.name}` : "—"}</td>
                <td>
                  <Cells statuses={p.statuses} stopAt={p.stop?.index ?? -1} />
                </td>
                <td>
                  <span className={list.pill}>{RISK_NOT_ASSESSED}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.legend}>
        <span>
          <span className={`${styles.cell} ${styles.cellDone}`} /> Selesai
        </span>
        <span>
          <span className={`${styles.cell} ${styles.cellStop}`} /> Titik berhenti
        </span>
        <span>
          <span className={styles.cell} /> Belum selesai
        </span>
      </p>
      <Pager {...participants} noun="peserta" hrefFor={(n) => href({ ...base, page: String(n) })} />
    </>
  );
}
