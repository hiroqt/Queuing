# ARD — Architecture Requirements & Design

**Document ID:** ARD-CQ-001 | **Version:** 0.2 | **Status:** Proposed with approved SPEC-005 decisions | **Scope:** PRD-CQ-001 MVP and addenda. **Expandability:** append module contracts and ADRs; do not pre-build hypothetical services.

> Configuration addendum: [SPEC-006](docs/specs/006-service-station-admin-config/spec.md) records the approved admin-only Service/Station slice. The existing Department is the channel; Service and physical Station each belong to one Department; Station-Service and Station-Staff are many-to-many within that Department. This configuration does not yet alter SPEC-005 queue commands.

> Database decision update: ADR-0002 and SPEC-005 supersede PostgreSQL references in this draft for the forwarding implementation. Use MySQL 8.x with EF Core 10. Replace PostgreSQL-specific concurrency guidance below with MySQL/InnoDB constraints, transactions, locking, and integration tests.

## 1. Drivers
Correctness under concurrent use, staff least-privilege, public data minimization, configure-not-code clinic setup, recoverability, and straightforward deployment for small clinics. Architectural choice: **modular monolith**—one ASP.NET Core API process, one MySQL 8.x DB for SPEC-005, one React SPA (admin/staff/display routes). Separate modules in code, not separate deployments.

## 2. System context
React SPA (admin/staff) → HTTPS REST API → use cases → EF Core/MySQL. Public display React route → scoped display snapshot endpoint + authenticated display SignalR subscription. Outbox dispatcher emits *notification of change* after transaction commit; display fetches latest snapshot. Reverse proxy uses same origin (`/`, `/api`, `/hubs`); TLS termination; host health checks.

## 3. Code boundaries
- `IdentityAccess`: ASP.NET Core Identity and server policies, staff-counter assignments.
- `Configuration`: services, counters, service-to-counter mapping, numbering policies and clinic options.
- `Queuing`: `Ticket`, `QueueSession`, transition rules, atomic ticket issue/call-next/skip/recall/complete; owns queue data.
- `Ticketing`: printable projections/templates/reprints; requests queue ticket data using read contract, not direct table writes.
- `Displays`: profiles, assignment, enrollment, snapshot projections and SignalR hub; never becomes ticket truth.
- `Audit`: append-only audit infrastructure, correlation metadata; minimal administrative read API.
Module integration via contracts (typed request/query interfaces, domain/integration events); avoid cross-module direct DbContexts and cyclic dependencies. Logical modules may initially share physical DB with distinct schemas and migrations ownership.

## 4. Solution structure
See `docs/STRUCTURE.md` for exhaustive tree and `docs/adr/0001-architecture.md` for rationale.

## 5. Entity outline
- `ClinicSettings(id, timezone_id, active_queue_policy_version)`
- `Service(id, department_id, name, active)`; service prefixes/numbering are not used by the stable SPEC-005 visit code
- `Station(id, department_id, name, active)`; physical counter/window
- `StationService(department_id, station_id, service_id)` and `StationStaff(department_id, station_id, user_id)`; each association is constrained to one Department
- `Visit(id, clinic_date, sequence, rendered_code, state, issued_by, issued_at_utc, current_step_id?, version)`; one stable clinic-wide daily visit code
- `DepartmentStep(id, visit_id, department_id, appointment_at_utc?, state, entered_at_utc, called_at_utc?, completed_at_utc?, version)`; one active step pointer per visit
- `DepartmentSequence` is internal queue ordering only; it does not issue a second patient-facing ticket code
- `VisitEvent(id, visit_id, department_step_id?, kind, actor_id, occurred_at_utc, metadata_safe)`
- `IdempotencyRecord(scope, key_hash, request_hash, result_ref, created_at_utc)`
- `DisplayDevice(id, name, credential_hash, active, last_seen_at_utc)`
- `DisplayProfile(id, template_key, config_json, version)`; `DisplayAssignment(display_id, service_id?, counter_id?)`
- `TicketPrintTemplate(id, name, paper_width_mm, config_json, active)`; `PrintAudit(id, ticket_id, user_id, kind, at_utc)`
- `AuditRecord(id, actor_id, action, target_type, target_id, timestamp_utc, correlation_id, safe_diff)`
- `OutboxMessage(id, type, aggregate_id, payload, created_at_utc, published_at_utc?)`

Keys: unique `(clinic_date, sequence)`, FK constraints, permitted state enum/check, concurrency token/version, indexed `(department_id,state,appointment_at_utc,entered_at_utc)`, key scope uniqueness, and database-enforced one-active-step-per-visit. InnoDB concurrency and isolation behavior must be exercised against MySQL 8.x, not mocked/in-memory EF.

## 6. Queue state model
For SPEC-005, a visit has one stable code and a current department step. A step transitions `Pending → Called → Pending` for an explicit no-show, or `Called → Completed`; completion may atomically select and create one `Pending` next step. Final completion closes the visit. A future appointment is not eligible before its scheduled time. Every transition is command-only, authorized and audited. Invalid transitions return `409 Conflict`; missing resource `404`; forbidden `403`; validation `400`/`422` per API standard. This state model supersedes the earlier proposed skip/recall semantics for the SPEC-005 flow.

