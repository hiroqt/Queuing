# Tasks — SPEC-008

**Status:** Implemented and locally verified · 2026-10-22.

## A. Contract and model

- [x] Approve SPEC-008 behavior, scope, compatibility, and migration treatment.
- [x] Add API-client and browser checks for Service-based issue/forward and code/date reprint.
- [x] Add nullable same-Department `DepartmentStep.ServiceId` and an additive MySQL migration.

## B. Backend workflow

- [x] Add authenticated active-Service choices for Reception issue and Staff forwarding destinations.
- [x] Isolate Reception issue/receipt responsibilities inside the existing API project.
- [x] Issue with active `initialServiceId`, optional Asia/Manila appointment time, stable daily code, idempotency, audit, and outbox.
- [x] Look up the original receipt by canonical visit code and clinic date.
- [x] Forward using an active `nextServiceId`; keep final completion and existing historical steps valid.

## C. Frontend workflow

- [x] Update the centralized API client and its unit tests.
- [x] Update Reception Service selection, appointment, receipt lookup, and 58 mm manual print flow.
- [x] Update Staff next-Service selection while preserving current queue and display layouts.
- [x] Cover loading, empty, service-choice error, successful issue/reprint, print action, and Staff forwarding states in Playwright; exercise active/inactive service validation in the MySQL/API/browser integration.

## D. Verification and handoff

- [x] Run .NET build/tests and frontend unit/lint/build/E2E checks; record exact results in `acceptance.md`.
- [x] Run the opt-in real MySQL/browser integration against a disposable `_test` database and apply all migrations to the disposable schema.
- [x] Review migration compatibility, authorization, idempotency, receipt projection, and current UI workflow.
- [x] Update acceptance evidence, README/code map/structure, PRD/ARD, and SPEC-006 references based on the completed implementation.
