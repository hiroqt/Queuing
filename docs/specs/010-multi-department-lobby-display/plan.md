# SPEC-010 Implementation Plan

**Status:** Approved · implementation added; verification incomplete

## Scope and ownership

- Requirement IDs: SPEC-010 criteria 1–9.
- Owning module: existing Displays capability in `backend/Queuing.Api` plus existing React display/admin feature folders.
- Deployment impact: same modular-monolith API and SPA; local persistent media directory; no new service or package.
- Assumptions: device type shares existing display pairing, credentials, revocation, and SignalR lifecycle; hub groups include the credential hash as a generation so re-pairing excludes stale connections; playlist is global and ordered by creation time; one-time Start occurs on the lobby display.

## Planned changes

1. Add the proposed SPEC-010 and update PRD/OPEN_DECISIONS only after approval.
2. Extend `DisplayDevice` with a type and optional Department FK; migrate existing rows as department monitors. Add `DisplayVideo` metadata and a non-destructive migration.
3. Update display auth claims/authorization and SignalR targeting so department devices remain scoped, lobby devices get the lobby snapshot, and invalidations target only currently active paired credential generations.
4. Add lobby snapshot query, ordered as existing queue policy; select latest `CalledAtUtc` and at most three pending entries per active Department.
5. Add admin playlist endpoints for HTTPS URL entries and bounded MP4/WebM upload/list/remove. Store generated file keys under a persistent path outside web root, use CSRF on mutations, validate signatures/size, and serve byte ranges only to active lobby devices.
6. Extend Admin Displays UI with lobby registration and a shared playlist manager; add lobby pairing/view routing, active-department cards, one-time audible Start, sequential looping playback, and recoverable media/queue states. Poll snapshots every 30 seconds as a bounded fallback for missed notifications.
7. Update focused backend/API and frontend tests, E2E pairing/revocation/playlist flow, and navigation docs (`PRD.md`, `docs/OPEN_DECISIONS.md`, `docs/CODEBASE_MAP.md`, `docs/STRUCTURE.md` only where source navigation changes).

## Contracts, authorization, invariants

- Department monitor snapshot and SignalR access continue to require exactly its active Department assignment.
- Lobby snapshot and media access require an active paired device of lobby type; revocation invalidates existing cookie/hub access.
- Queue projection is read-only, anonymous, database-backed, and includes active Departments only.
- Admin playlist mutations are Admin-authorized, CSRF-protected, validated, and audited. File metadata and file lifecycle must not leave orphan files or dangling rows on failure.
- Queue ordering and all issue/call/visit state transitions remain unchanged.

## Verification plan

- Baseline and after-change .NET build/tests; focused display authorization and snapshot tests.
- Migration apply on a disposable MySQL 8.x database, verifying existing display rows retain Department assignments and pairability.
- Frontend unit tests, lint, build, and Playwright display workflow for both display types, active Department changes, playlist, audible Start, empty/error states, and revocation.
- `git diff --check`; inspect final diff and security/privacy boundaries.
- Local file upload/range behavior and target-browser audible playback require runtime verification; no production, multi-instance, or hardware readiness claim.

## Risks and rollback

- The nullable Department/type migration and auth changes can accidentally widen existing monitor access; preserve device-type checks at each API and hub boundary and test both mismatch directions.
- Local media persistence depends on a writable path included in backup/recovery and shared by the API process. The migration intentionally refuses automatic `Down` because rolling back can discard lobby devices and playlist metadata while leaving media files; retain the database and media directory together or restore a matched backup.
- Audible autoplay needs one gesture on each lobby browser session; browser/device validation is required.
