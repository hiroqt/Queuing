# Codebase Map

This map describes the current SPEC-005 queue, SPEC-006 Admin configuration, SPEC-007 local setup mode, SPEC-008 service-aware issue/forward workflow, and SPEC-009 self-service kiosk. Accepted scopes live in [`SPEC-005`](specs/005-forwarding-clinic-queue/spec.md), [`SPEC-006`](specs/006-service-station-admin-config/spec.md), [`SPEC-007`](specs/007-local-admin-setup-mode/spec.md), [`SPEC-008`](specs/008-service-aware-visit-issue/spec.md), and [`SPEC-009`](specs/009-self-service-kiosk/spec.md); operational readiness remains limited to local synthetic-data use.

## Backend

| Path | Responsibility |
|---|---|
| `backend/Queuing.Api/Program.cs` | ASP.NET Core composition root, MySQL/EF configuration, Identity cookies, antiforgery, rate limits, policies, loopback-guarded local setup principal, health routes, SignalR, and outbox startup. |
| `backend/Queuing.Api/Auth/` | One-time admin bootstrap, role constants, department authorization, separate DisplayDevice/KioskDevice authentication, password-change claims, and `LocalSetupAccess` checks. |
| `backend/Queuing.Api/Controllers/AuthController.cs` | Session, login/logout, CSRF token, and forced password change. |
| `backend/Queuing.Api/Controllers/AdminUsersController.cs` | Admin-provisioned accounts, roles, department assignments, temporary credential, and audit. |
| `backend/Queuing.Api/Controllers/AdminServicesController.cs` | Admin-only Service configuration and audit. |
| `backend/Queuing.Api/Controllers/AdminStationsController.cs` | Admin-only physical Station configuration, same-department Service/Staff associations, and audit. |
| `backend/Queuing.Api/Controllers/DepartmentsController.cs` | Dynamic active department choices and admin create/update/deactivation. |
| `backend/Queuing.Api/Controllers/DisplaysController.cs` | Admin monitor configuration and pairing code; anonymous activation; device-scoped snapshot and revocation. |
| `backend/Queuing.Api/Controllers/KiosksController.cs` | Admin kiosk lifecycle and pairing; narrow paired-device choices, walk-in issue, and logout endpoints. |
| `backend/Queuing.Api/Controllers/ReceptionVisitsController.cs` | Authenticated active-Service choices, service-based visit issue, visit-ID compatibility lookup, and original receipt lookup by clinic date/code. |
| `backend/Queuing.Api/Controllers/VisitCommandsController.cs` | Staff queue, call-next, no-show requeue, and service-based complete/forward commands. |
| `backend/Queuing.Api/Services/VisitCommandSupport.cs` | Shared idempotency, clinic-time parsing, audit, and outbox helpers used by visit commands. |
| `backend/Queuing.Api/Services/VisitIssuanceService.cs` | Shared database transaction for Reception/kiosk issue, daily sequence, idempotency, issuer audit, and outbox. |
| `backend/Queuing.Api/Data/QueueDbContext.cs` | Identity, department, Service/Station associations, Display/Kiosk devices, exclusive Visit issuer constraint, and clinic queue indexes. |
| `backend/Queuing.Api/Data/Migrations/` | MySQL initial schema, queue timestamp precision, Service/Station configuration, service-linked visit steps, kiosk device/issuer migration, and model snapshot. |
| `backend/Queuing.Api/Data/QueueDbContextFactory.cs` | EF design-time connection configuration for migrations. |
| `backend/Queuing.Api/Services/QueueOutboxDispatcher.cs` | Dispatches committed queue-change invalidations to department-scoped SignalR groups. |
| `backend/Queuing.Api/Hubs/QueueHub.cs` | Device-authenticated, department-scoped read-only notification hub. |
| `backend/Queuing.Api.Tests/` | Focused tests for Development + loopback setup access boundaries and Admin API path scoping. |
| `backend/Queuing.Core/DepartmentQueuePolicy.vb` | Framework-independent step transition and appointment eligibility rules. |
| `backend/Queuing.Core/QueueDemoStore.vb` | Historical in-memory demo implementation; not registered as the current API queue authority. |
| `backend/Queuing.Core.Tests/` | xUnit checks for legacy demo behavior and current VB.NET queue policy rules. |

## Frontend

