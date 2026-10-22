# SPEC-008 acceptance record

**Status:** Implemented and locally verified · **Date:** 2026-10-22

## Behavior evidence

| Acceptance | Evidence | Result |
|---|---|---|
| Reception loads active Services and issues by `initialServiceId`; API derives Department and persists the Service on the first step. | Opt-in MySQL/API/browser flow issued from an active Service; response included its Service and owning Department. An inactive Service was omitted and rejected with `400`. | Passed |
| Issue keeps the stable daily clinic code and idempotent behavior. | MySQL flow replayed the same key/payload without another Visit, returned the original result after its Service was deactivated, and returned `409` for a different Service under the same key. Two simultaneous requests with the same key produced one `201` and one `200`, both with the same Visit ID. | Passed |
| Staff can forward by active `nextServiceId`; Department is derived and the step remains in the existing department queue. | MySQL/API/browser flow rejected an inactive destination, forwarded to an active Service, called the Visit in the destination Department, and retained the visit code. The staff UI selected the destination Service. | Passed |
| Staff can see active destination Services for the previously approved any-next-department flow, while queue access stays department-scoped. | MySQL flow read destination choices as a Staff user assigned only to another Department; the same user received `403` for an unauthorized queue. | Passed |
| Reception can reprint the original issue details by canonical visit code and clinic date after forwarding. | MySQL flow resolved the original Service/Department after the current step advanced. Malformed lookup returned `400`; a well-formed missing code/date pair returned `404`. Browser workflow reloaded the page and found the receipt by code/date. | Passed |
| Historical steps may omit Service; new issue/forward steps require one. | EF migration adds nullable `DepartmentSteps.ServiceId` with a composite same-Department foreign key and no backfill. The migration applied successfully to a disposable MySQL 8.4 schema. | Schema review passed; populated pre-migration row preservation was not separately simulated |
| Existing manual 58 mm browser print remains, with no redesign or duplicate issue on reprint. | Mocked Playwright verified Print/Reprint invokes `window.print`; reprint calls the read-only receipt endpoint. Existing print CSS is unchanged. | Passed; physical printer output not verified |

## Commands and results

- `dotnet build Queuing.slnx --no-restore --disable-build-servers -m:1 -p:UseSharedCompilation=false` — passed, 0 warnings and 0 errors.
- `dotnet test Queuing.slnx --no-restore --disable-build-servers -m:1 -p:UseSharedCompilation=false` — passed, 31 tests (13 API + 18 core).
- `npm test` — passed, 9 frontend unit tests; `npm run lint` and `npm run build` — passed.
- `npm test` — passed, 9 frontend unit tests; `npm run lint` and `npm run build` — passed.
- Playwright mocked workflows — passed, 8 tests; the opt-in MySQL integration and local-setup mode test were skipped in this run. The full browser integration below ran separately.
- Opt-in MySQL/API/browser integration — passed, 1 test against disposable MySQL 8.4. It covered service deactivation replay, concurrent same-key issue, forwarding, receipt reload, and paired-display browser behavior. The pre-existing local Vite process occupied port 4173, so this run used temporary local servers on 4174 and a temporary Playwright config; the config was removed after verification.
- `dotnet-ef database update` — applied all four migrations, including `ServiceAwareVisitSteps`, to the disposable MySQL 8.4 schema. The container was stopped and removed after verification.
- Test-first evidence: the new API-client contract checks failed against the old client payload/absent methods before implementation, then passed after implementation.

## Limits

- The migration was applied to a fresh disposable schema. A populated pre-SPEC-008 schema was not separately migrated in this run; the migration only adds a nullable column, index, and foreign key and performs no data rewrite or guessed backfill.
- Date rollover, concurrent forwarding/different-key issue races, multi-instance operation, recovery, production deployment, and actual 58 mm printer output remain unverified.
- Tests used synthetic data only; no patient identity was added.
