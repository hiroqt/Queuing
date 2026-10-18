# ARD — Architecture Requirements & Design

**Document ID:** ARD-CQ-001 | **Version:** 0.1 | **Status:** Proposed | **Scope:** PRD-CQ-001 MVP. **Expandability:** append module contracts and ADRs; do not pre-build hypothetical services.

## 1. Drivers
Correctness under concurrent use, staff least-privilege, public data minimization, configure-not-code clinic setup, recoverability, and straightforward deployment for small clinics. Architectural choice: **modular monolith**—one ASP.NET Core API process, one PostgreSQL DB, one React SPA (admin/staff/display routes). Separate modules in code, not separate deployments.

## 2. System context
React SPA (admin/staff) → HTTPS REST API → use cases → EF Core/PostgreSQL. Public display React route → scoped display snapshot endpoint + authenticated display SignalR subscription. Outbox dispatcher emits *notification of change* after transaction commit; display fetches latest snapshot. Reverse proxy uses same origin (`/`, `/api`, `/hubs`); TLS termination; host health checks.

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
- `Service(id, name, prefix, active, sort_order)`
- `Counter(id, label, active)`; `CounterService(counter_id, service_id)`
- `StaffCounterAssignment(user_id, counter_id, active)`
- `QueueSession(id, service_id, local_date, reset_bucket, status)`
- `QueueSequence(queue_session_id, next_number)` locked/atomically incremented in transaction
- `Ticket(id, session_id, service_id, sequence, rendered_number, state, assigned_counter_id?, issued_at_utc, called_at_utc?, completed_at_utc?, version)`
- `TicketEvent(id, ticket_id, kind, actor_id, occurred_at_utc, metadata_safe)`
- `IdempotencyRecord(scope, key_hash, request_hash, result_ref, created_at_utc)`
- `DisplayDevice(id, name, credential_hash, active, last_seen_at_utc)`
- `DisplayProfile(id, template_key, config_json, version)`; `DisplayAssignment(display_id, service_id?, counter_id?)`
- `TicketPrintTemplate(id, name, paper_width_mm, config_json, active)`; `PrintAudit(id, ticket_id, user_id, kind, at_utc)`
- `AuditRecord(id, actor_id, action, target_type, target_id, timestamp_utc, correlation_id, safe_diff)`
- `OutboxMessage(id, type, aggregate_id, payload, created_at_utc, published_at_utc?)`

Keys: unique `(queue_session_id, sequence)`, unique service/prefix policy as appropriate, FK constraints, permitted state enum/check, concurrency token/version, indexed `(session_id,state,issued_at_utc)`, key scope uniqueness. Concurrency scheme and isolation level must be exercised against PostgreSQL, not only mocked/in-memory EF.

## 6. Queue state model
`Waiting → Called → Completed`, `Called → Skipped`, `Skipped → Waiting` (recall/requeue **subject to clinic approval**), `Called → Called` for same-ticket recall announcement without changing ownership. Every transition is command-only, authorized and audited. Invalid transitions return `409 Conflict`; missing resource `404`; forbidden `403`; validation `400`/`422` per selected API standard. If recall semantics differ, update spec first.

## 7. Atomic operations
- **Issue:** validate active service and session; idempotency lookup scoped to actor/action; lock/update `QueueSequence` or use `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING` atomically; persist ticket/event/outbox within one transaction; commit; then notify.
- **CallNext:** transaction obtains earliest eligible waiting ticket for assigned counter/service with row-level locks (`FOR UPDATE SKIP LOCKED` for competing workers, consistent ordering); conditional update status/assigned counter; event/outbox; commit; return selected ticket. Use EF with careful SQL where needed. Define fairness and priority explicitly in product policy, not ad-hoc per controller.
- **Retry:** the same idempotency key and payload returns prior result; key reuse with different payload is rejected. Document key TTL/retention and enforce unique scope.
- **Print:** print render is deterministic from persisted ticket + versioned template; printing is initiated by UI, physical success cannot be guaranteed by browser. Reprint preserves ticket ID and creates audit event.

