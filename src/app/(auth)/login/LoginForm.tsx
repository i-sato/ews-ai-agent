"use client";

import { useActionState } from "react";
import { type LoginState, login } from "./actions";
import styles from "./login.module.css";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className={styles.form}>
      <h2 className={styles.formTitle}>Masuk</h2>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className={styles.field}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className={styles.field}>
        <label htmlFor="password">Kata sandi</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {state.error ? (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      ) : null}
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? "Memproses…" : "Masuk"}
      </button>
      <p className={styles.hint}>Akses diberikan oleh Admin sesuai role.</p>
    </form>
  );
}