## 7. Atomic operations
- **Issue:** validate Reception access; idempotency lookup; allocate the clinic-local daily visit sequence in an InnoDB transaction with a unique constraint; persist visit/event/outbox; commit; then notify.
- **CallNext:** transaction obtains the earliest eligible due appointment, then FIFO walk-in for the assigned department; excludes future appointments and uses MySQL 8.x-verified locking or conditional updates; persist event/outbox and commit before returning the visit.
- **Forward:** atomically complete the active department step and create exactly one pending step at the selected active department; constraints and conditional updates prevent parallel active steps.
- **Retry:** the same idempotency key and payload returns prior result; key reuse with different payload is rejected. Document key TTL/retention and enforce unique scope.
- **Print:** print render is deterministic from persisted ticket + versioned template; printing is initiated by UI, physical success cannot be guaranteed by browser. Reprint preserves ticket ID and creates audit event.

## 8. API contracts (illustrative; finalize OpenAPI before code)
`POST /api/v1/tickets`; `POST /api/v1/counters/{counterId}/call-next`; `POST /api/v1/tickets/{ticketId}/recall`; `/skip`; `/complete`; `GET /api/v1/counters/{counterId}/queue`; admin `GET/POST/PATCH` services/counters/assignments/display profiles/templates; display `GET /api/v1/displays/me/snapshot`; SignalR `/hubs/displays` and `/hubs/staff`. Mutations require CSRF token if authenticated by cookie; `Idempotency-Key` for issuance and call-next. Use RFC 9457 Problem Details and correlation IDs. Generate frontend types from OpenAPI.

## 9. Auth and trust boundaries
- Same-origin production, secure HttpOnly session cookies, SameSite according to deployment, anti-forgery token required for all state-changing cookie-auth requests, HTTPS+HSTS, session timeout/logout/revocation, password/MFA policy based on risk.
- Local development has the narrowly scoped SPEC-007 exception: no-login Admin configuration is allowed only when explicitly enabled in Development and both request Host and remote address are loopback. It does not change production authentication or non-admin API authorization.
- Admin and Staff policies plus **resource-based** checks on counter/service/department assignment. Identity role ≠ automatic access to every queue.
- Public display has revocable, scope-limited device credential established by pairing with admin approval, no staff session reuse; broadcast only safe snapshot deltas; SignalR groups are routing only, not an authorization mechanism.
- Rate limiting, payload size limits, validation, safe error messages and non-sensitive structured logs. Threat-model credential theft, display impersonation, replay, XSS, CSRF, race conditions and excessive requests.

## 10. Dynamic configuration without dynamic executable code
Admin configures database records (`Services`, `Stations`, `StationServices`, `StationStaff`, `DisplayProfiles`, `DisplayAssignments`, `PrintTemplates`). React selects between **versioned, pre-registered templates** by `template_key`, validates `config_json` against versioned schema. New module/screen behavior requires code and approved SDD release. Unknown template key or invalid schema fails safely. Archive referenced config instead of cascade deleting. SPEC-006 implements Service/Station administration only; Service-aware issue/forward/call behavior is a later slice.

## 11. Realtime semantics
Publish `queue.changed` with queue/session ID and revision only after commit. Display first obtains snapshot; subscribes to scoped updates; on event refetches/merges by monotonic revision, on reconnect and periodically refetches full snapshot. Show offline/disconnected indicator and last sync; never indicate that an unacknowledged action succeeded. Use same-instance SignalR initially; document scaling plan before adding replicas or Redis backplane.

## 12. Printing
MVP: print-specific React CSS/template (`58mm`, `80mm`) using browser print dialog and tested printer profiles. No silent or automatic printer control promised. Print data comes from durable server ticket; no new ticket on reprint; redact sensitive info; log user/time/attempt. If unattended ESC/POS becomes required, create a separate approved printer-agent spec and security design.

## 13. Operations and observability
Structured logs with correlation IDs (no PHI), OpenTelemetry traces/metrics, health/liveness/readiness checks, EF migration as reviewed deployment step, backward-compatible config/DB changes, encrypted daily backups and restore drills, migration rollback/recovery playbook, secrets via environment/secret manager. Record errors, outbox lag, duplicate/conflict attempts, real-time disconnect counts. Set RPO/RTO with owner pre-launch. Test restarting backend and disconnecting display.

## 14. Non-functional validation
Baseline pilot performance and concurrent load are defined in PRD. Use real MySQL 8.x concurrency tests, e2e browser tests on supported browsers, real 58/80mm printer smoke test, OWASP-aligned security review and simulated restart/disconnect. Fail deployment if must-pass invariants fail.

## 15. Evolution
Future capabilities attach new domain module, contracts, migration boundary, OpenAPI endpoints, screens and ADR if architectural. Avoid overbuilding a plugin runtime or event bus. Consider separate services only after measured scaling/team/deployment demands and a data ownership plan. Maintain a compatibility matrix for API/template/config revisions.
