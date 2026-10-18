# TASKS-001 — MVP Backlog and Traceability

All tasks start unchecked; checking requires code review and evidence. No code exists in this pack.

## Foundation
- [ ] T01 Bootstrap React/Vite TS + ASP.NET Core Web API solution and scripts (FR-11)
- [ ] T02 Set up PostgreSQL EF Core schemas/migrations and unique constraints (FR-06/07)
- [ ] T03 Implement Identity, secure cookie, anti-CSRF, logout and roles/policies (FR-01)
- [ ] T04 Add CI, lint/typecheck, backend/frontend tests and OpenAPI typed-client generation (NFR)

## Admin and configuration
- [ ] T05 Admin service and numbering policy CRUD/deactivation with audit (FR-02/13)
- [ ] T06 Counter CRUD, permitted services and staff assignments with resource auth (FR-03)
- [ ] T07 Ticket template preset config and validation, 58/80mm (FR-05)
- [ ] T08 Display enrollment/revocation, profiles, template registry and mappings (FR-04)

## Queue and staff
- [ ] T09 Implement immutable ticket events, transition guards and queue sessions (FR-06/07)
- [ ] T10 Atomic issue with unique sequence and idempotency (FR-06)
- [ ] T11 Atomic call-next and assigned-counter policy, concurrent tests (FR-07)
- [ ] T12 Staff dashboard with issue/call/skip/recall/complete UI and errors (FR-07/11)

## Printing and display
- [ ] T13 Canonical ticket preview and browser print/reprint audit (FR-05/08)
- [ ] T14 Scoped display snapshot projection with no PII (FR-09)
- [ ] T15 Outbox + authorized SignalR notification + reconnect/refetch (FR-09)
- [ ] T16 Display layouts, offline indicator and config refresh (FR-04/09)

## Operations/acceptance
- [ ] T17 Privileged audit view and redacted structured logging (FR-10)
- [ ] T18 RBAC/resource matrix and API+CSRF security tests (FR-01)
- [ ] T19 Concurrent load, restore drill, printer smoke and display disconnect e2e (NFR)
- [ ] T20 Stage release with runbooks, decision signoff and recorded acceptance (ALL)
