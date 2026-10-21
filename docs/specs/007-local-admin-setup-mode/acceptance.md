# Acceptance record — SPEC-007

**Status:** Implemented and locally verified on 2026-10-21. The API integration used a disposable MySQL 8.4 `queuing_test` database; its container was stopped after the run.

| Requirement | Evidence | Status |
|---|---|---|
| Vite development opens Admin without a login screen or session request | Playwright local setup route test verified `/` redirects to `/admin`, the Clinic configuration page and local-mode label appear, and no session/login request is made | Passed |
| Anonymous loopback Admin configuration read/write works with antiforgery | Opt-in MySQL/API integration read the Admin services endpoint and created a department using the existing CSRF client without a login cookie | Passed |
| Local setup does not grant queue access | Same API integration requested an anonymous department queue and received `401` | Passed |
| Real signed-in setup and queue workflows remain usable | Opt-in MySQL browser/API workflow completed Admin config, login, reception issue, staff queue, and paired display flow | Passed |
| Environment, enable flag, Host, remote address, and API path boundaries | `Queuing.Api.Tests` covers disabled mode, Production, non-loopback remote/Host, IPv4/IPv6 loopback, and paths outside Admin configuration | Passed |
| Production frontend retains normal login behavior | Production Vite build passed; standard authenticated Playwright workflows passed with local setup disabled | Passed |

Commands and outcomes:

- `dotnet build Queuing.slnx --no-restore --disable-build-servers -m:1 -p:UseSharedCompilation=false` — passed, 0 warnings/errors.
- `dotnet test Queuing.slnx --no-restore --disable-build-servers -m:1 -p:UseSharedCompilation=false` — 31 passed (13 setup-boundary, 18 core).
- `npm --prefix frontend test` — 8 passed.
- `npm --prefix frontend run lint` — passed.
- `npm --prefix frontend run build` — passed.
- `QUEUING_LOCAL_SETUP_E2E=1 npm run test:e2e -- tests/e2e/local-setup-mode.spec.js` — 1 passed.
- `npm run test:e2e` — 6 passed, 2 opt-in tests skipped.
- `QUEUING_MYSQL_E2E=1 npm run test:e2e -- tests/e2e/clinic-mysql-integration.spec.js` — 1 passed against disposable MySQL 8.4.
- `git diff --check` — passed.

No database schema changed. Admin actions made without a signed-in administrator have a null audit actor ID. Keep Vite and the API loopback-bound and turn off `VITE_LOCAL_SETUP_MODE` and `LocalSetup:Enabled` before using a shared or network-exposed environment.
