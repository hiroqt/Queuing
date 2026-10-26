# SPEC-013 — Reception receipt lookup hardening

**Status:** Implemented; MySQL integration pending · **Date:** 2026-10-25
**Extends:** [SPEC-008](../008-service-aware-visit-issue/spec.md), [SPEC-012](../012-department-ticket-numbering/spec.md)

## Goal

Let Reception recover the correct original receipt by clinic visit code or a non-identifying local reference, while keeping references out of receipt responses and printouts. Remove unsupported print modes and prevent ordinary API startup from applying database migrations.

## Confirmed decisions

- Reception explicitly selects Visit code or Non-identifying reference; input shape is never used to infer the lookup type.
- A reference may match multiple visits on the selected clinic date. Reception sees matching visit summaries and chooses one; the API never silently chooses a visit.
- Reference values are operational lookup keys only. UI guidance prohibits chart, card, patient, or other identifying values. The API does not return reference values in issue, search, or receipt responses, and receipts do not print them.
- Reference searches use an authenticated POST body, not a query string. Search and receipt responses disable caching. Existing audit records do not include the search value.
- The existing additive ReferenceId migration remains intact. Existing values are preserved; this change does not erase data.
- Reception retains manual 58 mm browser printing. Auto-print and the unverified 80 mm profile are removed.
- Normal API startup does not apply migrations. The one-time bootstrap command continues applying migrations for first-time setup; existing databases use the explicit `--apply-migrations` command before API startup.
- Reprint searches and receipt retrieval remain Reception-authorized. Each returned visit summary and each selected receipt is audited by visit ID, with no reference value in audit details. Receipt data represents the original step even after forwarding.

## Scope and contracts

- Add a Reception receipt-search endpoint accepting clinic date, explicit lookup type, and lookup value in a JSON body. Visit-code searches normalize one-to-three digit input to the canonical three-digit form and accept longer canonical sequence codes such as `1000`.
- Return a bounded, deterministically ordered list of visit summaries. The response signals when more than 100 matching visits were found and only returns the latest 100. Each match includes visit ID/code, clinic date, original Department ticket, Service/Department labels, issue time, and appointment time; it excludes ReferenceId.
- Add an authorized receipt retrieval endpoint keyed by selected visit ID. It returns the original receipt and records the existing reprint audit event. It never returns ReferenceId.
- Keep the existing visit-code GET receipt route for compatibility, support canonical codes longer than three digits, and remove its ReferenceId query behavior.
- Keep ReferenceId optional, trimmed, and limited to 50 characters at issue and search boundaries. Store it only for lookup; do not include it in response DTOs or audit detail.
- Remove startup `Database.MigrateAsync()` from the ordinary API path. Keep `AdminBootstrapper` migration behavior for an explicit `--bootstrap-admin` run and add an explicit `--apply-migrations` operation for existing databases.
- Preserve the current React/JavaScript stack and shared API client. No new package or project is required.

## Acceptance criteria

1. Reception explicitly selects Visit code or Non-identifying reference; numeric values cannot be misclassified.
2. A canonical visit code of `1000` is found as a visit code; short numeric code input is normalized, malformed codes return a clear 400.
3. A reference search with no match shows a friendly not-found state; one match can be opened; multiple matches show selectable summaries, including clinic issue time and Department ticket.
4. More than 100 matches return a bounded list and a `truncated` indicator; no match is silently selected.
5. Editing lookup type/value/date clears old candidates, and a slower earlier search response cannot replace a later search.
6. Search audits each returned visit summary and selecting a match retrieves that visit's original step after forwarding with a receipt audit event. Search and receipt responses do not include ReferenceId.
7. Reference values are sent in a POST body, not a URL. Search and receipt responses use `Cache-Control: no-store`; logged audit detail contains no reference value.
8. New issues retain the reference for lookup, but the UI identifies it only as non-identifying and responses/receipts omit it. Existing stored values are not deleted.
9. Reception offers only manual 58 mm printing. A successful issue never opens the print dialog automatically.
10. Normal API startup does not apply migrations. Explicit bootstrap and `--apply-migrations` runs apply pending migrations; both exit without starting the API.
11. Existing Reception authorization, CSRF, idempotent issue, clinic-date scoping, audit, and receipt-by-visit-code compatibility remain intact.

## Test seams

- Frontend unit seam: the shared API client sends explicit lookup mode/value/date in a POST body, including a code above 999.
- Mocked browser seam: Reception distinguishes lookup types, lists duplicate matches, opens a selected receipt, never auto-prints, omits the reference on the receipt, and manually invokes print.
- Opt-in MySQL/API/browser seam: issue two visits with the same reference, verify both are returned, select the intended visit after forwarding, verify original receipt and no reference in response; verify code 1000 lookup, authorization, cache headers, and malformed input.
- Static/backend verification: inspect ordinary startup and bootstrap paths separately; build and run focused API/Core tests.

## Out of scope

- Deleting or anonymizing already persisted ReferenceId values. Existing values are preserved until the owner authorizes a data cleanup after reviewing the database contents.
- Patient identity, chart lookup integration, person-level deduplication, or clinical records.
- Auto-print, selectable paper sizes, silent printer operation, and physical printer calibration.
- Multi-instance deployment, automated release migration orchestration, or production-readiness claims.

## Rollout

The ReferenceId column migration is additive and already exists. Apply it explicitly before starting the updated API against a database that has not received it. For an existing database, run the API with `--apply-migrations` and its normal `ConnectionStrings:Queueing` configuration. No visit rows are changed or removed.
