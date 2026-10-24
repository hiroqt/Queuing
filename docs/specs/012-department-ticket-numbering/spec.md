# SPEC-012 — Department ticket numbers and lobby video autoplay

**Status:** Approved · implementation in progress · **Date:** 2026-10-24
**Extends:** [SPEC-008](../008-service-aware-visit-issue/spec.md), [SPEC-009](../009-self-service-kiosk/spec.md), [SPEC-010](../010-multi-department-lobby-display/spec.md)

## Goal

Give each Department its own daily ticket sequence while preserving the existing clinic-wide visit code for receipt lookup and visit continuity. Start lobby playlist video automatically when its display opens.

## Confirmed decisions

- Department ticket numbers are independent per Department and Asia/Manila clinic date, start at `001`, and are allocated by the API/database.
- The existing clinic-wide daily visit code remains stable across a visit and is still used for Reception lookup and forwarding. Patient-facing tickets and Department displays prominently show the Department ticket number; the receipt also retains the clinic visit code as a reference.
- A forwarded visit receives a new Department ticket number when it enters the destination Department. The original receipt continues to show the number issued by its original Department.
- Historical Department steps have no guessed Department number; their existing visit code remains the display fallback.
- Lobby video starts automatically muted when the lobby display opens. A direct user action on that display enables sound because browsers may block audible autoplay.
- Queue ordering, call behavior, visit identity, and authorization remain unchanged.

## Scope and contracts

- Add a database-backed Department/date sequence counter and nullable ticket date/number fields on DepartmentSteps. Allocate and persist them in the same transaction as issue or forward, with a unique `(DepartmentId, TicketDate, TicketNumber)` constraint.
- Reception and kiosk issue responses, receipt lookup, staff queue/forward responses, and Department/lobby snapshots include the current step's Department ticket number where applicable.
- Department ticket numbers are assigned on both Reception/kiosk issue and Staff forwarding. Idempotent replays return the previously saved number without incrementing it again.
- Existing visits and steps migrate without destructive changes. Old steps remain readable and show their clinic visit code as a fallback.
- The lobby playlist attempts muted autoplay. The existing user gesture control enables sound; a blocked or unsupported video leaves queue information visible and offers a retry.

## Acceptance criteria

1. Two Departments issuing on the same clinic date can both receive `001`; concurrent tickets within one Department receive distinct increasing numbers.
2. The number is assigned inside the issue transaction for Reception and kiosk. Same-key retries return the original Department number and do not consume another number.
3. Forwarding to a Department assigns a number from that destination Department's daily sequence; a failed/rolled-back forward does not consume a number.
4. Department and lobby displays show the Department number. Queue operations and forwarding preserve the stable clinic-wide visit code.
5. Receipt lookup by the existing clinic visit code/date returns the original Department number. Reception and kiosk ticket print views identify the Department number and retain the clinic visit code as a lookup reference.
6. Historical steps without a Department number continue to appear using the existing visit code; migration preserves all records.
7. Lobby playlist attempts muted autoplay on open and advances/loops. A user action enables sound, and video failure does not hide queue data.
8. Authorization, CSRF, Department scoping, audit, outbox, and existing ordering rules remain unchanged.

## Verification and rollout

- Exercise per-Department independence, same-Department concurrency, issue idempotency, forwarding, lookup, and legacy fallback against disposable MySQL 8.x data.
- Run focused API/core tests and the relevant frontend unit/E2E workflow; verify lobby autoplay and sound control in a browser.
- Apply the additive migration before deploying API/UI code. No existing ticket or visit code is rewritten. Rollback requires removing only the newly added sequence table and nullable step fields after confirming no new API version depends on them.

## Out of scope

- Changing the clinic-wide visit code, adding Department prefixes, changing queue order, ticket numbering beyond daily Asia/Manila reset, or changing browser autoplay policy.
