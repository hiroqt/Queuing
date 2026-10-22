# SPEC-009 acceptance record

## Approved behavior

- **Department → Service** flow; preselect when one active Service exists; confirmation still required.
- Distinct, responsive, touch-first kiosk visual direction with no fixed device aspect ratio.
- Separate Admin-enrolled, revocable kiosk identity; walk-in-only issue; no patient identity or appointments.
- Same persisted daily visit code and queue rules as Reception; explicit manual print and start-over.

## Implementation status

API, migration, Admin setup, kiosk pairing, and patient-facing flow are implemented. `dotnet build Queuing.slnx`, frontend lint/build, and `git diff --check` passed. Automated behavior tests, applying the migration to MySQL, browser visual/accessibility review, and printer output were not run in this turn.

## Required evidence

- [ ] Migration applies against a disposable MySQL 8.x schema; existing user-issued rows remain attributed.
- [ ] API authorization, service validation, idempotency replay/conflict, actor audit, and outbox checks pass.
- [ ] Frontend lint/build and kiosk flow checks pass.
- [ ] Responsive/keyboard review at narrow mobile, tablet, and wide kiosk viewports.
- [ ] Manual print preview checked; physical printer output remains a clinic hardware check.
- [ ] Final diff and security review complete; deployment and recovery notes updated.
