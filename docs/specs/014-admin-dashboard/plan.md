# PLAN-014 — Admin dashboard

## Scope

Add a read-only Admin overview at `/admin`, including setup counts/checks and an auto-refreshing, count-only queue summary. Keep existing configuration pages and API behavior unchanged.

## Implementation sequence

1. Add SPEC-014 and this plan with the approved route, privacy, refresh, and acceptance contracts.
2. Add an Admin-authorized backend summary endpoint. Cache setup counts/checks in API memory for one minute; query active display counts, Department labels, and current Department queue counts on each request. A manual refresh bypasses and replaces the setup cache. Return no visit-level fields.
3. Add a frontend API method and Dashboard page. Load immediately, poll live display/queue data every 15 seconds, allow a manual refresh of all data, preserve the last successful snapshot on refresh failure, and expose update times.
4. Add Dashboard to Admin navigation and render it at the Admin index while preserving all six direct routes.
5. Add focused styling consistent with the current Admin tokens; update PRD and codebase navigation.
6. Review endpoint projection, authorization, routes, existing modified files, and the final diff. Run frontend lint/build. Tests are not run in this change.

## Files

- `backend/Queuing.Api/Controllers/AdminDashboardController.cs` — Admin-protected aggregate endpoint.
- `frontend/src/api/client.js` — summary API method.
- `frontend/src/App.jsx` — dashboard route and `/admin` index.
- `frontend/src/features/admin/AdminNavigation.jsx`, `adminSections.js` — Dashboard navigation item.
- `frontend/src/features/admin/sections/AdminDashboardSection.jsx` — overview, setup checks, live queue counts.
- `frontend/src/index.css` — dashboard-specific responsive styling.
- `PRD.md`, `docs/CODEBASE_MAP.md`, and this spec directory — approved behavior and navigation.

## Risks and limits

- Queue counts are refreshed every 15 seconds, not pushed over SignalR. This avoids broadening the display-only hub's authorization contract.
- Setup counts/checks can be up to one minute old; manual refresh recomputes them. The in-memory cache is per API process and is suitable for the current single-process local deployment.
- Counts are a best-effort point-in-time projection; configuration and queue records may change during a refresh.
- MySQL translation/performance for aggregate EF queries and actual authenticated/local-setup endpoint behavior remain verification items if the local database is unavailable.
