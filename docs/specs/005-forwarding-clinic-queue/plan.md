# Plan — SPEC-005

## Architecture

Keep the existing .NET 10 ASP.NET Core host and React 19/Vite SPA. Add a thin EF Core/MySQL persistence boundary and ASP.NET Core Identity only when the vertical slice needs them. Retain VB.NET core only for framework-independent workflow rules if it remains practical; do not place EF/ASP.NET dependencies in that library. Keep endpoints thin and feature-oriented in the existing API project. No speculative service/project split.

Use same-origin cookie sessions with antiforgery on mutations, secure cookie settings, role and department resource policies, rate limits on login/pairing, RFC 9457 errors, and structured logs without sensitive visit data. Pair displays with a short-lived one-time code; persist only a hash of the resulting revocable device credential. Scope both snapshot reads and SignalR group membership server-side.

Model one visit with a stable clinic-wide daily code and sequential department steps; each step owns its optional appointment time. Add unique constraints and transactional use cases for issue, call-next, return-to-pending, complete/forward, and pairing/configuration. Use a persisted outbox for committed queue changes; SignalR only tells authorized clients to reload. Start with one API instance and document that topology; do not add Redis or a broker.

## Dependency order

1. Finish domain/API/data contracts and authorization matrix from SPEC-005; update PRD/ARD, ADR-0002, open decisions, current code map, and project structure.
2. Add tests for the core invariants and API permission cases before implementation.
3. Add MySQL EF provider, Identity, settings, initial migration, one-time bootstrap, and local isolated database instructions.
4. Implement departments and user assignments; replace hard-coded service catalog reads with persisted active configuration.
5. Implement reception visit issue, optional appointment time, stable daily code, visit lookup/print projection.
6. Implement department queue ordering, call-next, return-to-pending, complete/forward with optional next-step appointment time and transaction/concurrency/idempotency tests.
7. Implement display registration/pairing/revocation, scoped REST snapshots, post-commit outbox notifications, SignalR reconnect.
8. Connect existing React workspace: login, role-aware navigation, admin config, reception issue, department operations, monitor pairing/setup, read-only department display.
9. Run MySQL integration and race tests, API security tests, frontend unit/E2E, lint/build, accessibility checks, and `git diff --check`; update docs with actual results.

## Test strategy

- Unit: queue ordering, future appointment eligibility, stable visit identity, transition rules, and idempotency.
- MySQL integration: migration/bootstrap, daily code uniqueness, atomic call/forward, unique active step, idempotent replays, and competing callers/issuers.
- API: login/CSRF, role and department scope, admin configuration, display pairing/revocation, safe projections, and Problem Details.
- E2E: admin provisions dynamic department/staff/display; receptionist issues; staff calls/no-show/re-calls/forwards; assigned display updates and cannot see another department; unauthorized staff is denied.
- Do not use EF InMemory to claim relational concurrency behavior.
