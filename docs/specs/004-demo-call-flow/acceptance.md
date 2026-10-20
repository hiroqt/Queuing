# SPEC-004 verification record

**Verified:** 2026-10-20, local developer environment

## Behavior checked

- The API starts with an empty queue; ticket issuance uses one shared sequence across the three demo services.
- `QueueDemoStore` tests cover service-scoped FIFO calling, empty/invalid service outcomes without fabricated calls, idempotent retry, and request-key conflict behavior.
- The dashboard issues tickets, presents its printable confirmation, shows up to three waiting tickets before called tickets, and calls only the selected service.
- The public display receives the same called ticket through its REST snapshot and a subsequent SignalR event.
- A call against a service with no waiting ticket returns a conflict and leaves the other services' waiting tickets intact.
- The SignalR Hub exposes snapshots/events only; REST owns issue/call commands.

## Checks run

| Check | Result |
| --- | --- |
| `dotnet test Queuing.slnx --no-restore --disable-build-servers -m:1 -p:UseSharedCompilation=false` | Passed, 12 tests |
| `npm test` in `frontend/` | Passed, 5 tests |
| `npm run lint` in `frontend/` | Passed |
| `npm run build` in `frontend/` | Passed |
| `npm run test:e2e` in `frontend/` | Passed, 3 browser tests |
| `git diff --check` | Passed |

The browser workflow uses the local API and Playwright Chromium. These checks validate this single-process demo path; they do not establish database-backed sequencing, multi-instance behavior, authentication, production readiness, or full WCAG conformance. The existing accessibility report is historical; the current screens have not received a complete WCAG or assistive-technology audit.
