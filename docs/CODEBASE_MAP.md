# Codebase Map

This map describes the current SPEC-005 queue and SPEC-006 admin configuration implementations. Their accepted scopes live in [`SPEC-005`](specs/005-forwarding-clinic-queue/spec.md) and [`SPEC-006`](specs/006-service-station-admin-config/spec.md); operational readiness remains limited to local synthetic-data use.

## Backend

| Path | Responsibility |
|---|---|
| `backend/Queuing.Api/Program.cs` | ASP.NET Core composition root, MySQL/EF configuration, Identity cookies, antiforgery, rate limits, policies, health routes, SignalR, and outbox startup. |
| `backend/Queuing.Api/Auth/` | One-time admin bootstrap, role constants, department authorization, display-device authentication, and password-change claims. |
| `backend/Queuing.Api/Controllers/AuthController.cs` | Session, login/logout, CSRF token, and forced password change. |
| `backend/Queuing.Api/Controllers/AdminUsersController.cs` | Admin-provisioned accounts, roles, department assignments, temporary credential, and audit. |
| `backend/Queuing.Api/Controllers/AdminServicesController.cs` | Admin-only Service configuration and audit. |
| `backend/Queuing.Api/Controllers/AdminStationsController.cs` | Admin-only physical Station configuration, same-department Service/Staff associations, and audit. |
| `backend/Queuing.Api/Controllers/DepartmentsController.cs` | Dynamic active department choices and admin create/update/deactivation. |
| `backend/Queuing.Api/Controllers/DisplaysController.cs` | Admin monitor configuration and pairing code; anonymous activation; device-scoped snapshot and revocation. |
| `backend/Queuing.Api/Controllers/VisitCommandsController.cs` | Reception visit issuance and lookup; staff queue, call-next, no-show requeue, complete/forward, idempotency, audit, and outbox writes. |
| `backend/Queuing.Api/Data/QueueDbContext.cs` | Identity, department, Service/Station associations, and clinic queue relational model and indexes. |
| `backend/Queuing.Api/Data/Migrations/` | MySQL initial schema, queue timestamp precision, Service/Station configuration, and model snapshot. |
| `backend/Queuing.Api/Data/QueueDbContextFactory.cs` | EF design-time connection configuration for migrations. |
| `backend/Queuing.Api/Services/QueueOutboxDispatcher.cs` | Dispatches committed queue-change invalidations to department-scoped SignalR groups. |
| `backend/Queuing.Api/Hubs/QueueHub.cs` | Device-authenticated, department-scoped read-only notification hub. |
| `backend/Queuing.Core/DepartmentQueuePolicy.vb` | Framework-independent step transition and appointment eligibility rules. |
| `backend/Queuing.Core/QueueDemoStore.vb` | Historical in-memory demo implementation; not registered as the current API queue authority. |
| `backend/Queuing.Core.Tests/` | xUnit checks for legacy demo behavior and current VB.NET queue policy rules. |

## Frontend

| Path | Responsibility |
|---|---|
| `frontend/src/App.jsx` | Public display pairing/view routes and authenticated workspace route tree. |
| `frontend/src/api/client.js` | Central same-origin `/api/v1` fetch client, antiforgery token, session, department/user/service/station/display admin, visit, and queue API methods. |
| `frontend/src/auth/` | Login, session provider, role guards, and forced password change. |
| `frontend/src/features/admin/AdminPage.jsx` | Department, Service, Station/Staff assignment, user, and monitor configuration. |
| `frontend/src/features/reception/ReceptionPage.jsx` | Visit issue, anonymous receipt, browser print, and lookup. |
| `frontend/src/features/department/DepartmentQueuePage.jsx` | Assigned queue, call-next, no-show requeue, completion, and forwarding. |
| `frontend/src/features/display/` | One-time pairing route and anonymous read-only department display. |
| `frontend/tests/unit/` | API client, idempotency header, appointment payload, and role unit tests. |
| `frontend/tests/e2e/clinic-authenticated-workflows.spec.js` | Playwright UI workflows with mocked HTTP API responses. |
| `frontend/tests/e2e/clinic-mysql-integration.spec.js` | Opt-in MySQL/API/browser workflow for admin configuration, queue behavior, and paired displays; uses a disposable `_test` database and a bootstrapped test admin. |

All HTTP API calls use the shared client. The display SignalR connection is a separate realtime transport and carries only `QueueChanged` invalidations; the screen reloads its scoped REST snapshot.

## Current boundaries and gaps

- Current stack is C# ASP.NET Core 10 API, VB.NET core, and React JavaScript/Vite. No incidental language or framework migration is approved.
- MySQL 8.x/InnoDB is the selected database for SPEC-005, recorded in [ADR-0002](adr/0002-mysql-and-forwarding-visits.md). Earlier PostgreSQL references are architectural proposals or historical specs.
- SPEC-006 adds dynamic Services and physical Stations to admin configuration. The current queue remains department-scoped: issue, forwarding, call-next, and display contracts do not yet consume Service or Station configuration.
- The stable clinic-wide daily visit code uses `Asia/Manila` and remains unchanged while department steps advance. It may repeat on a later clinic date; lookups use visit ID.
- `/display/pair` and `/display` bypass the staff sign-in route. Pairing is one-time and rate limited; the API stores a hash of the revocable device credential and scopes the cookie to one active department.
- The current display projection contains department name and anonymous visit code/status only. It does not include patient identity, appointment time, or staff information.
- `skills/` contains agent guidance, not application code. `skills/project-knowledge/` applies repository-wide; `skills/clinic-queue/` covers queue/security/persistence; `skills/render/` covers frontend work.
- A MySQL 8.4 migration/bootstrap and covered API/browser queue flow have passed locally; date rollover, concurrent issue/forward races, backup/restore, multi-instance operation, production deployment, and live patient data remain unverified or out of scope.

For directory layout and growth rules, see [`STRUCTURE.md`](STRUCTURE.md). For the queue and configuration briefs and acceptance evidence, see [`SPEC-005`](specs/005-forwarding-clinic-queue/spec.md) and [`SPEC-006`](specs/006-service-station-admin-config/spec.md).
