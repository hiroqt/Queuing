# SPEC-011 Tasks

- [x] Confirm Service-scoped authorization, destination forwarding, existing-account backfill, and local-only anonymous Admin behavior.
- [x] Confirm API/MySQL and mocked browser verification seams.
- [x] Approve SPEC-011 and the implementation plan.
- [x] Add UserServices model and additive/backfill migration.
- [x] Update Admin user provisioning, updates, session contract, and Service assignment UI.
- [x] Enforce Service authorization across queue reads and all Staff mutations.
- [x] Show the Service on Staff queue entries while preserving any-active-Service forwarding.
- [x] Add focused MySQL/API and mocked browser regression coverage.
- [x] Verify migration backfill from existing Department assignments on MySQL.
- [x] Update PRD, open decisions, codebase map, and record verification results.

## Verification record — 2026-10-24

- `dotnet build Queuing.slnx --no-restore --disable-build-servers -m:1 -p:UseSharedCompilation=false` — passed; 0 warnings/errors.
- `dotnet test Queuing.slnx --no-restore --disable-build-servers -m:1 -p:UseSharedCompilation=false` — passed; API 22/22 and Core 18/18.
- `npm run lint`, `npm run build`, `npm test` — passed; 10 frontend unit tests.
- Mocked Playwright authenticated workflow file — passed; 10/10.
- Opt-in authenticated MySQL/API/browser workflow — passed; verifies same-Department Service isolation and denied unassigned queue actions.
- Backfill smoke: applied migrations through the pre-feature schema, inserted a synthetic Staff/Department assignment and two same-Department Services, applied `20261024003422_ServiceScopedStaffAccess`, and confirmed two corresponding `UserServices` rows.
- Tests used isolated local `_test` schemas; no production/shared database was used.
