# SPEC-005 — Forwarding clinic queue with admin configuration

**Status:** Approved brief; local MVP implementation and covered acceptance checks complete; operational/release gates remain pending | **Date:** 2026-10-20 | **Product:** PRD-CQ-001 addendum | **Architecture:** ADR-0002

## Goal

Replace the localhost-only demo queue with a durable local clinic system for issuing one anonymous visit code and forwarding that visit between dynamically configured departments. Admins configure departments, users, and department displays. Reception issues visits. Department staff call, return missed calls to pending, and forward visits. Displays show only the assigned department's waiting and currently called visits.

## Approved workflow and decisions

- Initial departments are X-ray, Animal Bite Center, and ECG, but departments are records, not hard-coded application branches.
- Reception issues one visit and one stable anonymous visit code. It remains unchanged as staff forward the visit; department queue order is separate and is not another patient-facing ticket number.
- Visit identifiers use one clinic-wide daily sequence, reset by the `Asia/Manila` clinic timezone. Department queue ordering does not mint a second ticket.
- Reception manually enters an optional appointment time for the initial department step. When forwarding, staff may enter an optional appointment time for the next department step. Eligible appointments are ordered by appointment time before walk-ins; walk-ins are FIFO. A future appointment is not callable before its scheduled time.
- Staff completing a department step chooses any active next department. Completing and forwarding is one atomic transition that closes the current step and creates exactly one pending step in the selected department.
- A called visit that has not arrived returns to pending in the same department with the same visit code. Staff can call it again. It does not create another visit or code.
- Admin provisions users and assigns staff to departments. Reception is a distinct capability. Staff can operate only assigned departments; admin has configuration and oversight access.
- Admin creates named monitor records, assigns one department to each, and activates each monitor through a revocable one-time pairing code. A monitor displays only its assigned department, with waiting and currently called anonymous visit codes.
- First deployment target is local clinic hosting with MySQL 8.x. The app remains one ASP.NET Core modular monolith, one relational database, and the current React SPA.
- No names, medical record identifiers, or other patient identifying data are collected or shown. This is queue workflow only, not an EHR or appointment-management integration.

## Actors and permissions

| Actor | Allowed actions |
|---|---|
| Admin | Manage departments, users/department assignments, monitors/pairing, clinic settings; inspect queues and audit history. |
| Reception | Issue one visit, optionally set its appointment time, view/reprint the current visit code. |
| Department staff | View assigned department queue; call eligible next visit; return own called visit to pending; complete and forward to one selected active department. |
| Paired display | Read only its assigned department's safe snapshot and receive scoped refresh notifications. |

Every authorization decision is enforced by the API, including resource/department membership. Hiding a control in React is not authorization. Initial admin creation uses a one-time local setup command and supplied secret; no default password is committed.

## State and invariants

- A `Visit` owns the stable public code and lifecycle. Each `DepartmentStep` owns its optional department-specific appointment time. At most one department step for a visit may be active at a time.
- A department step transitions `Pending → Called → Pending` on a no-show, or `Called → Completed` when finished. Completion may atomically create one `Pending` step at the chosen next department. A final completion closes the visit.
- Call-next selects the earliest eligible appointment by scheduled instant, then walk-ins by issued order; future appointments are excluded. An explicit no-show action returns the same step to pending. No automatic priority or clinical triage is inferred.
- Issuing, calling, no-show, completion, and forward operations are transactional, idempotent on retry, and audited. Concurrent requests cannot duplicate visit codes, claim a step twice, or create multiple active steps.
- Daily sequence allocation is atomic and unique for the clinic-local date. DST/timezone conversion uses `Asia/Manila` policy, while persisted timestamps are UTC.
- Admin deactivation is preferred to deletion for referenced departments, users, and displays. Historical visits remain readable.
- All state changes commit before a realtime invalidation is sent. SignalR is only a refresh hint; clients reload an authorized snapshot after connect/reconnect.
- Display pairing credentials are revocable and stored hashed. Snapshot/API/SignalR payloads contain only visit code, department, queue state, and safe display metadata.

## Main user flows

1. One-time setup creates the initial admin. Admin signs in, creates/configures departments, provisions receptionist/staff accounts, assigns staff, creates monitors, and pairs each monitor to exactly one active department.
2. Reception signs in and issues one visit, optionally setting an appointment time. The API returns the clinic-wide daily visit code and persists it.
3. Staff signs in and selects an assigned department. The queue shows eligible appointments before walk-ins. Call-next atomically calls one visit and the department's monitor refreshes.
4. If the patient does not arrive, staff returns that same visit step to pending; it can be called again using its unchanged code.
5. On completion, staff selects any active next department or completes the whole visit. Forwarding closes the current step and puts exactly one pending step in the selected department. No second visit code is issued.
6. Admin can add another department or monitor and assign it through configuration, without a source change or deployment.

## Initial API surface (versioned under `/api/v1`)

- Identity/session: login, logout, current principal, one-time admin bootstrap command (not a public endpoint).
- Admin configuration: departments; users and department assignments; displays and pairing/revocation; clinic timezone/settings.
- Reception: `POST /visits` (idempotency key, optional appointment instant), visit lookup/reprint projection.
- Department operations: assigned queue snapshot; `POST /departments/{id}/call-next`; `POST /visits/{id}/return-to-pending`; `POST /visits/{id}/complete` with optional next department.
- Displays: pairing/activation flow and authenticated device snapshot; scoped SignalR subscription.
- Mutations return RFC 9457 Problem Details for validation, authorization, conflicts, and missing resources. Contracts expose no patient identity fields.

