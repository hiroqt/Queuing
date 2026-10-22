# PRD — Clinic Queue MVP

**Document ID:** PRD-CQ-001 | **Version:** 0.1 | **Status:** Proposed | **Owner:** Product + Clinic operations | **Change policy:** MVP scope frozen after signoff; future capabilities append new versions and linked specifications.

> Approved implementation addendum: [SPEC-005](docs/specs/005-forwarding-clinic-queue/spec.md) defines the forwarding workflow. It uses one stable anonymous visit code, manual appointment times, dynamic departments, department-scoped displays, and local MySQL. It does not imply the broader proposed PRD is fully implemented or approve production use.

## 1. Product statement
A configurable, reliable clinic queue that staff can operate, admins can configure, and patients can follow through printed tickets and public displays. It is **not** a medical record system. All patient-facing views use anonymous ticket identifiers.

## 2. Problem and goals
Manual calls and inflexible ticket numbers lead to confusion, duplicate calls, and inconsistent display information. Goals: (G1) reliably issue a unique ticket; (G2) operate queues by authorized staff/counters; (G3) show committed queue state on configurable screens; (G4) adjust routine clinic setup without code changes; (G5) retain auditable history and recover from restarts/disconnects.

## 3. Personas and permissions
- **Admin:** create/disable services, counters, staff assignments, ticket templates and display profiles; configure clinic timezone/session/numbering policies; review audit events.
- **Staff:** sign in; select authorized counter; issue ticket for permitted service; call/recall/skip/complete tickets; reprint with reason if permitted. Cannot modify global configuration.
- **Public viewer:** only display assigned queue, non-sensitive ticket data; device enrollment governed by admin.

## 4. MVP functional requirements (priority P0 unless marked)
| ID | Requirement | Acceptance checkpoint |
|---|---|---|
| FR-01 | Staff/admin authentication, logout, sessions, role+resource policies | Unauthorized calls denied server-side |
| FR-02 | Admin configure active services, prefixes and numbering policy | New service appears to authorized staff without code deploy |
| FR-03 | Admin configure counters and service eligibility; assign staff | Staff can only operate assigned counters |
| FR-04 | Admin register/revoke screens; assign services/counters, choose approved layout | Screen instantly reflects saved config on refresh/realtime event |
| FR-05 | Admin configure ticket templates (58/80mm presets, safe branding) | Print preview matches selected template and ticket record |
| FR-06 | Staff issue ticket through API, with collision-safe sequence | Two concurrent issues never share sequence in same session/service |
| FR-07 | Staff call next atomically, recall, skip and complete through valid transitions | Two counters never claim same ticket |
| FR-08 | Staff print/reprint persisted ticket; prevent accidental duplicate issuance | Reprint same ID, logged and identifiable |
| FR-09 | Display now-serving items in real time using SignalR and snapshot reload | Reconnect recovers current state after missed event |
| FR-10 | Audit config, authorization-relevant changes and ticket lifecycle | Admin can trace who did what and when |
| FR-11 | Admin/staff responsive desktop-first screens and accessible controls; patient kiosk adapts from small screens to touch kiosks | Keyboard interaction, large touch targets, visible loading/error states |
| FR-12 | Deactivate rather than delete referenced configuration | Historical ticket remains readable |
| FR-13 | Configurable clinic timezone and queue-session reset policy | Numbering resets only at defined session boundary |
| FR-14 | Admin enroll/revoke kiosks; patient issues an anonymous walk-in ticket by Department then Service | Only a paired kiosk can issue; service and daily sequence are server validated |

## 5. Typical end-to-end journey
Admin creates Consultation service and Counter 1; assigns staff and Main Lobby screen; chooses format and prefix. Staff logs in, opens Counter 1, issues `C-001` in current session, prints it, calls next; backend transaction commits; display receives update and shows `C-001 — Counter 1`; on websocket interruption, display reads a fresh snapshot and resumes.

## 6. Admin screens (MVP)
- Sign-in, admin overview, services CRUD/deactivate, counters and service mapping, staff provisioning/assignments, queue policy form, display enrollment/assignment/layout, ticket template editor (approved parameters only), audit history.

## 7. Staff screens (MVP)
- Sign-in, counter selector (assigned only), queue summary, ticket issue form/print preview, call-next/recall/skip/complete with confirmation where destructive; clear loading/conflict feedback.

## 8. Display screens (MVP)
- Device pairing/activation flow; full-screen read-only now-serving layout; service/counter filters from server profile; updated-at indicator, reconnection state and safe fallback. No patient names.

