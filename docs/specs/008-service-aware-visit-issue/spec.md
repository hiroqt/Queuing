# SPEC-008 — Service-aware visit issue, forwarding, and receipt reprint

**Status:** Implemented and locally verified · **Date:** 2026-10-21
**Extends:** [SPEC-005](../005-forwarding-clinic-queue/spec.md), [SPEC-006](../006-service-station-admin-config/spec.md)

## Goal

Use the Services already configured by Admin when Reception issues a visit and when Staff forwards it. Keep the existing stable clinic-wide daily visit code, appointment ordering, department authorization, MySQL persistence, and React design. Let Reception find an old receipt using its printed daily code and clinic date.

Before this slice, Reception selected a Department directly and issue, lookup, and Staff queue operations lived in `VisitCommandsController`. This implementation selects a Service, derives its Department from configuration, and isolates Reception issue/receipt operations in `ReceptionVisitsController` inside the existing API project.

## Confirmed decisions

- Reception chooses an active Service; its Department is derived from that Service.
- Each newly issued or forwarded DepartmentStep carries one Service.
- Staff chooses an active next Service when forwarding. The Department is derived from that Service. Final completion does not require a next Service.
- Reception may enter an optional appointment time in Asia/Manila local time. A future appointment remains ineligible until due; a blank value means walk-in.
- The daily visit code remains clinic-wide, unique for the Asia/Manila clinic date, and stable across department steps.
- Reprint lookup uses the visit code plus clinic date because codes may repeat on later dates.
- A visit remains anonymous. The system prevents additional tickets from being needed to move between departments, but cannot deduplicate separate visits for the same person.
- Printing stays manual through the existing browser dialog and 58 mm receipt styling.
- Keep one API deployment and the current React JavaScript stack. Isolate Reception issue/receipt operations from Staff queue commands without creating another project or generic repository.

## Scope

### In scope

- An authenticated available-Service read for Reception and Staff. Reception can see active Services under active Departments. Staff can see active destination Services across Departments because the approved forwarding flow allows staff to choose any next department; queue reads and calls remain restricted to assigned Departments. Admin may see all active choices.
- Reception selects a Service and may enter an appointment time. The API validates the active Service and active Department, derives the Department, then atomically persists the Visit, its initial DepartmentStep, daily sequence, idempotency result, audit record, and queue outbox message.
- Persist the selected Service on every newly created DepartmentStep. Staff forwarding selects a next Service and optional next-step appointment time; the next Department is derived server-side.
- Lookup the original receipt by `{ visitCode, clinicDate }`, where `clinicDate` is the Asia/Manila date. A reprint uses the original step's Service, Department, and appointment details even after forwarding.
- Keep the current internal visit-ID lookup route for compatibility unless repository inspection finds it has no callers and removal is approved separately.
- Update the Reception and Staff React workflows through `frontend/src/api/client.js`; retain the current design system and manual 58 mm print action.
- Add an additive MySQL migration. Existing DepartmentSteps retain their history and may have no Service; new issue and forward commands must supply an active Service.

### Explicitly out of scope

- Patient identity, person-level duplicate detection, or medical information.
- Station selection, station-scoped authorization, Service-filtered Call next, or service/station queue partitioning. Call next and display snapshots remain Department-scoped for this slice, consistent with SPEC-006's deferred station integration.
- A scheduling engine, schedule import, auto-printing, silent printer control, selectable 80 mm templates, or changes to the Admin configuration design.
- Changes to display login/pairing, public display content, ticket numbering rules, or appointment priority rules.
- New backend projects, a database/provider change, microservices, generic repositories, or a frontend language/framework migration.

## API contract

All routes remain under `/api/v1`, use the existing cookie/antiforgery setup, and return RFC 9457 Problem Details for failures.

