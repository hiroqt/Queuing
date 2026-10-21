# Plan — SPEC-006

## Architecture

Extend the existing ASP.NET Core 10 API, EF Core/MySQL model, centralized React API client, and Admin page. Keep a single deployable modular monolith; no new project, service, framework, or frontend redesign. Department remains the channel record. Service and Station each have one Department owner. Station-Service and Station-Staff are explicit join records so relational constraints and replacement behavior remain clear.

Use composite keys/foreign keys where supported by the current EF/MySQL provider to prevent cross-department links, plus explicit API validation for useful errors. Keep Department ownership immutable after creation. Use additive migrations, `DeleteBehavior.Restrict` for referenced configuration, and active flags instead of deletion. Audit writes share the same transaction as each mutation. Do not write queue outbox messages because queue/display snapshots are unchanged.

Station-Staff must be a subset of existing Staff `UserDepartment` assignments. Admin user updates remove only station assignments made invalid by deactivation, role change, or removed Department assignment. The existing admin flow remains responsible for user role and Department configuration.

## File and contract impact

- `backend/Queuing.Api/Data/QueueDbContext.cs`: add Service, Station, StationService, and StationStaff entities, constraints, and indexes.
- `backend/Queuing.Api/Controllers/AdminServicesController.cs`: Admin-only Service list/create/update.
- `backend/Queuing.Api/Controllers/AdminStationsController.cs`: Admin-only Station list/create/update and assignment validation.
- `backend/Queuing.Api/Controllers/AdminUsersController.cs`: atomically clear station links that become invalid when a user's role, activity, or Department assignments change.
- `backend/Queuing.Api/Data/Migrations/`: add one reviewed migration and update the EF model snapshot.
- `frontend/src/api/client.js`: add Service and Station API methods through the existing CSRF-aware client.
- `frontend/src/features/admin/AdminPage.jsx`: load and manage Services/Stations using the existing UI classes; no other route or queue caller changes.
- `frontend/tests/e2e/clinic-authenticated-workflows.spec.js`: mock-backed Admin user flow for creating and editing Services/Stations.
- `frontend/tests/e2e/clinic-mysql-integration.spec.js`: live API checks for Admin policy, persistence, assignments, same-department validation, and user deactivation cleanup.
- `frontend/tests/unit/api-client.test.js`: verify new API wrapper paths, payloads, and CSRF behavior.
- `PRD.md`, `ARD.md`, `docs/OPEN_DECISIONS.md`, `docs/CODEBASE_MAP.md`, and `docs/STRUCTURE.md`: record the accepted boundary and current code paths.

## Dependency order

1. Add SPEC-006, its acceptance and task records, and record the agreed decisions in PRD/ARD/open decisions.
2. Add failing behavior checks at the existing API-client and Admin browser seams; extend the opt-in MySQL browser/API workflow for relational and authorization invariants.
3. Add relational entities/configuration endpoints and user-assignment cleanup.
4. Add the additive MySQL migration and update the model snapshot.
5. Add Service and Station calls to the existing centralized client.
6. Add Service/Station forms and associations to the current Admin page.
7. Run the focused frontend unit and mocked E2E checks; run .NET build/tests; run live MySQL integration only against a disposable `_test` database.
8. Review the full diff, migration, authorization, responsive/accessibility behavior, and docs; record actual results in acceptance and navigation docs.

## Test design

- API client: observe method, URL, payload, credentials, and antiforgery header through the existing shared client.
- Mocked browser seam: exercise the Admin create/edit flows, confirm associated department/service/staff labels, and show success/error states.
- Opt-in MySQL API/browser seam: assert persistence across reads, Admin-only access, same-department constraints, duplicate rejection, and station assignment cleanup when a Staff user is deactivated or loses scope. This must use an isolated database whose name ends in `_test`; do not use EF InMemory for relational constraints.
- Existing issue, call, forwarding, and display checks must remain green and their contracts unchanged.

## Rollback

The migration is additive. Roll back application code only after deciding whether to retain or export Service and Station configuration. Do not drop tables containing configured clinic data during routine rollback. No ticket migration/backfill is required.
