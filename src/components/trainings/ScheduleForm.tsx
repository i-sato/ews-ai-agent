"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./detail.module.css";
import list from "./trainings.module.css";

export type ScheduleValues = {
  registrationStart: string;
  registrationEnd: string;
  startDate: string;
  endDate: string;
};

const FIELDS: [keyof ScheduleValues, string][] = [
  ["registrationStart", "Awal pendaftaran"],
  ["registrationEnd", "Akhir pendaftaran"],
  ["startDate", "Awal pelaksanaan"],
  ["endDate", "Akhir pelaksanaan"],
];

async function save(trainingId: string, form: FormData): Promise<string | null> {
  const body = Object.fromEntries(FIELDS.map(([key]) => [key, String(form.get(key) ?? "")]));
  const response = await fetch(`/api/v1/trainings/${trainingId}/schedule`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, verified: form.get("verified") === "on" }),
  });
  if (response.ok) return null;
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string; request_id?: string };
  } | null;
  const message = payload?.error?.message ?? "Jadwal gagal disimpan.";
  return payload?.error?.request_id ? `${message} (ID: ${payload.error.request_id})` : message;
}

/** Ubah jadwal manual (§3.6) lewat PUT /api/v1/trainings/:id/schedule. */
export function ScheduleForm({
  trainingId,
  values,
}: {
  trainingId: string;
  values: ScheduleValues;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const message = await save(trainingId, new FormData(event.currentTarget));
    setPending(false);
    setError(message);
    if (!message) router.refresh();
  }

  return (
    <details>
      <summary className={list.button}>Ubah jadwal</summary>
      <form className={styles.form} onSubmit={onSubmit} aria-label="Ubah jadwal">
        {FIELDS.map(([key, label]) => (
          <label key={key} className={list.field}>
            {label}
            <input name={key} type="date" required defaultValue={values[key]} />
          </label>
        ))}
        <label>
          <input name="verified" type="checkbox" /> Jadwal sudah saya cocokkan dengan halaman
          pelatihan
        </label>
        <button type="submit" className={list.button} disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan jadwal"}
        </button>
        {error ? (
          <p className={styles.warn} role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </details>
  );
}
