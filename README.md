# Queuing

A local clinic queue app with an ASP.NET Core API, a VB.NET workflow library, and a React SPA. The MVP keeps one anonymous visit code while the visit moves between configurable departments.

## Current implementation

- **API:** C# ASP.NET Core 10, ASP.NET Identity cookie sessions, EF Core 10, and MySQL 8.x.
- **Core:** VB.NET transition and appointment eligibility rules in `backend/Queuing.Core/`.
- **Frontend:** React JavaScript + Vite in `frontend/`; versioned HTTP calls are centralized in `frontend/src/api/client.js`.
- **Workflow:** Admin configures departments, services, physical stations, staff assignments, and monitors; Reception issues a visit; assigned staff call, return a no-show to pending, and complete or forward the visit.
- **Displays:** Open `/display/pair` in a new monitor tab and enter its one-time admin-generated code. The monitor receives a revocable device-only cookie and opens `/display` without a staff username or password.
- **Persistence:** `backend/Queuing.Api/Data/Migrations/` contains the initial schema, queue timestamp precision, and service/station configuration migrations. The one-time `--bootstrap-admin` command applies migrations and seeds the three initial departments and roles.

The visit code is clinic-wide and daily, based on `Asia/Manila`; it can repeat on a later date. Department ordering is due appointments first, then FIFO walk-ins. The API is the queue authority. A display receives only its department name and anonymous visit codes. No patient identifiers are collected.

This is a local MVP implementation. The opt-in MySQL and browser workflow is recorded in SPEC-005; it does not establish backup/restore readiness, multi-instance behavior, or production readiness. Use synthetic visits and a dedicated local database.

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

Run the API and frontend in separate terminals:

```sh
ASPNETCORE_ENVIRONMENT=Development dotnet run --no-launch-profile --project backend/Queuing.Api --urls http://127.0.0.1:5271
npm --prefix frontend ci
npm --prefix frontend run dev -- --host 127.0.0.1
```

Open the frontend at `http://127.0.0.1:5173`. To pair a monitor, open `http://127.0.0.1:5173/display/pair` in a new tab on that monitor; after activation, leave the tab on the department display. Vite forwards `/api` and `/hubs` to the local API.

## Checks

```sh
dotnet build Queuing.slnx
dotnet test Queuing.slnx
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix frontend run test:e2e
```

The default Playwright browser tests mock API responses. An opt-in test starts the real API and frontend against an isolated MySQL test database and exercises configuration authorization, service/station assignments, queue operations, browser issue/call, monitor pairing, live updates, and revocation. It creates test departments, services, stations, and visits; run it only against a disposable database whose name ends with `_test`.

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
- `docs/adr/0002-mysql-and-forwarding-visits.md` — selected MySQL provider and stable forwarded visit-code decisions.
- `docs/CODEBASE_MAP.md`, `docs/STRUCTURE.md` — current source map and layout.
- `skills/project-knowledge/SKILL.md` — default documentation and knowledge retention guidance.
- `skills/clinic-queue/SKILL.md` — queue, authorization, persistence, and display boundaries.
- `skills/render/SKILL.md` — frontend implementation and quality workflow.
