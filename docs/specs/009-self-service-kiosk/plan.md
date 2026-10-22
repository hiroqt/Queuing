# SPEC-009 implementation plan

## Scope and architecture

- **Requirement IDs:** PRD-CQ-009; SPEC-009 acceptance 1–9.
- **Owner:** Queueing modular monolith; API owns authorization, issuance, sequence, persistence, audit, and outbox; React owns staged choices and presentation.
- **Deployment/project impact:** additive schema migration in existing ASP.NET Core/MySQL API; new routes/components in existing React app; no new project or dependency.
- **Assumptions:** walk-in only; active Services are nested under active Departments; a single service is preselected but confirmation remains; browser print stays manual at 58 mm; explicit reset only.
- **API/schema:** new KioskDevices and separate KioskDevice auth; shared atomic visit issuance path; nullable issuer alternatives with exactly-one-issuer constraint; kiosk audit actor FK.
- **Authorization:** Admin manages devices; a distinct device scheme gates kiosk catalog and issue; activation is anonymous but rate limited; Reception and Display policies remain unchanged.
- **Invariants:** server revalidates Service/Department; one issuer per Visit; one clinic-local sequence per ticket; same-key retry is stable; kiosk data omits identity and queue records; audit/outbox commit with issue.
- **Risk:** schema migration touches issuer FKs and requires recovery on rollback after kiosk issuance; device pairing is a bearer credential; physical network and printer setup remain deployment responsibilities.

## Dependency order

1. Record approved behavior and design direction in this spec and PRD/ARD/open-decision docs.
2. Add additive device/actor schema and migration model snapshot.
3. Add kiosk device auth, Admin device lifecycle endpoints, pairing/choices/issue/logout endpoints, and rate limits.
4. Reuse the existing transactional issue implementation for Reception and kiosk so numbering and outbox behavior cannot diverge.
5. Add Admin Kiosks management and one-time pairing notice.
6. Add `/kiosk` and `/kiosk/pair` outside staff authentication, API client methods, staged responsive UI, and isolated styles.
7. Update README, code map, structure, open decisions, and implementation record.

## Contract and check design

- API authorization matrix: anonymous, staff session, DisplayDevice, active KioskDevice, revoked KioskDevice, Admin.
- Data contract: active choices only; Service belongs to returned Department; kiosk issue has no appointment input; Visit and AuditRecord have kiosk attribution.
- Invariants: service revalidation, single issuer constraint, database-backed sequence, per-device idempotency/replay/conflict, audit and outbox in issue transaction.
- UI cases: no device pairing, loading/error/empty choices, one/multiple services, Back, pending/failed issue retry with same key, receipt, print, start-over, 320px and wide layouts, keyboard/focus.
- Required downstream checks are listed in `acceptance.md`; current implementation turn will report checks actually available/run separately.

## File map

- Backend: `Program.cs`, `Auth/QueueRoles.cs`, new kiosk auth handler, `Data/QueueDbContext.cs`, migration, existing visit issuance service/controller, new kiosk/admin controller(s), shared visit command support.
- Frontend: `App.jsx`, `api/client.js`, admin section registry/layout/nav, new `features/admin/sections/KiosksSection.jsx`, new `features/kiosk/` pages, `index.css`.
- Docs: `PRD.md`, `ARD.md`, `README.md`, `docs/OPEN_DECISIONS.md`, `docs/CODEBASE_MAP.md`, `docs/STRUCTURE.md`, this SPEC-009 folder.
