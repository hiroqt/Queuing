# Codebase Map

This map describes the live checkout. Broader clinic-queue behavior remains proposed; see [`PRD.md`](../PRD.md), [`ARD.md`](../ARD.md), and [`docs/STRUCTURE.md`](STRUCTURE.md).

## Current source areas

| Path | Responsibility today |
|---|---|
| `Queuing.slnx` | Includes the ASP.NET Core API, VB.NET core library, and VB.NET core test project. |
| `backend/Queuing.Api/Program.cs` | ASP.NET Core startup, controller registration, Problem Details, and demo queue singleton. |
| `backend/Queuing.Api/Controllers/TestController.cs` | Placeholder `GET /api/test` endpoint. |
| `backend/Queuing.Api/Hubs/QueueHub.cs` | SignalR Hub mapped to `/hubs/queue` broadcasting real-time `TicketCalled`, `TicketRecalled`, and snapshots. |
| `backend/Queuing.Api/Controllers/QueueDisplayController.cs` | REST fallback `GET /api/queue/display` and broadcast command endpoints (`/call`, `/recall`). |
| `backend/Queuing.Api/Controllers/QueueController.cs` | Demo API for services, ticket issue/read, and the anonymous queue display projection. |
| `backend/Queuing.Core/QueueDemoStore.vb` | Thread-safe in-memory service catalog, sequence/idempotency, and multi-counter active display projection. |
| `backend/Queuing.Core.Tests/` | Unit and concurrency tests for demo queue core, ticketing, display snapshots, and calling. |
| `frontend/src/main.jsx` | React root, stylesheet import, and browser router. |
| `frontend/src/App.jsx` | Router configuration registering standalone `/display` kiosk and the staff workspace shell. |
| `frontend/src/pages/QueueDisplay.jsx` | Standalone full-screen 16:9 public display board ("Now Serving" hero, counter grid, marquee ticker). |
| `frontend/src/services/queueHub.js` | SignalR connection service, Web Audio chime synthesis, Web Speech announcements, and polling fallback. |
| `frontend/src/features/queue/api.js` | Same-origin client for service lookup, issue, and display snapshot endpoints. |
| `frontend/src/features/queue/QueueDashboard.jsx` | Combined ticket issue, print-ready confirmation, and waiting/calling display. |
| `frontend/src/data/demo-snapshot.js` | Synthetic admin preview data only. |
| `frontend/src/index.css` | Responsive workspace, dashboard, display, marquee ticker, and browser-print styles. |
| `frontend/tests/` | Node API-client unit tests, queue display unit tests, and Playwright E2E test suite. |
| `docs/specs/003-presentation-queue/` | Approved local-demo behavior, architecture limits, and acceptance checks. |
| `docs/audits/frontend-accessibility-audit-2026-10-18.md` | Historical audit for the prior frontend-only routes; two shared contrast values and the brand accessible name were corrected, but the new dashboard has not had a full WCAG audit. |
| `frontend/package.json` | Frontend scripts: `dev`, `test`, `test:e2e`, `lint`, and `build`. |

## Current boundaries and gaps

- The API and core library target .NET 10; the API is C# and the core library is VB.NET.
- The presentation dashboard connects to the API for issuing and showing tickets. Its process-local state resets on API restart; there is no database, authentication, call command, realtime transport, or production deployment configuration.
- Admin setup remains a static preview and does not configure the API catalog. Service choices for the demo are in the VB.NET core.
- `dotnet test Queuing.slnx` runs the core test project; frontend scripts include Node unit tests, Playwright E2E, lint, and build, but no typecheck script.
- `skills/` contains agent guidance, not application code: `project-knowledge/` applies repository-wide; `clinic-queue/` guides queue-specific work; `render/` guides frontend/UI work and includes its upstream license and references.

For the actual folders and phased growth guidance, see [`STRUCTURE.md`](STRUCTURE.md). Do not treat proposed capabilities as live code until they appear in the source and have verification evidence.