| Purpose | Contract |
|---|---|
| Available services | `GET /services/available` returns active `{ id, name, departmentId, departmentName }`. Reception uses the choices to issue; Staff uses them to forward to any active destination. Queue access remains separately limited to assigned Departments. Requires Admin, Reception, or Staff authorization. |
| Issue visit | `POST /visits` accepts `{ initialServiceId, appointmentAtLocal? }` plus `Idempotency-Key`. The response includes stable visit ID/code, clinic date, initial Service and Department labels/IDs, appointment instant, and issue instant. |
| Reprint receipt | `GET /reception/visits/receipt?visitCode=001&clinicDate=2026-10-21` returns the original issue projection. Requires the Reception policy. It does not create or mutate a Visit. |
| Forward visit | `POST /visits/{id}/complete` accepts `{ nextServiceId?, nextDepartmentAppointmentAtLocal? }`. A supplied next Service creates one pending step in its owning Department; no Service means final completion. An appointment without a next Service is invalid. |

Invalid, inactive, missing, or cross-Department Service references fail without partial writes. Reusing an idempotency key with the same request replays the original response; using it with a different request returns `409`.

## Data and migration

- Add nullable `DepartmentStep.ServiceId` and a composite foreign key `(DepartmentId, ServiceId)` to the existing Service alternate key. The column stays nullable for pre-SPEC-008 history; all new issue and forward paths require an active Service in application validation.
- Preserve old DepartmentSteps without backfilling a guessed Service. They remain visible and operable in their existing Department queue. If an old visit is forwarded after rollout, Staff must select a Service for its new step.
- Store the selected Service ID on each new step. Receipt lookup reads the original step, not `Visit.CurrentStep`, so forwarding does not change the issued receipt's code, Department, Service, or appointment.
- The proposed receipt projection resolves Service and Department labels from current configuration. If an Admin later renames either record, a later reprint will show the current label while retaining the original code and appointment. Add immutable name snapshots only if the owner requires historically identical wording.
- Keep the existing unique `(ClinicDate, Sequence)` index. Resolve reprint lookup by clinic date and canonical daily code/sequence; do not add an unneeded whole-table scan or a new numbering authority.

## Acceptance criteria

1. Reception can load active Service choices with their owning Department; inactive Services or Departments are not offered.
2. Staff can load active destination Service choices across Departments for forwarding; API role authorization protects the list, while queue reads/calls stay department-scoped by the existing authorization checks.
3. Reception can issue a walk-in or appointment visit using `ServiceId`. The API derives the Department, stores Service on the initial step, and returns the same stable daily code format.
4. Optional appointment input is parsed strictly as `YYYY-MM-DDTHH:mm` in Asia/Manila and stored as UTC. Walk-ins remain null and future appointments cannot be called early.
5. The same idempotency key and payload do not create another Visit or consume another sequence; changed payload under the same key returns `409`.
6. A Reception user can find a receipt by canonical visit code and Asia/Manila clinic date after a page reload. Invalid input is `400`; a well-formed pair with no Visit is `404`.
7. Receipt lookup returns original issue details after Staff has called, completed, or forwarded the Visit. It does not return the current step as if it were the issued ticket.
8. Staff forwarding requires an active next Service and creates exactly one pending step in that Service's Department. Appointment validation and transactional/idempotent transition behavior remain intact. Final completion requires no Service.
9. Existing rows migrate without deletion or guessed Service assignments. Existing queue reads and calls continue to handle historical DepartmentSteps whose Service is null.
10. The React Reception and Staff screens use the shared API client, keep accessible loading/empty/error/success states, and retain the current UI style. Reception can manually print/reprint the 58 mm receipt; printing never issues another Visit.
11. Service choice, appointment, sequence, transition, and receipt lookup contain no patient-identifying data. Existing Reception/Staff role checks and antiforgery protections remain enforced.

## Rollout and verification boundaries

The migration must be tested forward against a disposable MySQL 8.x database, including a schema with existing SPEC-005 visits. Do not run it against a shared or production database. Browser print-dialog behavior can be mocked in E2E; physical 58 mm printer output remains unverified until tested on the clinic's actual printer. Production deployment, recovery readiness, concurrency beyond covered MySQL integration cases, and person-level duplicate prevention are not claimed by this spec.
