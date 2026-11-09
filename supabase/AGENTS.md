# Supabase scope

Before changing schema/API, read the active task slice in `PLAN.md`, `docs/DATABASE.md`, and only the relevant function, migration, SQL test, or data-dictionary section.

- `functions/dolend-api/` is production-domain code; `functions/dolend-compat-poc/` remains an isolated compatibility probe.
- Authenticate from verified JWT or scoped guest token, then check ownership. Service-role bypasses RLS and must not turn client IDs into authority.
- Add a new forward migration; never rewrite an applied migration. Preserve RLS, grants, FK indexes, locks, idempotency, audit trails, financial history, and integer IDR.
- Public DTOs must exclude phone, evidence paths, secrets, raw provider payloads, and private payment instructions unless the verified role requires them.
- Internal jobs must be bounded, retry-safe, externally scheduled, and protected by server-only credentials. Never log credentials or access tokens.
- Verification: `pnpm run api:check`, `pnpm run api:test`, and `pnpm run db:test` when migrations/RPCs change. Hosted tests, migration push, function deploy, and scheduler changes require explicit user scope.