Initial request/response contract for the vertical slice:

| Purpose | Contract |
|---|---|
| Session | `GET /api/v1/auth/session`; `POST /api/v1/auth/login` `{ userName, password }`; `POST /api/v1/auth/logout`; cookie session + antiforgery token. |
| Departments | Admin `GET/POST /api/v1/admin/departments`; `PATCH /api/v1/admin/departments/{id}`. List returns `{ id, name, active }`. |
| Department choices | Authenticated `GET /api/v1/departments` returns active `{ id, name }` only; it does not grant configuration access. |
| Users | Admin `GET/POST /api/v1/admin/users`; `PATCH /api/v1/admin/users/{id}` to update role/department assignments or deactivate. Password is set/reset through a one-time generated credential flow. |
| Displays | Admin `GET/POST /api/v1/admin/displays`; `PATCH /api/v1/admin/displays/{id}`; `POST /api/v1/admin/displays/{id}/pairing-code`; `POST /api/v1/displays/activate` `{ code }`; `POST /api/v1/displays/logout`. Pairing establishes a display-only HttpOnly cookie. |
| Reception | `POST /api/v1/visits` `{ initialDepartmentId, appointmentAtLocal? }` plus `Idempotency-Key`; response `{ id, visitCode, departmentId, appointmentAtUtc?, issuedAtUtc }`. |
| Department staff | `GET /api/v1/departments/{id}/queue`; `POST /api/v1/departments/{id}/call-next`; `POST /api/v1/visits/{id}/return-to-pending`; `POST /api/v1/visits/{id}/complete` `{ nextDepartmentId?, nextDepartmentAppointmentAtLocal? }`. All four state-changing visit/queue commands require a fresh `Idempotency-Key`; the same key and payload replays the result, while different payload reuse returns `409`. Queue projection includes waiting visits and called visits only. |
| Display | `GET /api/v1/displays/me/snapshot`; scoped SignalR `/hubs/displays` with authorized group membership and snapshot refresh on connect/reconnect. |

Cookie-authenticated state changes require antiforgery. Configuration writes and display pairing use Problem Details. Contracts must be represented in generated or hand-maintained frontend API code and tested for compatibility. If local appointment entry cannot be converted unambiguously to an instant, reject it with a validation error; never guess a browser timezone silently.

## Data ownership

Logical modules remain within the existing API/core solution: IdentityAccess, Configuration, Visits/Queue, Displays, and Audit. Use EF Core with MySQL. Tables are owned by modules; avoid cross-module table writes. Minimal relational records include clinic settings, users/roles/department assignments, departments, visits, department steps, sequence counters, idempotency records, displays/pairing credentials/assignments, audit records, and an outbox for queue/display invalidations.

Use database constraints for unique `(clinic_date, visit_sequence)`, unique idempotency scope/key, foreign keys, valid status, and one active department step per visit. Queue selection and transition must run in short transactions with concurrency-safe locking/conditional updates. Verify these invariants against real MySQL 8.x, not EF InMemory.

## Non-goals

No EHR, patient identity, appointment scheduling engine/import, clinical triage, multi-clinic tenancy, billing, messaging, voice announcements, offline ticket issuing, microservices, broker, Redis, or arbitrary monitor layouts. No anonymous public queue endpoint. Existing local demo routes may be retired or explicitly isolated from authenticated clinic routes.

## Acceptance criteria

1. A clean local install can run a one-time admin bootstrap, connect to configured MySQL, apply reviewed migrations, and start without a baked-in credential.
2. Admin can configure, deactivate, and list dynamic departments; X-ray, Animal Bite Center, and ECG are initial setup data and are not hard-coded in queue logic.
3. Admin can provision users, assign reception/department scope, and create/pair/revoke named department displays. Adding another department or display requires configuration only.
4. Reception issue produces a durable, unique clinic-wide daily visit code. Concurrent issue cannot duplicate it. Restarting the API preserves visits and configuration.
5. A future appointment cannot be called early. Due appointments are selected before walk-ins; appointments order by scheduled instant and walk-ins by FIFO.
6. Staff cannot access an unassigned department. Unauthorized and unauthenticated API requests are denied server-side.
7. Concurrent call-next cannot claim the same step twice. Empty queues return a clear conflict without state mutation.
8. Returning a called visit to pending preserves its code and active department step; another call can call that same visit.
9. Forwarding atomically completes the current step and creates one pending step at the staff-selected active department. Repeated/replayed requests do not create duplicate steps. Only one active step exists per visit.
10. Each paired display sees only its assigned department's waiting/currently called visits; revocation blocks snapshots and realtime access. Reconnect reloads the authoritative snapshot.
11. Audit records identify actor, action, target, timestamp, and correlation ID without patient identity. Notifications publish only after successful commit.
12. PostgreSQL is not used. The covered MySQL integration/API authorization cases, React unit/E2E, lint/build, and login-free display update/revocation flow pass. Date rollover, concurrent issue/forward races, database recovery, and production readiness remain separate verification gates.

## Rollout boundary

This specification does not authorize deployment to clinic production, import of live patient data, network exposure, or changes to an existing shared MySQL database. Start with an isolated local MySQL 8.x instance and synthetic visits. Database backup/restore, deployment hardening, and clinic operational readiness need separate approval/evidence before live use.
