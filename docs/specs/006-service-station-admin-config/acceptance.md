# Acceptance record — SPEC-006

**Status:** API and configuration behavior implemented and locally verified on 2026-10-21. The 2026-10-27 Admin usability, status/one-time-dialog, list search/pagination, and section-specific search follow-ups are implemented. The updated authenticated mocked browser workflow passed 14/14 tests and the opt-in local-setup workflow passed 2/2. Full visual review remains pending; the upgrade path on a populated pre-feature clinic database was not separately exercised.

| Requirement | Evidence | Status |
|---|---|---|
| Service and Station persistence with same-department associations | MySQL 8.4 integration verified create, persisted list, cross-department rejection, duplicate rejection, and concurrent duplicate conflicts on `queuing_test` | Passed |
| Admin-only API and Problem Details validation | MySQL integration verified staff denial for Services and Stations, input errors, and conflict responses | Passed |
| Invalid Station-Staff assignment cleanup | MySQL integration verified deactivation removes the staff link while preserving the station and service association | Passed |
| Section-based Admin routes manage configuration and preserve existing user access behavior | Updated authenticated Admin workflow passed in Playwright (14/14); local-setup route and Reception/Staff role guards passed (2/2). This covers the changed Dashboard route and the exercised configuration flows. Dashboard endpoint authorization still needs separate API verification. | Passed (mocked browser) |
| Admin usability follow-up across all six sections | The authenticated mocked workflow passed (14/14), covering Department, Service, Station, User, and Display actions, forms, assignments, and pairing. Kiosk-specific UI, search/pagination interactions, display deletion, and full six-page visual review remain unverified. Earlier screenshots cover Departments at desktop/mobile and Stations/Displays at desktop. | Implemented; partial UI review |
| Consistent Admin status badges and one-time secret dialogs | The mocked workflow passed status actions, temporary-password reveal/hide, and monitor pairing dialog checks. Kiosk pairing dialog and full visual review of all six pages remain unverified. | Implemented; partial verification |
| Admin list search and pagination | Shared controls apply to Departments, Users, Services, Stations, Displays, Kiosks, and lobby videos. Search submits on button/Enter and retains the existing per-list fields; search and status combine and reset pagination to page one. Pagination defaults to 10 rows, allows 10/25/50, and shows result range plus Previous/Next and page count. Latest lint/build and diff checks passed; browser interaction review was not run. | Implemented; partial verification |
| Section-specific search for Departments, Services, Stations, and Users | The shared Search bar appears whenever those lists contain records. Each has a specific prompt and matching fields; Users also matches directly assigned Department names for legacy access. Latest lint/build and diff checks passed; browser interaction review was not run. | Implemented; partial verification |
| Existing queue issue/call/forward/display behavior remains unchanged | .NET suite (18 passed), frontend unit suite (8 passed), mocked browser suite (6 passed), and MySQL visit/display flow passed | Passed |
| Additive migration | Migration applied as part of the full migration chain to a disposable fresh MySQL 8.4 test database | Passed |
| Upgrade from a populated pre-feature clinic database | Not separately simulated; the schema change is additive and does not alter existing queue tables | Not run |
| Parent/child active-state lifecycle | Department deactivation and inactive-Service assignment behavior are documented in `docs/OPEN_DECISIONS.md` for resolution before queue integration | Deferred |

Commands run:

- `npm test` — 8 passed.
- `npm run lint` — passed.
- `npm run build` — passed.
- `npm run test:e2e -- tests/e2e/clinic-authenticated-workflows.spec.js` — 6 passed.
- `QUEUING_MYSQL_E2E=1 npm run test:e2e -- tests/e2e/clinic-mysql-integration.spec.js` — 1 passed against disposable MySQL 8.4 database `queuing_test`.
- `dotnet test Queuing.slnx --no-restore --disable-build-servers -m:1 -p:UseSharedCompilation=false` — 18 passed; API compilation was also exercised by the Playwright web-server startup.
- `git diff --check` — passed.

The command results above record the earlier SPEC-006 implementation verification. Latest follow-up: frontend lint/build passed; the authenticated mocked Playwright workflow passed 14/14, and the opt-in local-setup workflow passed 2/2. These browser tests use mocked API responses and do not replace MySQL/API integration or a full visual review. The checks used a temporary Playwright config because the default API port was already occupied; that temporary config was removed afterward.

The isolated test database used synthetic records and was stopped after verification. No existing clinic database or deployed environment was changed.
