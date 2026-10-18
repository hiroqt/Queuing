# PLAN-001 — Implementation Design

**Status:** Proposed — must be approved before coding.

## Phase 1 — Core foundation
Initialize React TS Vite, ASP.NET Core Web API, PostgreSQL/EF Core. Configure same-origin reverse proxy plan, secure sessions, Identity, anti-CSRF, policy authorization, logging, migrations and CI. First architectural enforcement tests.

## Phase 2 — Admin config
Build backend Configuration and IdentityAccess slices; schema for services/counters/staff assignments; admin CRUD + deactivate, numbering/session policy, print templates, displays/profile/device pairing. TypeScript generated client and accessible forms. Audit mutations.

## Phase 3 — Queue engine and staff
Build session sequence transaction, ticket state machine, idempotency records and queue events; call-next locking; staff counter selection and issue/call/skip/recall/complete UI. Add PostgreSQL concurrent request tests and invalid-transition assertions.

## Phase 4 — Printing and display
Canonical ticket render/read model, 58/80mm approved presets and print CSS; public display device-scoped snapshot endpoint; SignalR authorization, outbox dispatcher, reconnect refresh; admin display mappings and versioning.

## Phase 5 — Hardening and pilot
Accessibility, authorization matrix, test against real receipt printer, network disconnect/restart, backup/restore drill, performance baseline, vulnerability/dependency scan, staging migration and rollback plan. Training, acceptance signoff.

## API/version management
OpenAPI is authoritative for typed React contracts. Prefer `/api/v1/` for stable versioned endpoints; stable response shapes and `ProblemDetails` errors. Define signal messages as invalidation/revision notifications, not unbounded state dumps.

## Production plan
One host initially; Docker compose or equivalent with persistent PostgreSQL volume, reverse proxy TLS, automated encrypted backups and off-host copies. Do not run production migrations automatically on each API startup. Backup, migrate, smoke test, and document rollback/recovery.

## Risks and mitigations
Concurrent issuing/calling (DB tests); pairing abuse (scoped revocable credential); third-party JS/XSS (strict CSP and trusted template keys); printer differences (real hardware pilot); browser sleeps/SignalR loss (snapshot refresh); data loss (restore drills); uncontrolled scope (SDD gate).
