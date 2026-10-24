# SPEC-009 — Self-service kiosk

**Status:** Approved · implementation added; verification incomplete · **Date:** 2026-10-22
**Extends:** [SPEC-005](../005-forwarding-clinic-queue/spec.md), [SPEC-008](../008-service-aware-visit-issue/spec.md)

**Current follow-up:** [SPEC-012](../012-department-ticket-numbering/spec.md) adds Department-local daily ticket numbers to kiosk receipts; the clinic-wide visit code remains available as a receipt lookup reference.

## Goal

Let a walk-in issue their own anonymous queue ticket by choosing a Department and then a Service, while keeping Reception and the database-backed queue authority intact.

## Confirmed decisions

- The patient flow is **Department → Service → confirmation → issue → receipt**. If a Department has exactly one active Service, preselect it and continue to confirmation. If it has no active Services, omit it from choices.
- A kiosk issues walk-in visits only. It does not ask for appointment, identity, or medical information.
- Each kiosk is Admin-registered, paired with a short-lived one-time code, and authenticated with a separate, revocable device cookie and policy. A kiosk is never represented as a Reception user or Display device.
- Kiosk-created Visits and audit rows record the issuing KioskDevice. Existing Reception visits retain their user attribution.
- The existing clinic-wide `Asia/Manila` daily sequence, active-Service validation, pending DepartmentStep, audit, and outbox behavior apply unchanged.
- Kiosk API calls are restricted to active Department/Service choices, issue, pairing activation, and kiosk logout. They cannot read receipt lookup, queues, Displays, or Admin records.
- The kiosk uses a distinct, high-contrast patient-facing interface with large touch controls and fluid layout. The same page must adapt from narrow phone/tablet widths to large kiosk screens; there is no fixed kiosk aspect ratio.
- The result offers an explicit browser-print action using the existing 58 mm ticket styling and an explicit “Start over” action. No automatic reset timer, silent printing, or hardware-specific print promise is added.
- Keep the existing React JavaScript, ASP.NET Core API, MySQL, and single deployment. The existing Reception flow remains available and unchanged in behavior.

## Design brief

- **User and task:** walk-in patient; independently select a destination and receive a number.
- **Surface mode:** operate.
- **Visual direction:** a distinct wayfinding surface: warm near-white canvas, deep navy ink, saturated coral for the primary action, a clear two-step progress rail, and large squared choice tiles. The ticket result uses oversized tabular numerals with a perforation rule as the recognizable cue. Typography is sans-serif for legibility; no stock imagery or decorative icons.
- **Hierarchy:** first identify the current step; next show only choices that matter; keep Back and Continue in consistent positions; make the final ticket code the dominant result.
- **Responsive/accessibility:** controls are at least 56 px high, reflow to one column on narrow screens, remain keyboard operable with visible focus, use labels/live status, and do not rely on color alone.
- **States:** loading, no active choices, API error, not paired, pending issue, successful receipt, and print failure are visible and recoverable.

## Scope

### In scope

- Admin registration, list, pairing-code generation/rotation, and revocation for KioskDevices.
- Anonymous one-time code activation; credentials are random, stored only as hashes, delivered only in an HttpOnly SameSite cookie, and revocable by Admin.
- Device-authenticated `GET /api/v1/kiosk/choices` returning active Departments with active Service children only.
- Device-authenticated, antiforgery-protected, idempotent `POST /api/v1/kiosk/visits` accepting an active Service ID only. The API derives the Department and creates a walk-in Visit and pending DepartmentStep atomically with sequence, audit, and outbox records.
- Separate kiosk authorization scheme/policy and IP-based limits for pairing and issue operations.
- Kiosk React routes `/kiosk` and `/kiosk/pair`, a responsive staged flow, receipt preview, manual print, and explicit start-over.
- Additive migration for KioskDevices, explicit kiosk actor attribution on visits/audit, and a database invariant requiring exactly one issuer (user or kiosk).
- Update PRD, ARD, docs map, structure, open decisions, and README navigation.

### Explicitly out of scope

