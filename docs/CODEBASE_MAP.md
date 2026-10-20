# Codebase Map

This map describes the live checkout. Broader clinic-queue behavior remains proposed; see [`PRD.md`](../PRD.md), [`ARD.md`](../ARD.md), and [`docs/STRUCTURE.md`](STRUCTURE.md).

## Current source areas

| Path | Responsibility today |
|---|---|
| `Queuing.slnx` | Includes the ASP.NET Core API, VB.NET core library, and VB.NET core test project. |
| `backend/Queuing.Api/Program.cs` | ASP.NET Core startup, controller registration, Problem Details, and demo queue singleton. |
| `backend/Queuing.Api/Controllers/TestController.cs` | Placeholder `GET /api/test` endpoint. |
| `backend/Queuing.Api/Hubs/QueueHub.cs` | Read-only SignalR display snapshot endpoint; the API sends `TicketCalled` invalidation events after calls. |
| `backend/Queuing.Api/Controllers/QueueDisplayController.cs` | Anonymous REST snapshot `GET /api/queue/display` for the local public display. |
| `backend/Queuing.Api/Controllers/QueueController.cs` | Demo API for services, ticket issue/read, dashboard snapshot, and idempotent `POST /api/v1/queue/call-next`. |
| `backend/Queuing.Core/QueueDemoStore.vb` | Single in-memory source for issued, waiting, and called tickets; service-scoped FIFO call and per-process request idempotency. |
| `backend/Queuing.Core.Tests/` | Unit and concurrency tests for demo ticket issue/call behavior and consistent display snapshots. |
| `frontend/src/main.jsx` | React root, stylesheet import, and browser router. |
| `frontend/src/App.jsx` | Router configuration registering standalone `/display` kiosk and the staff workspace shell. |
| `frontend/src/pages/QueueDisplay.jsx` | Standalone public TV display for current/recent calls, with empty state and fullscreen control. |
| `frontend/src/services/queueHub.js` | Read-only SignalR client with snapshot recovery and disconnected polling fallback. |
| `frontend/src/features/queue/api.js` | Same-origin client for service lookup, issue, call-next, and dashboard snapshot endpoints. |
| `frontend/src/features/queue/QueueDashboard.jsx` | Staff demo flow for ticket issue, print-ready confirmation, service-scoped Call next, and waiting/calling snapshot. |
| `frontend/src/data/demo-snapshot.js` | Synthetic admin preview data only. |
| `frontend/src/index.css` | Responsive workspace, dashboard, display, marquee ticker, and browser-print styles. |
| `frontend/tests/` | Node API-client unit tests, queue display unit tests, and Playwright E2E test suite. |
| `docs/specs/003-presentation-queue/` | Original issue/display-only local-demo scope (historical after SPEC-004). |
| `docs/specs/004-demo-call-flow/` | Current approved local call-next flow, boundaries, and acceptance checks. |
| `docs/audits/frontend-accessibility-audit-2026-10-18.md` | Historical audit for the prior frontend-only routes; two shared contrast values and the brand accessible name were corrected, but the new dashboard has not had a full WCAG audit. |
| `frontend/package.json` | Frontend scripts: `dev`, `test`, `test:e2e`, `lint`, and `build`. |

## Current boundaries and gaps

- The API and core library target .NET 10; the API is C# and the core library is VB.NET.
- The presentation dashboard connects to the API for issue and service-scoped call-next; `/display` receives called-ticket snapshots and SignalR events. The single-process store resets on API restart. There is no database, authentication, display pairing, audit, outbox, or production deployment configuration.
- The demo starts empty. A call request can only move a real waiting ticket for the selected service; it cannot fabricate a ticket or fall back to another service. The SignalR Hub is read-only; commands use REST and call requests are idempotent for the life of the API process.
- Admin setup remains a static preview and does not configure the API catalog. Service choices for the demo are in the VB.NET core.
- `dotnet test Queuing.slnx` runs the core test project; frontend scripts include Node unit tests, Playwright E2E, lint, and build, but no typecheck script.
- `skills/` contains agent guidance, not application code: `project-knowledge/` applies repository-wide; `clinic-queue/` guides queue-specific work; `render/` guides frontend/UI work and includes its upstream license and references.

For the actual folders and phased growth guidance, see [`STRUCTURE.md`](STRUCTURE.md). Do not treat proposed capabilities as live code until they appear in the source and have verification evidence.
