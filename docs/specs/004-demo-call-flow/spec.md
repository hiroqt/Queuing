# SPEC-004 — Local demo call workflow

**Status:** Approved for localhost presentation | **Date:** 2026-10-20 | **Supersedes:** SPEC-003 only for the demo call/display behavior

## Goal

Demonstrate a coherent queue flow: issue a ticket in the dashboard, call the next waiting ticket for its selected service, and show that same issued ticket on the standalone public display.

## Scope

- Start with an empty queue. Populate the presentation by issuing tickets live.
- Keep the existing three demo services and shared sequential ticket numbers.
- Add one service-scoped `Call next` command using the selected dashboard service and the demo counter label `Counter 01`.
- Select the oldest waiting ticket for that service only. If none exists, return a clear conflict and leave all queue state and numbering unchanged.
- Make call requests idempotent within the running API process so a retry cannot call a second ticket.
- Use the existing in-memory store as the sole source for issued, waiting, and called tickets. The dashboard snapshot and TV display must agree.
- Send SignalR notifications after the in-memory transition; snapshots remain authoritative and are reloaded on connect/reconnect.
- Keep the display read-only. Call and recall are not Hub methods. Remove recall from this demo slice because the approved behavior and UI do not define recall semantics.
- Show only tickets with an active `Called` status on the TV display. Do not seed fake or completed entries.
- Replace unverified clinic identity and medical/operational ticker content with generic, clearly demo-labeled copy.

## Boundaries

- This remains a localhost presentation demo with one API process, volatile memory, no database, no staff authentication, no pairing, and no production deployment claim.
- Bind the documented local run command to loopback. Do not use real patient data or expose the demo API to a shared network.
- No new projects, services, databases, persistence, authorization framework, or queue infrastructure.
- Production ARD/PRD requirements for database-backed sequencing, resource authorization, display enrollment, audit, outbox, and multi-instance realtime remain unmet.

## Acceptance

1. A fresh API store and display show an empty queue; no synthetic or completed tickets appear.
2. Issuing tickets increments the shared sequence. Calling a service selects its oldest waiting ticket without affecting other services.
3. Calling an unknown service or a service with no waiting ticket returns a machine-readable error and does not change queue state.
4. Repeating the same call idempotency key and service returns the same ticket; reusing the key for a different service returns conflict.
5. The dashboard shows waiting and called sections from the same store and offers Call next for the selected service.
6. A second browser page at `/display` shows the called ticket, counter, and status from the initial REST snapshot and receives subsequent call notifications. Reconnect reloads a snapshot.
7. The Hub is read-only; commands are sent through the REST API. Recall is absent from this demo.
8. The TV page contains no invented clinic name, hours, insurance, fasting, or priority guidance.

## Verification seam

- Unit tests call the public `QueueDemoStore` issue, call, and snapshot operations.
- One Playwright workflow issues tickets, calls a selected service, verifies the dashboard result, and observes the same call on the TV display.
- Run the existing .NET and frontend test, lint, and build commands after implementation. These prove local demo behavior only, not production readiness or full WCAG conformance.
