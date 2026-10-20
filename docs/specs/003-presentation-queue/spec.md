# SPEC-003 — Presentation queue dashboard

**Status:** Approved for local demonstration | **Date:** 2026-10-19 | **Related:** PRD FR-01, FR-08, FR-09; ARD §§2, 5, 8, 11

> The initial issue/display-only scope is preserved as history. The current local demo call flow is specified in [SPEC-004](../004-demo-call-flow/spec.md), which supersedes this document only for call and display behavior.

## Goal and boundary

Connect the existing React app to the ASP.NET Core API for one local presentation dashboard that issues a ticket, shows its printable confirmation, and displays queue state. This is a demo slice, not production queue infrastructure.

In scope: the three existing services (Consultation, Laboratory, Follow-up), one shared sequential ticket number (`001`, `002`, …), issue confirmation, and an anonymous display projection with up to three waiting tickets followed by the now-calling section. The now-calling section remains empty until a separately approved call workflow exists.

Out of scope: admin changes, staff sign-in/authorization, call/skip/complete actions, database, persistence across API restarts, multi-instance operation, patient information, physical printer integration, SignalR, and production deployment.

## User and flow

- A local demo operator uses one combined issue-and-display dashboard. No sign-in is provided; run the demo on localhost and use synthetic queue data only.
- The operator chooses one of the existing sample services and issues a ticket.
- The API assigns the canonical number and returns the ticket. The frontend shows a print-ready confirmation and refreshes the queue display from the API.
- The display sorts waiting tickets by issue sequence, shows the first three, then shows the now-calling section. It exposes only ticket number, service, and status. With no call action, that section is empty.

## Architecture and data

- Keep the existing C# ASP.NET Core controller API and VB.NET `Queuing.Core` project; do not migrate languages or create extra production layers.
- `Queuing.Core` owns the demo queue state, service allowlist, global sequence, and ticket projection. ASP.NET Core registers its state owner as a singleton. A lock makes issue, retry lookup, sequence assignment, and snapshot reads consistent within this one process.
- State is volatile and resets when the API process restarts. This explicitly overrides the repository's database-backed numbering rule for this presentation-only slice; do not describe the result as durable, horizontally scalable, or production-ready.
- Expose `GET /api/v1/services`, `POST /api/v1/tickets`, `GET /api/v1/tickets/{id}`, and `GET /api/v1/queue/display`. Reject unknown/inactive service IDs with a client error. Use Problem Details for API errors.
- Ticket issue accepts an `Idempotency-Key`; a retry with the same key and service returns the same ticket, while reuse with a different service returns conflict. The in-memory key follows the same restart limit as queue state.
- Keep configuration in the VB.NET core's small demo service catalog; no admin UI or database configuration is introduced. The frontend obtains service choices from the API rather than duplicating the catalog.
- Vite proxies `/api` to the existing local API URL. Preserve the established green clinic workspace style while consolidating issue and display in one dashboard.

## Assumptions and risks

- Local-only usage means no authentication for this demo. Do not bind the demo API to a network interface or enter patient information.
- A single global sequence across services is the approved presentation behavior; it is not a clinic numbering/reset policy.
- Browser printing is a print-dialog action from a print-ready ticket view; printer hardware and print success are not guaranteed.
- If durable or shared operation is needed, replace the volatile store with the approved PostgreSQL design before using the workflow outside local presentation.
