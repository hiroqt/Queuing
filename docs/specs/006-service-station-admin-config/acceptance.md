# Acceptance record — SPEC-006

**Status:** Implemented and locally verified on 2026-10-21. The upgrade path on a populated pre-feature clinic database was not separately exercised.

| Requirement | Evidence | Status |
|---|---|---|
| Service and Station persistence with same-department associations | MySQL 8.4 integration verified create, persisted list, cross-department rejection, duplicate rejection, and concurrent duplicate conflicts on `queuing_test` | Passed |
| Admin-only API and Problem Details validation | MySQL integration verified staff denial for Services and Stations, input errors, and conflict responses | Passed |
| Invalid Station-Staff assignment cleanup | MySQL integration verified deactivation removes the staff link while preserving the station and service association | Passed |
| Existing Admin page manages Services, Stations, and assignments | Playwright mocked browser flow verified Service and Station create/edit, department filtering, assignment display, and inactive staff exclusion | Passed |
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

The isolated test database used synthetic records and was stopped after verification. No existing clinic database or deployed environment was changed.
