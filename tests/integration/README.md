Integration test (Vitest + Supabase lokal) memakai akun sintetis `@example.test` yang dibuat lewat Admin API (`tests/support/local-supabase.ts`) dan hanya berjalan terhadap Supabase lokal.

```bash
supabase start
pnpm db:env          # tulis URL, anon key, dan service role key lokal ke .env.local
pnpm test:integration
```
