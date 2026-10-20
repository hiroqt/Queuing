# Tasks — SPEC-005

Implementation and the covered local MySQL/API/browser checks are complete. The remaining tasks below identify explicit unverified behavior and operational work.

## A. Contracts and documentation

- [x] Record approved MySQL, stable visit code, appointment ordering, roles, forwarding, and device pairing decisions in SPEC-005, ADR-0002, PRD/ARD, open decisions, and repository guidance.
- [x] Document local configuration and bootstrap without committed credentials; keep production and recovery requirements open.

## B. Persistence and identity

- [x] Pin EF Core 10 and MySQL provider packages.
- [x] Add Identity sessions, cookie/antiforgery setup, login/pair rate limits, resource policies, and one-time bootstrap command.
- [x] Add relational model, design-time factory, initial migration, health endpoint, and bootstrap migrations.
- [x] Apply the initial and queue timestamp migrations to an isolated MySQL 8.4 database and verify schema creation/bootstrap.
- [x] Add and run an opt-in MySQL/browser integration workflow for authorization, sequence retry, appointment ordering, transitions, and competing callers.

## C. Configuration and monitor devices

- [x] Persist departments, roles/department assignments, monitor records, hashed revocable pairing credentials, audit records, and outbox records.
- [x] Add Admin API/UI for departments, users, and monitor creation, assignment, pairing, and revocation.
- [x] Verify paired displays load anonymously, receive live queue updates, and lose realtime/snapshot access after revocation against MySQL.
- [ ] Verify inactive departments cannot receive new work against MySQL.

## D. Visit issuance and department operations

- [x] Add clinic-wide daily sequence allocation in Asia/Manila, stable visit code, optional initial appointment time, and idempotent issue.
- [x] Add appointment-first/FIFO ordering, future-time exclusion, per-step appointment time, and scoped queue projections.
- [x] Add call-next, return-to-pending, complete/forward, final completion, conditional state transitions, idempotency, audit, and transactional outbox writes.
- [x] Verify appointment eligibility, duplicate retries, FIFO walk-ins, and competing callers against MySQL 8.4.
- [ ] Verify date rollover, competing issuers, and competing completion/forward actions against MySQL 8.x.

## E. Frontend and display

- [x] Add role-specific sign-in/workspace routes and forced password change for provisioned users.
- [x] Replace the sample admin UI with API-backed department, account, and monitor configuration.
- [x] Add reception issue/lookup/print and department queue/call/no-show/forward workflows.
- [x] Add a login-free display pairing route and assigned-department display view using the shared API client and device-only cookie.
- [x] Add mocked API-client/unit and browser workflow coverage for the supported screens.
- [x] Verify sign-in, issue, call-next, login-free display pairing, live display refresh, and revocation in a browser against the local API/MySQL instance.

## F. Handoff

- [x] Run .NET tests, covered MySQL integration/concurrency cases, frontend unit/E2E, lint, and build.
- [ ] Complete a separate final security review and the uncovered database race/date-rollover checks.
- [x] Update README, CODEBASE_MAP, STRUCTURE, frontend setup notes, and this task status.
- [ ] Document a tested MySQL migration/backup/restore and rollback procedure before any non-local deployment.
- [ ] Keep deployment to clinic production and use of live patient data outside this scope.
