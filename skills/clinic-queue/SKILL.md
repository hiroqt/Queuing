---
name: clinic-queue
description: Implement and evolve the clinic queue system within its approved scope, using the live repository stack and modular monolith boundaries. Activate for feature, bug, schema, security, printing, SignalR, API or testing work.
---

# Clinic Queue Engineering Skill

## Required reading
Read `AGENTS.md`, `PRD.md`, `ARD.md`, `SDD.md`, affected `docs/specs/*` and open decisions. This skill does not grant permission to exceed accepted scope. Only act on approved specs.

## Scope filter
Allowed: admin/staff roles and screens; services/counters/assignments; tickets/printing; screen registration, approved templates, queue display; support layers for security/audit/ops. Refuse automatic expansion into billing, EHR, appointments, kiosk, SMS, multi-tenant branches or executable configuration. Ask for a new versioned spec/ADR instead.

## Scalable evolution
- Keep one deployable ASP.NET Core application and one database as the default. Treat module boundaries as code/data ownership boundaries; do not add services, brokers, caches or deployment units without a measured need and an approved decision.
- Organize implementation by capability and vertical slice. Keep boundaries logical within existing projects at first; split projects/assemblies only when compile-time dependency enforcement, independent ownership, or test/build isolation provides a concrete benefit. Do not create empty Domain/Application/Infrastructure projects or generic repositories for the diagram.
- Keep queue correctness in PostgreSQL: constraints and short transactions protect shared invariants across API instances. Process memory is never authoritative for ticket numbers or queue state.
- `docs/specs/003-presentation-queue/` is an explicit exception for a localhost presentation only: it permits volatile, single-process ticket state. Never reuse that implementation for clinic operations, multiple API instances, or production; restore database-backed sequencing first.
- Persist outbox records with the business transaction, then dispatch after commit. Design dispatch and consumers to tolerate retries; SignalR remains an invalidation hint and clients reload authoritative snapshots.
- Evolve API, database and configuration contracts compatibly where practical. Update OpenAPI clients and migrations together; record breaking or architectural changes in a spec/ADR with rollout and recovery implications.

## Repository and .NET fit
- Inspect the solution and project files before choosing a pattern or language. The current checkout has a C# ASP.NET Core API, a VB.NET core library, and a React JavaScript frontend. Apply language-specific guidance only to the project being changed; do not convert VB to C# or JavaScript to TypeScript as incidental cleanup.
- Preserve the current target framework unless an approved change requires migration. Before proposing a framework upgrade, verify the supported .NET lifecycle and installed SDK from current authoritative sources.
- Keep ASP.NET Core entry points thin and use the built-in DI/configuration system at the composition root. Propagate cancellation through I/O, use async APIs, and never block async work with `.Result` or `.Wait()`.
- Return machine-readable API errors using Problem Details (RFC 9457); use ASP.NET Core's built-in Problem Details support where it fits the current app. Order middleware according to the features enabled and the framework guidance.

## Implementation sequence
1. **Classify** request: data configuration vs source change; identify owning bounded module.
2. **Trace** requirements to `PRD` FR IDs, `SPEC` rules and acceptance ID; flag conflicts.
3. **Design** API/OpenAPI contract, auth/resource policy, domain state, persistence/concurrency, SignalR invalidation and UI states.
4. **Plan** file changes and migration; review open product decisions and security risks.
5. **Test first** invariant, policy and concurrency cases; build one vertical slice backend→generated client→React UI, following the current frontend language and project boundaries.
6. **Review** privacy, resilience, accessibility, print and realtime reconnect where relevant.
7. **Verify** executable tests and record exact commands/outcomes; include rollout and rollback impacts.

## Hard requirements
- All queue number allocation and call-next are atomic in PostgreSQL transactions; same-key retries are idempotent.
- API authorization is role+resource-based; no trust in hidden UI controls.
- React never assigns canonical numbers or statuses; EF domain constraints and state machine control them.
- SignalR notifies after commit and never substitutes for snapshot read; displays resync on reconnection.
- Config records dynamic; code-registered templates only. Admin cannot inject scripts/SQL/components.
- Ticket printing reads persisted ticket and versioned preset; canceling print does not cancel issued ticket.
- Public endpoints contain ticket/counter/service only, no patient identifying data.
- Test in PostgreSQL for races, test actual printer for layout, test websocket disconnect.

## Specialized checklists
Read `references/security.md` for all auth/UI/display work; `references/concurrency.md` for ticket/queue operations; `references/review.md` on every PR.

## Output contract
Before implementing: `Requirement IDs | owning module | deployment/project impact | assumptions | files/API/schema | authorization | invariants | tests | risk`. After implementing: `files changed | migrations | tests run (exact results) | unmet acceptance | security/privacy review | deploy/rollback`.

## Example trigger
“Add a new display layout that shows two configured services” → confirm registered safe layout schema, update display profile handling, add contract and rendering, test device scope and reconnect; do not permit arbitrary JS stored in DB.
