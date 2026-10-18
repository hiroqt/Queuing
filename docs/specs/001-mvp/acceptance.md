# ACCEPTANCE-001 — MVP Verification Matrix

**Status:** Not executed. Each case must have a repeatable automated test or a recorded human hardware/operational test.

| Case | Given / When / Then | Proof type |
|---|---|---|
| AC-01 | Admin creates active service and counter; staff view then shows allowed service without code deploy | API + e2e |
| AC-02 | Staff without counter assignment calls next; server returns 403 and no ticket changes | Integration/security |
| AC-03 | Two simultaneous issue requests in same service/session; numbers unique, no gaps required only if policy states so | PostgreSQL concurrency |
| AC-04 | Same idempotency key + same request retried; same ticket returned and exactly one ticket created | Integration |
| AC-05 | Same idempotency key + different payload; conflict and no extra ticket | Integration |
| AC-06 | Two counters concurrently call next from one eligible ticket; at most one succeeds; other reports empty/conflict | PostgreSQL concurrency |
| AC-07 | Staff completes Waiting ticket directly; 409, no state mutation | Domain + integration |
| AC-08 | Ticket printed then reprinted; identifier unchanged and reprint audited | Component + printer smoke |
| AC-09 | Display has scope Consultation only; no Laboratory ticket or staff/private data in its JSON/events | Security integration |
| AC-10 | Display loses websocket while queue changes; reconnect + snapshot reflects latest committed state | E2E/network simulation |
| AC-11 | Admin deactivates service with historic tickets; past ticket history remains readable | Integration |
| AC-12 | Unauthorized non-admin edits display layout; receives 403 and no config change | Security integration |
| AC-13 | Invalid config template key/schema rejected and does not execute stored script | Security integration |
| AC-14 | Restart backend with waiting/called tickets; canonical state remains intact | Recovery integration |
| AC-15 | Backup restored to staging; data consistency and application smoke checks pass | Operational rehearsal |
| AC-16 | Staff keyboard-only issue/call workflow operates and errors are announced accessibly | Accessibility e2e |

## Release gate
No MVP production rollout until AC-01..AC-16 pass or a written, authorized risk exception is approved. Record run date, build/commit, DB migration, tester and evidence link. Confirm open decisions are resolved.
