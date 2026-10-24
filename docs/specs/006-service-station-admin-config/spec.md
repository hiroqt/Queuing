# SPEC-006 — Service and station administration

**Status:** Implemented (configuration-only scope) | **Date:** 2026-10-21 | **PRD refs:** FR-03, FR-04 | **Architecture:** ARD-CQ-001, SPEC-005

## User problem / actor

Clinic administrators need to configure the services that staff handle and the physical counters/windows where staff work. The existing application configures departments, users, and monitors, but does not yet persist services, stations, or their staff/service assignments.

## Approved decisions

- The legacy workflow's “Channel” maps to the existing `Department`; no parallel Channel entity is added.
- Each Service belongs to exactly one Department.
- A Station is a physical operating counter/window and belongs to exactly one Department.
- A Station can handle multiple Services and have multiple assigned staff. Staff can be assigned to multiple Stations.
- A Station's Services and staff assignments must belong to that Station's Department. Staff must also have the existing Staff role and department assignment.
- The follow-up [SPEC-008](../008-service-aware-visit-issue/spec.md) now attaches a Service to each newly issued or forwarded DepartmentStep. Reception chooses the initial Service and Staff chooses a next Service; the Department is derived from that Service.
- Future queue calls will select an assigned Station and Service, then call within that Service's queue. Existing appointment-first and FIFO walk-in ordering remains in force.
- This spec implemented administrator configuration only. SPEC-008 later updated issue and forwarding; queue reads/call-next, displays, and their contracts remain Department-scoped.

## Scope / non-goals

### In scope

- Persist Services and Stations in the existing MySQL-backed ASP.NET Core API.
- Persist Station-Service and Station-Staff many-to-many assignments.
- Add Admin-only API operations to list, create, update, deactivate, and reactivate Services and Stations. Service and Station Department ownership is set at creation and cannot be moved by update.
- Add Service and Station configuration sections to the existing admin page, using the current React/JavaScript API client and visual system.
- Keep the existing role and department assignments authoritative. Removing a user's Staff role, deactivating the user, or removing a department assignment also removes incompatible station assignments.
- Audit configuration mutations. Deactivate records instead of deleting them; retain station relationships unless a user assignment becomes invalid.
- Add an additive EF Core/MySQL migration. No existing visit or department-step backfill is needed.

### Out of scope

- Changing the visual design system or other screens.
- Service selection during Reception issue or staff forwarding (implemented later by SPEC-008).
- Service-filtered queue reads, Station selection for calling, station-scoped authorization of queue commands, ticket/display changes, or queue ordering changes. These are a later integration slice.
- Appointment scheduling, patient identity, a separate Channel concept, shift scheduling, station/device pairing, new projects, or a database/provider change.

## Permission matrix

| Actor | Allowed actions |
|---|---|
| Admin | List and manage Services and Stations, including their Service and Staff assignments. |
| Reception | No Service or Station administration. |
| Staff | No Service or Station administration. |
| Paired display / anonymous visitor | No Service or Station administration. |

The API enforces the Admin policy on every configuration route. Cookie-authenticated writes use the existing antiforgery filter. Hiding controls in React is not authorization. The temporary no-login local setup exception is defined by [SPEC-007](../007-local-admin-setup-mode/spec.md); outside its Development + loopback boundary, anonymous configuration requests remain unauthorized.

## Inputs, output and API contract

All routes are under `/api/v1` and use the existing Problem Details and centralized frontend HTTP client conventions.

### Services

- `GET /admin/services` returns `{ id, name, departmentId, active }` records, including inactive records.
- `POST /admin/services` accepts `{ name, departmentId }` and returns `201` with the created record.
- `PATCH /admin/services/{id}` accepts optional `{ name, active }` fields and returns the updated record.

### Stations

- `GET /admin/stations` returns `{ id, name, departmentId, active, serviceIds, staffUserIds }` records, including inactive records.
- `POST /admin/stations` accepts `{ name, departmentId, serviceIds, staffUserIds }` and returns `201` with the created record.
- `PATCH /admin/stations/{id}` accepts optional `{ name, active, serviceIds, staffUserIds }` fields and returns the updated record. Supplying either assignment array replaces that assignment set; omitted arrays leave the set unchanged.

Names are trimmed, contain 2–100 characters, and are unique within a Department. Duplicate IDs are rejected. New Services and Stations require an active Department. Every assigned Service and Staff member must belong to the Station's Department. A Staff member must have the Staff role and an existing Department assignment. Service ownership and Station ownership cannot be changed after creation.

Invalid input or cross-department assignment returns `400`; duplicate names return `409`; missing records return `404`; non-Admin access returns `403` (unauthenticated requests return `401` except for SPEC-007 local setup mode).

## State and invariants

