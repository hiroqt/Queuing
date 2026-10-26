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

## E. Approved Admin usability follow-up (2026-10-27)

- [x] Standardize all six Admin sections as compact list-first pages with accessible create/edit dialogs and contextual Actions controls.
- [x] Group Service and Station rows by Department; make Staff Service assignments readable and easier to select.
- [x] Add conditional search/status controls and split the Displays and lobby playlist views.
- [x] Update the existing mocked Admin browser workflow for the new dialogs, assignment checklists, and contextual actions.
- [x] Run frontend lint and production build.
- [x] Run the updated mocked Admin browser workflow (14/14 passed on 2026-10-27; local-setup workflow 2/2 passed).
- [x] Review representative screenshots for Departments at desktop/mobile widths and Stations/Displays at desktop width.
- [ ] Review all six pages, modal/action interactions, the playlist view, and mobile layouts in a browser.

## F. Approved Admin status and one-time dialog follow-up (2026-10-27)

- [x] Move statuses beside names and use clear Active/Inactive/Revoked visual states throughout all six Admin sections.
- [x] Replace credential and pairing banners with one reusable one-time dialog, including password reveal, clipboard feedback, usernames, and existing pairing guidance.
- [x] Update the existing mocked Admin browser workflow for badge placement and one-time dialogs.
- [x] Run frontend lint/build and record the results.
- [ ] Review the one-time dialogs and status badges in the browser; record unverified states.

## G. Approved Admin list search and pagination follow-up (2026-10-27)

- [x] Extend the shared list control with submitted search and client-side pagination for growing Admin collections.
- [x] Keep existing search fields, combine search/status, and reset to page one when either filter or page size changes.
- [x] Run frontend lint/build and update the acceptance record.
- [ ] Review search, status filtering, page-size selection, and page navigation in the browser.

## H. Approved section-specific Admin search follow-up (2026-10-27)

- [x] Always show the shared Search bar on Departments, Services, Stations, and Users when records exist.
- [x] Add section-specific prompts and search direct Department assignments for Users.
- [x] Run frontend lint/build and update the acceptance record.
- [ ] Review the four search bars and User assignment matching in the browser.
