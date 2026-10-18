# Codebase Map

This map describes the live starter checkout. Proposed clinic-queue behavior is documented separately and may not be implemented yet; see [`PRD.md`](../PRD.md), [`ARD.md`](../ARD.md), and [`docs/STRUCTURE.md`](STRUCTURE.md).

## Current source areas

| Path | Responsibility today |
|---|---|
| `Queuing.slnx` | Includes the ASP.NET Core API and VB.NET core library projects. |
| `backend/Queuing.Api/Program.cs` | ASP.NET Core startup, controller registration, and current CORS setup. |
| `backend/Queuing.Api/Controllers/TestController.cs` | Placeholder `GET /api/test` endpoint. |
| `backend/Queuing.Core/Class1.vb` | Empty starter class; no queue domain behavior yet. |
| `frontend/src/main.jsx` | React root and router setup. |
| `frontend/src/App.jsx` | Starter screen; calls the placeholder API endpoint. |
| `frontend/src/index.css` | Global frontend styles. |
| `frontend/package.json` | Frontend dependencies and available `dev`, `lint`, and `build` scripts. |

## Current boundaries and gaps

- The API and core library target .NET 10; the API is C# and the core library is VB.NET.
- The frontend is React JavaScript with Vite. It has no test or typecheck script.
- There is no backend test project, database integration, queue module, or production deployment configuration in the current source tree.
- `skills/` contains agent guidance, not application code: `project-knowledge/` applies repository-wide; `clinic-queue/` guides queue-specific work; `render/` guides frontend/UI work and includes its upstream license and references.

For the actual folders and phased growth guidance, see [`STRUCTURE.md`](STRUCTURE.md). Do not treat proposed capabilities as live code until they appear in the source and have verification evidence.
