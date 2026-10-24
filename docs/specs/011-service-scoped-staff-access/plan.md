# SPEC-011 Implementation Plan

**Status:** Approved · **Approved:** 2026-10-24

## Scope

- Requirement: SPEC-011 acceptance criteria 1–9.
- Owners: Identity/User administration, Staff queue authorization and presentation.
- Deployment: existing ASP.NET Core API, React SPA, and MySQL database; one additive migration.
- Assumptions: user identities remain individual; existing Department assignments are preserved for service-less historical queue steps and StationStaff FK compatibility; existing Staff service access is expanded from each current Department to all its Services at migration.

## Planned changes

1. Add `UserServices` to the EF model and additive MySQL migration; backfill assignments from `UserDepartments` without changing visits or DepartmentSteps.
2. Update Admin user APIs and form to assign Services, derive Department membership, return assignment IDs, and revoke sessions on changes.
3. Return Service assignments from the session endpoint; filter Staff's Department choices by assigned Services.
4. Enforce Service scope on queue snapshot, call-next's locked candidate selection, no-show requeue, and completion/forward. Keep the Department-level permission path only for null-Service historical rows and Admin.
5. Add Service labels to Staff queue rows. Keep destination Service choices global among active Services so existing forwarding remains intact.
6. Extend MySQL/API and mocked browser acceptance coverage; update PRD, open decisions, and code map.

## Authorization invariants

- No frontend value can grant Service access; the API resolves current database assignments on each request.
- Same-Department Services remain isolated for all service-aware steps and queue mutations.
- A returned or completed visit is authorized against its current step's Service, not the destination Service supplied by the client.
- Inactive Services cannot receive new visits, but a previously assigned user can drain already-active work. Inactive Departments block all queue access.
- Local anonymous Admin access remains exactly as approved in SPEC-007.

## Verification and rollout

- Red/green API/MySQL tests for two Services in one Department, including denied cross-Service read and mutation; test migration backfill from existing user/department rows.
- Mocked browser coverage for Admin assignment controls and visible Staff Service labels.
- Run .NET build/tests, frontend unit/E2E, lint/build, and `git diff --check` as available. Apply migration on a disposable local MySQL database with prior Department assignments and nullable ServiceId history.
- Existing local clinic databases receive the migration after backup. Rollback should restore the pre-migration database if user assignments have been edited after applying it; the Down migration may drop the new assignment table.