- Reception or Staff auth changes, sharing DisplayDevice credentials/policy, or allowing kiosk reads of queue/display/receipt data.
- Appointments, patient identity, PHI, deduplication between separately issued visits, walk-in prioritization, offline issuance, or client-side numbering.
- Department/Service configuration changes, station-based queue behavior, multi-branch operation, remote management, or kiosk lockdown/browser configuration.
- Silent printer control, hardware integration/calibration, 80 mm receipt redesign, or auto-reset timers.
- New services, dependencies, database providers, or frontend frameworks.

## API and authorization contract

All routes are same-origin under `/api/v1`; cookie-authenticated mutations use the existing antiforgery header. Failures use Problem Details.

| Purpose | Contract | Access |
|---|---|---|
| Admin kiosk list/create/update | `/admin/kiosks` | Admin policy |
| Admin pairing-code rotation | `/admin/kiosks/{id}/pairing-code` | Admin policy; one-time code returned once, 10-minute expiry |
| Pair kiosk | `POST /kiosks/activate` | Anonymous, pairing IP limit; sets separate device cookie |
| Kiosk choices | `GET /kiosk/choices` | KioskDevice policy; active Department/Service labels and stable IDs only |
| Issue kiosk visit | `POST /kiosk/visits` + `Idempotency-Key` | KioskDevice policy, CSRF and issue IP limit; walk-in only |
| Unpair kiosk | `POST /kiosk/logout` | KioskDevice policy; clears kiosk cookie |

The issue endpoint revalidates that the submitted Service and owning Department are active. The client’s Department selection is only presentation; the server derives Department from the Service. Idempotency is scoped to the authenticated KioskDevice. A repeated key/body returns the original persisted receipt; a different body with the same key returns 409.

## Data and migration

- `KioskDevice` has a stable ID, name, active flag, pairing-code hash/expiry, credential hash, and paired time. It is independent from Department-scoped DisplayDevice.
- `Visit.IssuedByUserId` becomes nullable and `Visit.IssuedByKioskDeviceId` is nullable. A check constraint requires exactly one issuer. Existing user-issued rows remain unchanged.
- `AuditRecord.ActorKioskDeviceId` is nullable and indexed/FK-restricted for attributable kiosk issue events. Existing audit rows remain unchanged.
- Deactivation clears outstanding pairing and credential hashes; referenced devices are retained, not deleted.
- The migration is additive/backward compatible. Rollback must follow the standard database restore/recovery procedure because newly issued kiosk Visits cannot be represented in the old non-null user-issuer schema.

## Acceptance criteria

1. Admin can create a named kiosk, create/rotate a one-time pairing code, and revoke its access.
2. Unpaired/revoked/expired devices cannot load choices or issue. A paired kiosk cannot access Reception, Staff, Display, or Admin endpoints.
3. Choices contain only active Departments with active Services; each Service is nested under its actual Department.
4. The patient can select Department then Service. Exactly one Service is preselected, but the patient still confirms before issuing; multiple Services require an explicit choice.
5. Server rejects inactive/mismatched Service requests and ignores no hidden client-side authority. A successful issue returns a persisted ticket with one daily sequence, a walk-in initial step, kiosk attribution, audit, and outbox event.
6. Same-device retry with the same idempotency key cannot create a duplicate. Receipt code/date and service/department match the saved record.
7. No patient name, appointment time, clinical detail, staff identity, or queue snapshot is present in kiosk responses.
8. The interface fits narrow and wide viewports, provides visible keyboard focus, touch targets, and recoverable loading/error/empty/success states.
9. Print is user initiated and reads the persisted receipt. Physical output remains unverified until checked on target clinic printers.

## Security and operational limits

- Pairing code and session credential are cryptographically random, hash-only in storage, scoped to their own kiosk identity, and rate limited.
- Device cookie is HttpOnly, SameSite=Lax, Secure on HTTPS, host-scoped, and sent only same-origin. CSRF protection remains enabled for issue/logout.
- Issue, pairing, choice reads, and admin mutations are audited or rate limited as appropriate; credentials and codes are never logged.
- Kiosk issuance is unavailable offline. Same-origin TLS and the clinic network boundary must be in place for deployment; this spec does not configure kiosk hardware, firewall/VLAN, browser lockdown, or production hosting.
