# SPEC-001 — Core Clinic Queue MVP

**Status:** Proposed | **PRD:** FR-01..FR-13 | **Scope:** Admin + Staff + Ticket/Print + Public Display only.

## Actors and permissions
- Admin configures services, counters, staff assignments, numbering rules, ticket templates, display device profiles and views audit.
- Staff operates authorized counter(s), issues tickets for allowed services, calls next, recalls, skips, completes, prints/reprints.
- Paired display obtains non-sensitive assigned queue snapshots and listens for updates; no mutation ability.

## Business rules
1. Admin can add/deactivate services and counters; referenced items remain in historical data.
2. Each service in each queue session has unique monotonically allocated ticket sequence; session reset definition requires D-01 resolution.
3. Ticket issuance is idempotent and persists before printable response.
4. Call-next is atomic across competing counters; no ticket allocated twice.
5. Ticket transition guard rejects invalid actions and logs actor/time.
6. Staff may only operate counters/services assigned by admin.
7. Public displays can only view allowed service/counter projections, never staff credentials or PHI.
8. Ticket template and screen layout are selected from registered presets with validated data-backed config.
9. Network reconnect fetches current snapshot; no assumption of message durability.
10. Print/reprint has no ability to create ticket implicitly; reprint is audited.

## Workflows
**Configure:** Admin creates service and counter → links service → assigns staff → creates display profile and device → selects ticket preset → activates settings.
**Issue/print:** Staff selects service → POST issue with idempotency key → backend checks rights/sequence transaction → returns canonical ticket → print preview/dialog → event recorded.
**Call/display:** Staff calls next → backend atomically claims ticket → commits event/outbox → SignalR notification → display refreshes snapshot → shows number and counter.
**Skip/complete/recall:** Staff sends explicit command → server checks allowed transition/resource → persists audit/event → publishes update. No client-side arbitrary status patch.

## Error/edge behavior
403 unauthorized assignment; 404 deleted/inactive resource (or 409 when in-use); 409 conflicting transition; 422 invalid config; 429 rate-limited; 503 degraded database. UI must not optimistically show successful call/print when backend failed. Print cancellation leaves ticket issued and is marked separately if tracking provided; no auto rollback of issued ticket.

## Non-goals
Patient names, billing, appointment flow, SMS, priority clinical triage, kiosk, offline issuing, custom scriptable screens.

## Acceptance
See `acceptance.md` and outstanding decisions `docs/OPEN_DECISIONS.md`.