## 8a. Patient kiosk (SPEC-009)
- Department → Service selection, confirm, issue an anonymous walk-in ticket, and show its persisted code with manual print and start-over actions. Admin pairs and revokes kiosk devices; the kiosk cannot access queue or staff data.

## 9. Non-functional requirements (targets to validate during pilot)
- **Consistency:** no duplicate session/service ticket identifiers; atomic call-next; server is source of truth.
- **Performance initial target:** P95 typical authenticated command < 1 second under pilot load; display notification target < 2 seconds after commit in healthy LAN. These are provisional service objectives, not guarantees.
- **Availability:** recover state after process restart; operational plan for network/internet outages; define RTO/RPO with clinic before launch.
- **Security:** HTTPS, CSRF prevention, least privilege, secure cookie/session, rate limiting and redacted logs.
- **Privacy:** anonymous public ticket identifiers; no PHI in MVP; comply with relevant privacy obligations and retention approval.
- **Accessibility:** keyboard operation, readable TV contrast, responsive layouts, state not indicated by color alone.
- **Maintainability:** reviewed migrations, typed API contract, unit/integration/concurrency testing, documented release/rollback.

## 10. Out of scope for MVP
Patient charts, appointment/scheduling engine, billing, payment, SMS/email, voice announcements, queue prediction or kiosk functions beyond the bounded ticket issue flow in SPEC-009, mobile native app, inter-branch federation, offline queue issuing, arbitrary drag-and-drop custom code, custom clinical triage/priority rules, BI/analytics.

## 11. Success metrics
Zero duplicate ticket claims in concurrency suite/pilot; 100% privileged mutations attributed in audit; staff can issue/call/complete in normal flow; admin can add service/counter/display without code change; screen resynchronizes after simulated disconnect; printing verified on chosen physical printer; restore drill successful.

## 12. Dependencies and assumptions
Clinic will supply printing hardware constraints, session/number-reset definition, recall/skip behavior, screen connectivity topology, administrative provisioning policy, and retention requirements. See `docs/OPEN_DECISIONS.md`.

## 13. Expansion protocol (post-MVP)
Each proposed new capability receives `PRD-CQ-00N` addendum: user problem, bounded context, data sensitivity, role matrix, acceptance and non-goals. Update ARD/ADR and a new numbered spec before coding. Future ideas: appointments, multiple branches, reporting, priority, integrations; **not pre-approved**.

### Approved forwarding workflow addendum — 2026-10-20

See [SPEC-005](docs/specs/005-forwarding-clinic-queue/spec.md) and [ADR-0002](docs/adr/0002-mysql-and-forwarding-visits.md). Decisions: local MySQL 8.x; `Asia/Manila`; one clinic-wide daily visit code that remains unchanged across departments; manual optional appointment entry per department step; due appointments before FIFO walk-ins; one active department step per visit; Admin, Reception, and department-assigned Staff; admin-created revocable monitors scoped to one department. No patient identity fields or external appointment-system integration.

### Approved service and station configuration addendum — 2026-10-21

See [SPEC-006](docs/specs/006-service-station-admin-config/spec.md). For FR-03, the existing Department is the legacy channel; each Service and physical Station belongs to one Department; Stations may be associated with multiple Services and Staff assigned to that same Department. The original SPEC-006 slice was configuration-only; the service-aware issue and forwarding follow-up is now approved in SPEC-008.

### Approved service-aware visit workflow addendum — 2026-10-21

See [SPEC-008](docs/specs/008-service-aware-visit-issue/spec.md). Reception selects an active Service and the API derives its Department; staff choose an active next Service when forwarding. Each new department step retains its Service, while existing Department-scoped call-next and display behavior stays in place. Reception can reprint the original issue details using the daily visit code and Asia/Manila clinic date. The stable clinic-wide code, appointment ordering, anonymous visit data, manual 58 mm browser print, and current React design remain unchanged. Station-based calling and patient-level duplicate detection are not included.

### PRD-CQ-009 — Self-service kiosk

See [SPEC-009](docs/specs/009-self-service-kiosk/spec.md). A paired kiosk lets a walk-in choose an active Department, then one of its active Services, and issue an anonymous ticket through the same durable daily sequence as Reception. A single active Service is preselected. Kiosks use a separate revocable device identity and a responsive, touch-first visual direction; they cannot read queues or staff/receipt data. Ticket printing remains a user-initiated browser print action.