| Path | Responsibility |
|---|---|
| `frontend/src/App.jsx` | Public display and kiosk routes plus the authenticated workspace route tree. |
| `frontend/src/api/client.js` | Central same-origin `/api/v1` fetch client, antiforgery token, session, department/user/service/station/display/kiosk admin, visit, and queue API methods. |
| `frontend/src/auth/` | Login, session provider, role guards, forced password change, and Vite-only local setup role previews for Admin, Reception, and Staff routes. |
| `frontend/src/features/admin/AdminLayout.jsx` | Admin workspace heading and one-time staff/display/kiosk credential notices; hosts the selected configuration section. |
| `frontend/src/features/admin/AdminNavigation.jsx`, `adminSections.js` | Collapsible Admin sidebar group and direct routes for Departments, Services, Users & access, Stations, Displays, and Kiosks. |
| `frontend/src/features/admin/sections/` | One React page per admin configuration area; each loads only its records and related form choices from the shared API client. |
| `frontend/src/features/admin/components/` | Shared section heading and API feedback UI used by admin pages. |
| `frontend/src/features/reception/ReceptionPage.jsx` | Visit issue, anonymous receipt, browser print, and lookup. |
| `frontend/src/features/department/DepartmentQueuePage.jsx` | Assigned queue, call-next, no-show requeue, completion, and forwarding. |
| `frontend/src/features/display/` | One-time pairing route and anonymous read-only department display. |
| `frontend/src/features/kiosk/` | Standalone kiosk pairing and responsive Department → Service → confirmation → ticket issue flow. |
| `frontend/tests/unit/` | API client, idempotency header, appointment payload, and role unit tests. |
| `frontend/tests/e2e/clinic-authenticated-workflows.spec.js` | Playwright UI workflows with mocked HTTP API responses. |
| `frontend/tests/e2e/clinic-mysql-integration.spec.js` | Opt-in MySQL/API/browser workflow for local setup access, authenticated configuration, queue behavior, and paired displays; uses a disposable `_test` database and a bootstrapped test admin. |

All HTTP API calls use the shared client. The display SignalR connection is a separate realtime transport and carries only `QueueChanged` invalidations; the screen reloads its scoped REST snapshot.

## Current boundaries and gaps

- Current stack is C# ASP.NET Core 10 API, VB.NET core, and React JavaScript/Vite. No incidental language or framework migration is approved.
- MySQL 8.x/InnoDB is the selected database for SPEC-005, recorded in [ADR-0002](adr/0002-mysql-and-forwarding-visits.md). Earlier PostgreSQL references are architectural proposals or historical specs.
- SPEC-006 adds dynamic Services and physical Stations to Admin configuration. SPEC-008 uses active Services for Reception issue and Staff forwarding; call-next and display projections remain department-scoped. Stations still do not affect queue actions.
- The stable clinic-wide daily visit code uses `Asia/Manila` and remains unchanged while department steps advance. It may repeat on a later clinic date; Reception reprints by `{ visitCode, clinicDate }`. The older visit-ID route remains available.
- `/display/pair` and `/display` bypass the staff sign-in route. Pairing is one-time and rate limited; the API stores a hash of the revocable device credential and scopes the cookie to one active department.
- `/kiosk/pair` and `/kiosk` bypass staff sign-in with a different device cookie and policy. Kiosks see only active Department/Service choices and issue walk-in tickets; device actor IDs are recorded on Visits and audit rows.
- SPEC-007 opens Admin directly in Vite development and allows direct Reception/Department frontend route previews. The API adds unauthenticated Admin role claims only to anonymous `/api/v1/admin/*` requests when enabled in Development and both Host and remote address are loopback; Reception and Staff API routes and production frontend builds retain normal authentication.
- The current display projection contains department name and anonymous visit code/status only. It does not include patient identity, appointment time, or staff information.
- `skills/` contains agent guidance, not application code. `skills/project-knowledge/` applies repository-wide; `skills/clinic-queue/` covers queue/security/persistence; `skills/render/` covers frontend work.
- SPEC-008's MySQL 8.4 migration/bootstrap, service-aware issue/forward, receipt lookup, authorization, and browser workflow were already recorded as passing in this checkout. SPEC-009 source and migration were added in this turn; kiosk tests, database migration application, browser accessibility/responsive review, and physical printing were not run. Production deployment, backup/restore, multi-instance operation, and live patient data remain unverified or out of scope.

For directory layout and growth rules, see [`STRUCTURE.md`](STRUCTURE.md). For the queue, configuration, setup, service-aware workflow, and kiosk briefs, see [`SPEC-005`](specs/005-forwarding-clinic-queue/spec.md), [`SPEC-006`](specs/006-service-station-admin-config/spec.md), [`SPEC-007`](specs/007-local-admin-setup-mode/spec.md), [`SPEC-008`](specs/008-service-aware-visit-issue/spec.md), and [`SPEC-009`](specs/009-self-service-kiosk/spec.md).
