# AGENTS.md — Repository Governance for Coding Agents

## Mission
Build and maintain a **basic clinic queue** toward the proposed React/TypeScript and ASP.NET Core architecture, starting with four capabilities: admin, staff, ticket issuance/printing, and public displays. Prefer simple, testable code that remains maintainable across years. The proposal is not evidence of the current stack: inspect the live solution first. The current checkout uses a C# ASP.NET Core API, a VB.NET core library, and a React JavaScript frontend. Preserve those project and language choices unless an approved spec authorizes a migration. This file applies to the whole repository; any child `AGENTS.md` may add stricter local rules, never relax security or scope.

## Required context before making changes
1. **Always load `skills/project-knowledge/SKILL.md` for every repository task**, whether or not the user invokes it by name.
2. Start with `README.md` and `docs/CODEBASE_MAP.md`; read `docs/STRUCTURE.md` for layout/architecture work.
3. For behavior changes, read the relevant PRD/ARD/SDD sections, open decisions, and the approved feature spec; do not load unrelated specs or references.
4. For queue/auth/display/printing/configuration work, load `skills/clinic-queue/SKILL.md` and only the relevant referenced checklists.
5. For frontend/UI design, implementation, or review, load `skills/render/SKILL.md` and only its relevant references. Follow the design-choice gate there for a coherent existing UI; preserve the current React/JavaScript stack and clinic-queue security and scope boundaries.
6. Examine actual code, manifests, tests, migrations and API contracts. Docs may describe desired, not current, state.

## Mandatory SDD protocol
**Specify → challenge assumptions → plan → contract/test design → implement one vertical slice → verify → review → document.** For substantive scope, permissions, schema, printing or workflow changes, do not implement without an approved spec and plan. When no reviewer is available, document assumptions/blocks and perform only safe in-scope scaffolding. Never mark work tested if a tool was unavailable.

## Non-negotiable architectural boundaries
- React is presentation and interaction; it must not determine queue order, counters' authority or ticket numbering.
- ASP.NET Core API is the only trusted command entry point; all permissions and invariants enforced server-side.
- Modules own their use cases and data access; do not import another module's DbContext or entities directly. Use explicit contracts.
- Domain has no references to ASP.NET Core, EF Core, SignalR or presentation libraries.
- API controllers are thin: authenticate, validate contract, invoke use case, map responses.
- Prefer feature folders/vertical slices *inside* a modular monolith. Do not add microservices, generic repositories, message brokers or Redis without measured need.
- Use PostgreSQL transactions/constraints for ticket sequencing, atomic call-next and state changes; no in-memory counters as source of truth.
- `docs/specs/003-presentation-queue/` explicitly permits process-local in-memory state for a localhost presentation demo only. This exception is not durable queue authority and must not be extended to clinic operations or production.
- Persist first, publish realtime changes after commit via outbox/dispatcher. SignalR is a notification mechanism, not the record of truth. Clients refresh snapshot on reconnect.
- Configuration of service/counter/screen/template is data-driven; executable modules and layouts come from a controlled code registry.

## MVP scope fence
Allowed: admin config of staff roles, services, counters, queue numbering, printer ticket formats, display registration/assignment and templates; staff issuance/call/recall/skip/complete; printable ticket; read-only public queue display; minimum auth/audit/ops plumbing.
Disallowed until new approved spec: health records, patient PHI, appointments, payments, priority classes beyond explicitly approved policies, kiosks, SMS, push notifications, voice announcements, independent branches/multitenancy, offline issuing, dynamic code plugins.