## 8. API contracts (illustrative; finalize OpenAPI before code)
`POST /api/v1/tickets`; `POST /api/v1/counters/{counterId}/call-next`; `POST /api/v1/tickets/{ticketId}/recall`; `/skip`; `/complete`; `GET /api/v1/counters/{counterId}/queue`; admin `GET/POST/PATCH` services/counters/assignments/display profiles/templates; display `GET /api/v1/displays/me/snapshot`; SignalR `/hubs/displays` and `/hubs/staff`. Mutations require CSRF token if authenticated by cookie; `Idempotency-Key` for issuance and call-next. Use RFC 9457 Problem Details and correlation IDs. Generate frontend types from OpenAPI.

## 9. Auth and trust boundaries
- Same-origin production, secure HttpOnly session cookies, SameSite according to deployment, anti-forgery token required for all state-changing cookie-auth requests, HTTPS+HSTS, session timeout/logout/revocation, password/MFA policy based on risk.
- Admin and Staff policies plus **resource-based** checks on counter/service/department assignment. Identity role ≠ automatic access to every queue.
- Public display has revocable, scope-limited device credential established by pairing with admin approval, no staff session reuse; broadcast only safe snapshot deltas; SignalR groups are routing only, not an authorization mechanism.
- Rate limiting, payload size limits, validation, safe error messages and non-sensitive structured logs. Threat-model credential theft, display impersonation, replay, XSS, CSRF, race conditions and excessive requests.

## 10. Dynamic configuration without dynamic executable code
Admin configures database records (`Services`, `Counters`, `DisplayProfiles`, `DisplayAssignments`, `PrintTemplates`). React selects between **versioned, pre-registered templates** by `template_key`, validates `config_json` against versioned schema. New module/screen behavior requires code and approved SDD release. Unknown template key or invalid schema fails safely. Archive referenced config instead of cascade deleting.

## 11. Realtime semantics
Publish `queue.changed` with queue/session ID and revision only after commit. Display first obtains snapshot; subscribes to scoped updates; on event refetches/merges by monotonic revision, on reconnect and periodically refetches full snapshot. Show offline/disconnected indicator and last sync; never indicate that an unacknowledged action succeeded. Use same-instance SignalR initially; document scaling plan before adding replicas or Redis backplane.

## 12. Printing
MVP: print-specific React CSS/template (`58mm`, `80mm`) using browser print dialog and tested printer profiles. No silent or automatic printer control promised. Print data comes from durable server ticket; no new ticket on reprint; redact sensitive info; log user/time/attempt. If unattended ESC/POS becomes required, create a separate approved printer-agent spec and security design.

## 13. Operations and observability
Structured logs with correlation IDs (no PHI), OpenTelemetry traces/metrics, health/liveness/readiness checks, EF migration as reviewed deployment step, backward-compatible config/DB changes, encrypted daily backups and restore drills, migration rollback/recovery playbook, secrets via environment/secret manager. Record errors, outbox lag, duplicate/conflict attempts, real-time disconnect counts. Set RPO/RTO with owner pre-launch. Test restarting backend and disconnecting display.

## 14. Non-functional validation
Baseline pilot performance and concurrent load are defined in PRD. Use real PostgreSQL concurrency tests, e2e browser tests on supported browsers, real 58/80mm printer smoke test, OWASP-aligned security review and simulated restart/disconnect. Fail deployment if must-pass invariants fail.

## 15. Evolution
Future capabilities attach new domain module, contracts, migration boundary, OpenAPI endpoints, screens and ADR if architectural. Avoid overbuilding a plugin runtime or event bus. Consider separate services only after measured scaling/team/deployment demands and a data ownership plan. Maintain a compatibility matrix for API/template/config revisions.
