# Queuing

A local clinic queue app with an ASP.NET Core API, a VB.NET workflow library, and a React SPA. The MVP keeps one anonymous visit code while the visit moves between configurable departments.

## Current implementation

- **API:** C# ASP.NET Core 10, ASP.NET Identity cookie sessions, EF Core 10, and MySQL 8.x.
- **Core:** VB.NET transition and appointment eligibility rules in `backend/Queuing.Core/`.
- **Frontend:** React JavaScript + Vite in `frontend/`; versioned HTTP calls are centralized in `frontend/src/api/client.js`.
- **Workflow:** Admin configures departments, services, physical stations, staff assignments, and monitors; Reception chooses an active service and issues a visit; assigned staff call, return a no-show to pending, then complete or forward the visit by choosing its next service.
- **Kiosk:** Admin registers a kiosk and generates a one-time pairing code. At `/kiosk`, a paired device lets walk-ins choose a Department, then a Service, confirm, and issue an anonymous ticket through the same daily sequence as Reception. Kiosks cannot read queues or staff records.
- **Displays:** Open `/display/pair` in a new monitor tab and enter its one-time admin-generated code. The monitor receives a revocable device-only cookie and opens `/display` without a staff username or password.
- **Persistence:** `backend/Queuing.Api/Data/Migrations/` contains the initial schema, queue timestamp precision, Service/Station configuration, service-linked visit-step, kiosk issuer, Service-scoped Staff assignment, lobby display/video, Department ticket sequence, and Reference ID migrations. The one-time `--bootstrap-admin` command applies migrations and seeds the three initial departments and roles.

Each Department issues its own daily ticket numbers, starting at `001`; a forwarded visit receives a number in the destination Department. The clinic-wide visit code remains stable for receipt lookup and continuity. Reception searches by an explicit visit-code or non-identifying-reference mode; duplicate reference matches require choosing the intended visit. References are lookup keys only and are never included in API receipt responses or printouts. Reception and kiosk print manually using the 58 mm receipt layout. Service determines each step's Department. Staff see/call only their assigned Services within it; ordering is due appointments first, then FIFO walk-ins across those Services. The API is the queue authority. Displays show anonymous Department ticket numbers only. Do not enter patient, chart, or card identifiers as references.

Staff accounts are individually authenticated and Admin assigns each account to one or more Services. Staff queue reads and actions are restricted to assigned Services; unassigned Services in the same Department are excluded. The approved migration backfills existing Staff Department assignments to that Department's Services. See [SPEC-011](docs/specs/011-service-scoped-staff-access/spec.md).

This is a local MVP implementation. The opt-in MySQL and browser workflow is recorded in SPEC-005; it does not establish backup/restore readiness, multi-instance behavior, or production readiness. Use synthetic visits and a dedicated local database.

SPEC-009 kiosk source and migration are implemented, but kiosk API behavior, migration application, browser accessibility/responsiveness, and physical printing have not yet been verified in this checkout.

## Local setup

Use a local MySQL 8.x database and a dedicated application user with schema permissions. Store local connection and bootstrap values with .NET User Secrets; do not commit passwords.

```sh
dotnet user-secrets set --project backend/Queuing.Api "ConnectionStrings:Queueing" "Server=127.0.0.1;Port=3306;Database=queuing_dev;User ID=queuing_app;Password=<local-secret>;"
dotnet user-secrets set --project backend/Queuing.Api "BootstrapAdmin:UserName" "clinic-admin"
dotnet user-secrets set --project backend/Queuing.Api "BootstrapAdmin:Password" "<unique-password-at-least-12-characters>"
ASPNETCORE_ENVIRONMENT=Development dotnet run --no-launch-profile --project backend/Queuing.Api -- --bootstrap-admin
```

After the bootstrap command succeeds, remove its one-time values from User Secrets:

```sh
dotnet user-secrets remove --project backend/Queuing.Api "BootstrapAdmin:Password"
dotnet user-secrets remove --project backend/Queuing.Api "BootstrapAdmin:UserName"
```

The one-time `--bootstrap-admin` command applies migrations while creating the first administrator. Normal API startup does not change the schema. Before starting against an existing database, apply pending migrations explicitly and exit:

```sh
ASPNETCORE_ENVIRONMENT=Development ConnectionStrings__Queueing='Server=127.0.0.1;Port=3306;Database=queuing_dev;User ID=queuing_app;Password=<local-secret>;' \
dotnet run --no-launch-profile --project backend/Queuing.Api -- --apply-migrations
```

