# PLAN-003 — Presentation queue dashboard

**Status:** Approved by the SPEC-003 decisions | **Date:** 2026-10-19

## Files and ownership

- `backend/Queuing.Core/QueueDemoStore.vb`: demo catalog, canonical number assignment, idempotent issue, and display projection.
- `backend/Queuing.Api/Controllers/QueueController.cs` and `Program.cs`: thin HTTP contract, Problem Details, and singleton registration.
- `backend/Queuing.Core.Tests/`: deterministic unit and concurrency checks for the VB.NET queue owner.
- `frontend/src/features/queue/`: API calls and the combined dashboard; existing design tokens and shell remain in use.
- `frontend/vite.config.js` and Playwright config: local API proxy and connected browser workflow.
- `docs/CODEBASE_MAP.md`, `docs/STRUCTURE.md`, and `README.md`: live ownership, demo setup, and limitation.

## Implementation order

1. Add queue-core tests for numbering, idempotency, rejection, display order, and concurrent issue.
2. Implement the in-memory VB.NET queue owner and thin API endpoints.
3. Add the frontend API client and integrate issue confirmation with the display snapshot.
4. Add a connected Playwright workflow and document the local start commands and restart limitation.
5. Build/test where the .NET SDK is available; inspect responsive and keyboard states; review the final diff.

## Verification

- `dotnet test Queuing.slnx`
- `npm test`, `npm run lint`, `npm run build`, `npm run test:e2e` from `frontend/`
- `git diff --check`

This environment currently has no .NET SDK or running Docker daemon. Backend checks will be attempted after implementation and reported with the actual outcome; no passing result is assumed.
