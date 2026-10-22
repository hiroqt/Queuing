# Tasks — SPEC-009

**Status:** Implemented; required behavior and database checks remain pending.

## A. Contract and persistence

- [x] Approve Department → Service, walk-in-only, distinct responsive UI, and separate device identity.
- [x] Add kiosk device, explicit Visit/Audit issuer attribution, and exactly-one-issuer constraint.
- [x] Scaffold the additive MySQL migration and model snapshot.
- [ ] Apply migration against disposable MySQL and confirm existing Reception-issued rows remain attributed.

## B. Backend workflow and access

- [x] Add separate KioskDevice cookie/auth policy and Admin create, pair, rotate, reactivate, and revoke operations.
- [x] Add active Department/Service choice projection and antiforgery/idempotent kiosk issue through the shared transaction.
- [x] Add pairing and issue rate limits; record kiosk actor on Visit and audit.
- [ ] Verify anonymous/staff/display/revoked/active-kiosk/Admin authorization matrix, service validation, replay/conflict, audit, and outbox behavior.

## C. Frontend workflow

- [x] Add Admin Kiosks management and one-time pairing-code notice.
- [x] Add standalone `/kiosk` and `/kiosk/pair` routes and shared API methods.
- [x] Add Department → Service → confirmation → ticket, retry-safe issue, manual print, and explicit start-over.
- [x] Add isolated high-contrast responsive styles, visible focus, reduced-motion handling, and 58 mm print layout.
- [ ] Review browser layouts, keyboard/accessibility behavior, and live states at narrow, tablet, and wide viewports.
- [ ] Verify manual print output on target clinic hardware.

## D. Review and handoff

- [x] Update PRD, ARD, AGENTS/clinic-queue scope, README, code map, structure, and open decisions.
- [x] Run .NET solution build, frontend lint/build, and `git diff --check`.
- [ ] Run kiosk API/frontend behavior tests and full acceptance suite when authorized.
- [ ] Record final independent review and migration/recovery evidence.