## Coding and maintainability
- C#: nullable enabled, async cancellation tokens, clear names, small methods, explicit result/error types, DI, options validation, bounded DbContext lifetimes; never block async (`.Result`/`.Wait`).
- TypeScript: strict, typed API contracts generated from OpenAPI, TanStack Query for server data, React Router, accessible forms, avoid duplicated server state and business logic.
- Apply language guidance only to the project being changed. Current source is C# ASP.NET Core API + VB.NET core library + React JavaScript; do not migrate languages as incidental cleanup.
- Dependency direction: Web/API → Application → Domain; Infrastructure implements ports and is registered at composition root.
- Keep the current modular monolith as one deployment. Start with feature folders inside existing projects; add projects, layers, services, or shared infrastructure only when a real dependency, ownership, scaling, or testing need justifies them. Do not create empty folders to match the future-state diagram in `docs/STRUCTURE.md`.
- Design idempotent mutation APIs and deterministic error statuses; use UTC instants and clinic timezone for display/session boundaries; use stable IDs rather than human labels.
- Database: migrations are reviewable and backward-compatible where possible, with FK/check/unique indexes; no destructive migration without a rehearsed recovery plan.
- No hardcoded departments, counters, prefixes, screen IDs, user IDs, private URL secrets, or production credentials.
- No speculative abstractions or copy-paste feature forks; share small primitives, not god-services.

## Security and patient privacy
- Secure HttpOnly cookies on same-origin production deployment; CSRF protection for cookie-authenticated mutations; TLS; controlled CORS in development; never put session secrets in localStorage.
- Identity + policy/resource-based authorization: staff must be assigned to the counter they operate; admin operations require admin policy. UI role checks are cosmetic only.
- Least data to public screens: anonymous queue number, counter/service, status only. No patient names or clinical information.
- Validation on API and DB; parametrized EF queries; output encoding; no dangerouslySetInnerHTML for config text; sanitize branding inputs.
- Redact PII/credentials from logs; audit privileged/config and queue mutations with actor, time, target and correlation ID; no raw password logging.
- Screen pairing must use controlled enrollment and scoped revocable credentials; a public screen endpoint must never expose admin/staff records. Rate-limit sensitive endpoints.

## Reliability invariants
1. A session-scoped `(service_id, queue_session_id, sequence)` is unique.
2. One ticket can have at most one active call/assignment at a time.
3. `Waiting → Called → Completed` and `Called → Skipped` plus approved recall transitions only; no arbitrary client-supplied status updates.
4. Retry/double-click with same idempotency key cannot create a second ticket or repeat a transition.
5. Rendered receipt always matches the persisted ticket; reprint is labelled and audited.
6. Queue displays rehydrate from server snapshots on load/reconnect and show disconnection state.
7. Audit trail records change who/what/when, never silently overwrites history.

## Tests required per changed capability
- Domain transition and numbering tests; integration DB tests against real PostgreSQL (prefer Testcontainers); concurrent call-next; retry/idempotency; authorization matrix; API contract tests; React component + accessibility tests; display SignalR reconnect; printing 58/80mm preview; end-to-end happy path; migration and restore smoke tests.
- Run only checks configured in the current projects. `dotnet test Queuing.slnx` covers the demo queue core; it is not PostgreSQL integration coverage. The frontend exposes `test` (Node API-client unit tests), `test:e2e` (Playwright starts the API and Vite locally), `lint`, and `build`, but no typecheck script. Do not report unavailable commands as passing.
- Record exact commands/results and distinguish current checks from future acceptance requirements.

## Work format
Before coding: **scope, acceptance criteria, touched modules/files, data/API impacts, risks, test plan, open decisions**.
After coding: **changed files, migrations, security assessment, executed tests and outcome, untested areas, deployment/rollback notes, docs updated**.

## Stop-and-escalate conditions
Stop implementation and write a decision request when: specification conflicts with existing policy; unknown queue reset/prioritization/skip semantics; irreversible schema change; silent printer requirements; unauthenticated display design; new sensitive data; unapproved new module; cross-module dependency cycle.

## Definition of done
Acceptance criteria passed; backend enforcement verified; concurrency/retry cases covered; security and privacy reviewed; database and client contracts updated; docs and changelog amended; operational rollback noted; no unfounded success claims.
