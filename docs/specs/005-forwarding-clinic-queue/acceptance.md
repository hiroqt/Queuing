# Acceptance record — SPEC-005

**Status:** The covered local MVP flow passed against a disposable MySQL 8.4 database and a real browser. This is not production or recovery readiness.

| Requirement | Evidence | Status |
|---|---|---|
| Local durable setup, migration, and one-time admin bootstrap | Applied `InitialClinicQueue` and `DepartmentStepEntryPrecision` to a fresh `queuing_test` MySQL 8.4 schema; the one-time bootstrap created the initial admin, roles, and departments. | Verified locally |
| Dynamic departments, user assignments, and monitors | Live MySQL workflow created per-run departments, provisioned Reception/Staff users, enforced department scope, created and paired a monitor, then revoked it. | Verified locally |
| Stable daily clinic code and retry behavior | Replaying the same issue key returned the original visit; reusing that key with a different payload returned 409. | Retry verified; concurrent issue and date rollover not covered |
| Appointment ordering and walk-in FIFO | A due appointment was called before walk-ins; a future appointment stayed ineligible; sequential walk-ins were selected in entry order. | Verified locally |
| Assigned staff scope, forced password change, cookie sessions, and antiforgery | Wrong-department API access returned 403. Provisioned users changed their temporary passwords; the real browser signed in and issued/called through the centralized API client. | Verified locally |
| Call, no-show, re-call, forwarding, and concurrent caller behavior | Same visit returned to pending and was recalled, forwarded with its stable code, and completed. Concurrent call requests did not call the same step; one got 409 when only one eligible visit remained. | Covered flows verified; concurrent completion/forwarding not covered |
| Paired monitor is login-free and department-scoped | A clean browser context paired without a staff login, loaded its assigned department, updated after a call, and showed revocation through the live connection. Snapshot contained anonymous ticket codes only. | Verified locally |
| Frontend workflows and API client consistency | Central HTTP client unit coverage, mocked browser workflows, and one live browser-to-API/MySQL workflow passed. | Verified locally |
| Audit and post-commit display invalidation | Queue actions produced live display refreshes through the outbox. This run did not query or assert audit records directly. | Refresh verified; audit persistence not directly asserted |

## Executed checks

- `dotnet build Queuing.slnx --no-restore --disable-build-servers -m:1 -p:UseSharedCompilation=false` — passed, 0 warnings/errors.
- `dotnet test Queuing.slnx --no-restore --disable-build-servers -m:1 -p:UseSharedCompilation=false` — passed, 18 tests.
- `npm run lint` — passed.
- `node --test tests/unit/*.test.js` — passed, 7 tests.
- `npm run build` — passed.
- Default `npm run test:e2e` — 6 browser tests passed; the opt-in MySQL test was skipped.
- Opt-in `npm run test:e2e -- tests/e2e/clinic-mysql-integration.spec.js` with a disposable MySQL 8.4 database and bootstrapped test admin — passed. It covered real API requests and browser issue → call → display pairing/update/revocation.
- EF migrations applied successfully to the fresh local test schema, then the timestamp-precision migration applied to that same isolated schema.

The integration test creates unique test departments and visits that remain in its database. Use only a disposable schema ending in `_test`. Date rollover, concurrent issue/forward races, migration rollback, backup/restore, multi-instance operation, and production exposure remain unverified and out of this local acceptance run.