- Existing Department records are the sole channel/destination records.
- A Service references one Department. A Station references one Department.
- Station-Service links reference Services in the same Department as the Station.
- Station-Staff links reference active Staff users assigned to the same Department as the Station.
- Unique keys prevent duplicate Service/Station names within a Department and duplicate assignment links.
- Referenced records are deactivated, not deleted. Inactive Services and Stations remain visible to administrators. Inactive Services are retained in existing Station assignments; SPEC-008 requires active Services for new issue/forward steps, while station-specific call behavior remains deferred.
- If a user is deactivated, changes away from Staff, or loses a Department assignment, affected Station-Staff links are removed within the same database transaction.
- All create/update/deactivate/reactivate operations add an audit record with actor, target, action, and correlation ID. Audit details contain no patient information.
- Service and Station configuration does not create a visit, ticket code, queue event, or display notification.

## Happy path / failure paths / retry behavior

1. Admin creates a Service under an active Department.
2. Admin creates a Station under one active Department and selects Services and Staff that belong to that Department.
3. Admin can later rename/reactivate/deactivate the Service or Station and replace either Station assignment set. Update is idempotent at the resource level; a repeated identical update leaves the same configuration.
4. Attempts to attach another Department's Service or Staff, a non-Staff user, duplicate IDs, or duplicate same-department names fail with a clear Problem Details response and persist no partial changes.
5. A Reception or Staff account cannot call these routes even if the UI is manually altered.

## UI and accessibility

- Extend only the authenticated Admin page and use existing panels, inline forms, status messages, buttons, labels, and responsive layout classes.
- Organize Admin configuration as one collapsible Administration group in the existing workspace sidebar, with direct routes for Departments, Services, Users & access, Stations, and Displays. `/admin` opens Departments; only the selected section's configuration content is rendered.
- Keep each section's data and mutations local to that section, loading only its records and the related reference data its forms need. Keep one-time credentials and pairing codes visible in the Admin shell after creation, without persisting them in browser storage.
- The sidebar follows the current evergreen/paper/amber visual system. On narrow screens it remains an expandable vertical menu above the selected content.
- Provide loading, empty, success, and API error states consistent with the current page.
- Label Service and Station inputs and multi-select associations. Associate helper text and validation feedback with their controls.
- Keep controls keyboard-operable and preserve visible focus; no color-only indication of active state.

## Data, audit and realtime impacts

- Add relational `Services`, `Stations`, `StationServices`, and `StationStaff` tables with foreign keys, uniqueness, and same-department assignment constraints.
- Migration is additive and must preserve all existing SPEC-005 data. A fresh schema and an existing SPEC-005 schema must both migrate successfully.
- Audit records are written in the same transaction as the configuration change.
- No SignalR/outbox messages are needed because this slice does not change queue or display projections.
- Rollback is an additive-schema rollback only before these records are relied on; deployment rollback guidance must preserve the new configuration tables or explicitly export them first.

## Acceptance criteria (Given/When/Then)

1. Given an Admin and active Department, when the Admin creates a Service, then the Service is returned by the Admin API and persists after a fresh API context.
2. Given an Admin, when the Admin creates a Station with same-department Service and Staff assignments, then those assignments are returned by the Admin API and persist.
3. Given a Station in one Department, when an Admin assigns a Service or Staff member from another Department, then the API returns `400` and no partial assignment is saved.
4. Given a non-Admin or anonymous caller, when they call a Service or Station administration route, then the API returns `403` or `401` respectively, except when the explicit SPEC-007 local Development + loopback mode is active.
5. Given duplicate same-department names or duplicate assignment IDs, when an Admin submits them, then the API returns a clear conflict/validation error and does not persist duplicates.
6. Given an assigned Staff user, when an Admin deactivates them, changes their role away from Staff, or removes the Station's Department from their assignments, then incompatible Station-Staff links are removed atomically.
7. Given an inactive Department, when an Admin reactivates it, then the existing Department update API persists its active state and the Admin list shows it as Active.
7. Given existing SPEC-005 visits and DepartmentSteps, when the migration is applied, then queue records and API behavior remain unchanged.
8. Given an Admin in the existing React workspace, when they create and update Services and Stations, then the page shows saved configuration, associated department/services/staff, and understandable errors without a design-system change.
9. Given an Admin opening `/admin`, when they choose an Administration section, then only that section's configuration is shown at a direct route that supports refresh and browser history; the existing local setup and authenticated Admin access paths continue to work.

## Open decisions and signoff

- User confirmed the approval gate on 2026-10-21: implement this scoped admin configuration after recording the decisions and implementation plan.
- Service-aware issue/forward behavior is implemented by the follow-up SPEC-008; station-scoped calling remains a separate later slice.
- Production deployment, shift schedules, and recovery procedures remain outside this feature.
