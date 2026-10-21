# Tasks — SPEC-006

## A. Specification and contracts

- [x] Record the approved channel/Department, Service ownership, physical Station, association, scope, and authorization decisions.
- [x] Define API contracts, invariants, acceptance criteria, and the future queue integration boundary.
- [x] Update PRD, ARD, open decisions, code map, and structure docs.

## B. Persistence and API

- [x] Add Service, Station, StationService, and StationStaff relational records and same-department constraints.
- [x] Add Admin-only Service and Station list/create/update endpoints with validation and audit.
- [x] Remove invalid Station-Staff assignments transactionally when staff role, activity, or department access changes.
- [x] Add and inspect an additive migration; apply it on a fresh disposable MySQL schema. A populated pre-feature schema upgrade was not separately simulated.

## C. Frontend and tests

- [x] Add service/station methods to the shared API client and API-client tests.
- [x] Add Service and Station management to the existing Admin page without visual redesign.
- [x] Add mocked Admin browser coverage for create/update and error feedback.
- [x] Extend opt-in MySQL integration coverage for persistence, authorization, constraints, and cleanup.

## D. Verification and handoff

- [x] Run relevant frontend unit/E2E, lint/build, and .NET build/test checks.
- [x] Run opt-in MySQL integration against a disposable `_test` database.
- [x] Review migration, authorization, accessibility/responsiveness, and final diff; a dedicated viewport audit was not run.
- [x] Record exact checks, outcomes, and remaining limitations in acceptance and navigation docs.