Run this only against the intended database. The configured database account needs migration/schema permissions for this command; use a separate deployment migration identity where applicable.

Run the API and frontend in separate terminals:

```sh
ASPNETCORE_ENVIRONMENT=Development dotnet run --no-launch-profile --project backend/Queuing.Api --urls http://127.0.0.1:5271
npm --prefix frontend ci
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

The default Vite development session opens the Admin workspace without sign-in so clinic configuration can be prepared before accounts exist. Use Admin's **Sign out** control to exit the bypass for the current browser tab and reach the normal login page. `/reception` and `/department` require real Reception and Staff accounts and redirect signed-out users to `/login`. Admin configuration API access remains available only when `LocalSetup:Enabled` is true, ASP.NET Core is in `Development`, and both the request Host and remote address are loopback. Keep both servers bound to `127.0.0.1`; Admin changes in this mode have no authenticated actor ID in the audit record.

Reception and Staff login works with the default local setup mode. To require an authenticated Admin session too, start Vite with `VITE_LOCAL_SETUP_MODE=false` and the API with `LocalSetup__Enabled=false`. A production Vite build does not enable the frontend bypass. See [SPEC-007](docs/specs/007-local-admin-setup-mode/spec.md).

Open the frontend at `http://127.0.0.1:5174`. To pair a monitor, open `http://127.0.0.1:5174/display/pair` in a new tab on that monitor; after activation, leave the tab on the department display. To pair a kiosk, register it under Admin → Kiosks, create a pairing code, open `http://127.0.0.1:5174/kiosk/pair` on the kiosk device, then leave the browser at `/kiosk`. Vite forwards `/api` and `/hubs` to the local API.

## Checks

```sh
dotnet build Queuing.slnx
dotnet test Queuing.slnx
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix frontend run test:e2e
```

The default Playwright browser tests mock API responses. An opt-in test starts the real API and frontend against an isolated MySQL test database and exercises configuration authorization, service/station assignments, service-linked issue and forwarding, code/date receipt reprint, queue operations, monitor pairing, live updates, and revocation. It creates test departments, services, stations, and visits; run it only against a disposable database whose name ends with `_test`.

To exercise the no-login local setup route with mocked API responses, run `QUEUING_LOCAL_SETUP_E2E=1 npm --prefix frontend run test:e2e -- tests/e2e/local-setup-mode.spec.js` after configuring the local API connection string.

From `frontend/`, provide a bootstrapped test administrator and run:

```sh
ConnectionStrings__Queueing='Server=127.0.0.1;Port=3306;Database=queuing_test;User ID=queuing_test;Password=<test-secret>;' \
QUEUING_MYSQL_E2E=1 \
QUEUING_E2E_ADMIN_USERNAME='clinic-admin' \
QUEUING_E2E_ADMIN_PASSWORD='<test-admin-password>' \
npm run test:e2e -- tests/e2e/clinic-mysql-integration.spec.js
```

## Repository guide

- `AGENTS.md` — repository boundaries and required engineering workflow.
- `PRD.md`, `ARD.md`, `SDD.md` — product, architecture, and development notes.
- `docs/specs/005-forwarding-clinic-queue/` — approved MVP brief, plan, tasks, and acceptance record.
- `docs/specs/007-local-admin-setup-mode/` — temporary loopback-only no-login setup mode for local development.
- `docs/specs/008-service-aware-visit-issue/` — service-based Reception issue, forwarding, and receipt reprint by daily code/date.
- `docs/specs/009-self-service-kiosk/` — department-first walk-in kiosk, independent device pairing, API scope, responsive UI direction, and acceptance criteria.
- `docs/specs/011-service-scoped-staff-access/` — Staff Service assignments, queue authorization, existing-account backfill, and verification criteria.
- `docs/specs/012-department-ticket-numbering/` — independent Department daily tickets and lobby muted autoplay.
- `docs/specs/013-reception-receipt-lookup-hardening/` — explicit receipt search, duplicate-reference selection, private lookup responses, manual 58 mm printing, and explicit migration startup.
- `docs/adr/0002-mysql-and-forwarding-visits.md` — selected MySQL provider and stable forwarded visit-code decisions.
- `docs/CODEBASE_MAP.md`, `docs/STRUCTURE.md` — current source map and layout.
- `skills/project-knowledge/SKILL.md` — default documentation and knowledge retention guidance.
- `skills/clinic-queue/SKILL.md` — queue, authorization, persistence, and display boundaries.
- `skills/render/SKILL.md` — frontend implementation and quality workflow.
