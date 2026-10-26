# Plan — SPEC-006

## Approved Admin usability follow-up (2026-10-27)

Keep all six configuration sections on their existing direct routes. Standardize them around compact, Department-aware list views; move create/edit forms into native accessible modal dialogs; group secondary record actions; add conditional list search/status filters; and split Displays from its lobby playlist with an in-page selector. Use searchable checkbox assignment lists for Stations and Staff, and render human-readable Department · Service assignments. Preserve existing API calls and queue/configuration invariants.

Implementation stays in the existing React feature folders and shared Admin components/styles. Update the mocked Admin browser workflow to follow the modal and action-menu controls. No API, database, authorization, or migration work is planned.

## Approved Admin status/one-time secret follow-up (2026-10-27)

Use one shared status badge beside each record name across the six Admin sections, with distinct Active, Inactive, and Revoked styles and the Actions control remaining on the right. Replace the three transient one-time banners with one shared native dialog that shows the temporary username/password or device pairing code, supports clipboard copy with feedback, retains existing instructions, and clears the value on dismissal. Reuse the current API responses and route links; do not persist or log generated secrets.

## Approved Admin search and pagination follow-up (2026-10-27)

Extend the existing `AdminListControls` so every growing Admin collection is searched and paged client-side. Keep its existing per-collection match fields and conditional status filter. Make search explicit by Search button or Enter; combine applied search and status, reset to page one when filters or page size change, default to 10 items with 10/25/50 choices, and show the result range with Previous/Next and page count. Reuse existing API list responses; no service or schema work.

## Approved section-specific search follow-up (2026-10-27)

Use the shared `AdminSearchBar` in Departments, Services, Stations, and Users whenever records exist. Supply a tailored placeholder and keep each section's matching fields in its existing search-text callback; add direct Department names to the User callback for legacy assignments. Preserve shared layout and filtering behavior.

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
