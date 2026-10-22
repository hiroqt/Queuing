# Plan — SPEC-008

## Architecture

Keep the current React SPA, versioned same-origin API client, ASP.NET Core API, EF Core/MySQL persistence, and modular-monolith deployment. Add a small Reception Visits feature inside `backend/Queuing.Api`; do not add a project or generic repository. Keep Staff state transitions in their existing queue controller, but update forwarding to accept a Service ID and derive its Department.

The API remains the authority for Service validity, Department ownership, visit numbering, appointment conversion, idempotency, and transitions. MySQL remains the source of truth. The sequence increment, Visit, initial step, idempotency result, audit row, and outbox row commit in the existing transaction. Reprint is a read-only query against the persisted Visit and its original step.

Add nullable `ServiceId` to DepartmentStep with a same-Department composite foreign key. Existing rows remain valid and are not assigned guessed Services. New issue and forward handlers validate active Service/Department records and set ServiceId. Keep the existing Department-level queue and display security contracts in this slice; station/service-specific call-next is still deferred.

## Source changes

### Backend

- Add a focused Reception Visits controller/use-case boundary for available Service choices, issue, and receipt lookup. Keep the current authenticated route and response conventions.
- Move only the Reception issue/receipt responsibilities out of `VisitCommandsController`; keep department queue reads, Call next, no-show, and completion/forward operations there.
- Share the existing idempotency, audit, and outbox behavior rather than creating a second implementation of those invariants.
- Extend the visit-step EF model, same-Department relationship mapping, and one additive migration/model snapshot.
- Add an authenticated available-Service query: Reception sees active issue choices; Staff sees active destination choices across Departments to preserve the approved any-next-department forwarding flow. Queue reads and calls remain limited to assigned Departments.
- Update the forward command to accept `nextServiceId`, validate its active Department, and atomically create the next service-linked step. Preserve the existing appointment parsing and final-completion path.
- Add code/date receipt lookup that resolves the original step and uses the existing clinic-date/sequence index. Preserve `GET /visits/{id}` during this change.

### Frontend

- Keep Reception components under `frontend/src/features/reception/`; replace the Department selector with an active Service selector showing its Department.
- Extend `frontend/src/api/client.js` for available Services, service-based issue, and code/date receipt lookup. Keep all API requests centralized.
- Add clinic-date input/default and daily visit-code lookup to the existing receipt area; successful issue populates the lookup criteria and receipt. Keep the manual Print/Reprint action and existing 58 mm print rules.
- Update the Staff forwarding form to choose a Service, with the owning Department visible, and submit the next Service ID plus optional appointment time.
- Preserve the existing visual system, role navigation, queue ordering, and public display layout.

### Documentation

- After implementation, update `docs/CODEBASE_MAP.md` with the Reception Visits boundary and service-aware forward ownership.
- Update `docs/STRUCTURE.md` only if a new feature folder is added.
- Link SPEC-008 from the root navigation and update its tasks/acceptance record with actual commands and results. Update the relevant ARD/PRD and SPEC-006 wording so their status matches the implemented service-aware issue/forward slice.

## Test-first and verification plan

1. Extend `frontend/tests/unit/api-client.test.js` for the available-Service, issue, forwarding, and receipt-lookup request contracts.
2. Extend the mocked Playwright workflow to cover Reception service choice, appointment payload, issue response, code/date receipt reprint, print button behavior, validation/error/empty states, and Staff forward Service selection.
3. Extend the opt-in `frontend/tests/e2e/clinic-mysql-integration.spec.js` against a disposable `_test` MySQL schema to verify active/inactive Service validation, Reception and Staff service visibility, service-linked issue/forward responses, issue idempotency, code/date receipt lookup after forwarding, and unauthorized access. Review that the additive nullable migration preserves existing rows without guessing Services.
4. Run focused .NET build/tests and frontend unit/lint/build/E2E checks. Run the MySQL integration only when its isolated database and test admin are configured; record it as not run if unavailable.
5. Inspect the final diff and migration, run `git diff --check`, and update SPEC-008 acceptance and `docs/CODEBASE_MAP.md` with observed results.

## Risks and compatibility

- The issue and forward request payloads change from Department IDs to Service IDs. Update the bundled frontend in the same release; do not claim compatibility with independently deployed old clients.
- Existing steps have no Service. The migration must preserve them and leave Service null; only newly issued/forwarded steps are required to carry a Service.
- Receipt lookup uses the Asia/Manila clinic date as part of identity because the daily code repeats. The UI and receipt must make that date discoverable to Reception.
- Service/Department labels are resolved from current configuration at reprint time. Renaming a record changes the displayed label on a later reprint; immutable label snapshots are deferred unless the owner asks for exact historical wording.
- API/controller unit testing does not replace MySQL verification of transactions, indexes, migration behavior, idempotency, or concurrency.
