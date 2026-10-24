# SPEC-011 — Service-scoped Staff accounts

**Status:** Approved for implementation · **Approved:** 2026-10-24 · **Extends:** SPEC-005, SPEC-006, SPEC-008

## Goal

Let Admin assign each Staff account to one or more configured Services, and restrict that account's queue work to those Services. Keep the existing shared sign-in flow, Reception role, clinic-wide visit code, Department displays, and forwarding behavior.

## Approved decisions

- Staff continues to sign in at `/login` with an individual account. The account's role remains Staff; its Service assignments define which queue items it can read and operate.
- Admin assigns one or more Services to a Staff user. Reception and Admin accounts have no Service assignments.
- Staff can read only assigned-Service steps in a Department queue, call only eligible assigned-Service steps, and return or complete/forward only a called step whose Service is assigned.
- Within an assigned Department, historical active steps with no `ServiceId` remain accessible to that Department's Staff assignments. New staff accounts derive Department membership from their Service assignments; existing `UserDepartments` are retained and used for legacy rows and station-assignment compatibility.
- When forwarding, Staff can still choose any active destination Service, as specified by SPEC-008. A user's access to the forwarded step is determined by that destination Service assignment.
- Admin, Reception, kiosk, and display authorization do not change. Admin may use the existing no-login setup exception only in Development on loopback under SPEC-007; Admin authentication remains required elsewhere.
- At migration, each existing Staff user's department assignments are expanded to assignments for all Services currently belonging to those Departments. This preserves their service-aware queue access. Services created later require an explicit Staff assignment.
- New or changed Staff assignments must include at least one active Service in an active Department. Existing assignments to deactivated Services remain stored so currently active work can be completed; inactive Services are not offered for new issues or forwards.
- Queue projections include Service identity/name so multi-Service staff can distinguish work. Department-level display projections remain unchanged and continue to omit patient and staff details.

## Authorization and data contract

- Add a relational `UserServices` assignment table with unique `(UserId, ServiceId)` and restrictive Service FK. Preserve `UserDepartments`; migration backfills `UserServices` from those existing Department assignments.
- Admin user create/update/list contracts expose `serviceIds`. Session data exposes both assigned `serviceIds` and Department IDs derived from the retained Department assignments.
- Service-scoped checks are enforced in API queries and mutations. Client filtering is only presentation. Cross-Department IDs and unassigned Service IDs never grant access.
- For a queue row with a Service, authorization checks the exact Service assignment. For a legacy row with null Service, authorization checks the retained Department assignment. Parent Department must be active.
- Service assignment changes update the Identity security stamp so existing sessions are revoked; disabled users and password-change requirements keep their existing behavior.

## Acceptance criteria

1. Admin can create and update Staff users with one or more active Service assignments; Admin and Reception cannot receive Service assignments.
2. Existing Staff accounts receive all Services in their existing assigned Departments during an additive migration; pre-existing Department assignments remain available for legacy service-less steps.
3. A Staff account cannot read another Service's queue rows, call its waiting visits, return its called visits, or complete/forward its called visits, even when both Services share a Department.
4. A Staff account can read, call, return, and complete/forward rows for assigned Services. Call-next preserves existing appointment-before-FIFO ordering across the account's assigned Services in the selected Department.
5. Staff can forward a visit to any active destination Service. Staff assigned to that destination Service can then operate the new step.
6. Session and Admin user-list data report Service assignments; the staff UI displays Service identity and Admin can select Services by Department.
7. Deactivating or changing assignments revokes existing sessions and cannot widen access. Historical null-Service steps remain operable only by staff with the retained Department assignment.
8. Service display devices, Reception issuance/reprint, Kiosks, and SPEC-007 Development + loopback Admin setup behavior remain unchanged.
9. MySQL migration is additive and tested against a disposable database containing existing Department assignments and both service-aware and service-less steps.
10. Admin can permanently delete a user after confirming in a modal; the API removes access assignments and records an audit event, refuses to delete the last active administrator, and explains that accounts tied to visit history should be deactivated instead.
11. Sign-in and password-change inputs can reveal or hide entered text; password-change guidance updates as the user types and reflects the API's configured password rules.

## Verification seams

- Primary seam: existing opt-in authenticated API/MySQL Playwright workflow. Verify assignment persistence, same-Department Service isolation for read/call/return/complete, forwarding to an unassigned destination, and migration preservation.
- UI seam: mocked Playwright Admin user workflow verifies Service selection is sent to the API and assignments are displayed; staff queue renders Service labels.
- Run focused .NET/frontend checks, existing lint/build, and `git diff --check`. Apply the migration only to a local disposable/test database; do not target production or a shared clinic database.

## Out of scope

Service-specific Reception permissions, station/counter-scoped authorization, service-filtered public displays, changing visit issue/forward policy, separate login pages or credentials per Service, patient identity/deduplication, and changing the Development-only Admin exception.
