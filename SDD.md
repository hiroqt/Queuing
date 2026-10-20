# SDD — Specification-Driven Development Contract

**Version:** 0.1 | **Applies to:** every feature, bug fix affecting behavior, data migration and module expansion.

## Artifact hierarchy
`PRD.md` (approved product bounds) → `ARD.md` and ADRs (approved architecture) → `docs/specs/NNN-feature/spec.md` (behavior) → `plan.md` (design) → `tasks.md` (atomic tasks) → `acceptance.md` (verifiable proof) → implementation, tests, and deployment record.

## Stage 0 — Intake / change classification
Classify change as **configuration only**, **existing feature bug**, **new feature**, **architecture/data contract change**, or **incident**. Configuration does not need code; any behavior/schema/interface change needs an updated specification. Link changes to PRD requirement IDs.

## Stage 1 — Specify (no code)
Write actor, trigger, permissions, inputs, outputs, invariants, happy/alternate/error flows, UI states, data effects, notifications, audit, non-goals and measurable acceptance. Record open choices, especially queue reset and skip semantics. Explicitly mark `Status: Proposed` until reviewed.

## Stage 2 — Architecture impact / plan
Identify owning bounded module, dependencies, API/OpenAPI changes, DB schema+migration, frontend routes/components, SignalR event implications, printing, privacy, availability, rollback, feature flag (only if needed). Draft ADR for major architectural decisions. Prefer the simplest consistent solution.

## Stage 3 — Tests before implementation
Write domain/authorization/concurrency/idempotency/unit/integration/e2e acceptance tests from spec and generate typed contracts. Capture red/expected failure where feasible. Don't weaken tests to match incorrect implementation.

## Stage 4 — Implement vertical slices
Implement one observable outcome end-to-end, e.g. create service configuration → API → admin form → tests. Backend domain owns policy; UI sends intention and renders states. Use reviewed migration and clear API errors. Check modules for dependency cycles.

## Stage 5 — Verify and security review
Required gates: backend build and test, MySQL 8.x integration/concurrency tests for SPEC-005, frontend lint/tests/build, role/ownership matrix, API contract check, real-time resync, print preview/printer profile test if touched, SAST/dependency checks where available. Note tests not executed. Fix before signoff.

## Stage 6 — Release / feedback
Review code; take backup; stage migration and run smoke tests; deploy with monitoring/rollback; record implementation links and results; update user docs, ADRs, runbooks and spec status. Keep acceptance history; never retrospectively declare unverified behavior working.

## Agent prompt template
`Implement [spec path], only approved tasks [IDs]. First summarize touched files, invariants, API/DB impacts, authorization and tests. Do not add scope. After changes report actual commands/results, migration/rollback details, remaining risks.`

## Specification templates
Use `docs/templates/spec-template.md` and `docs/templates/adr-template.md`. A future capability becomes `docs/specs/002-name/` and a PRD/ARD append-only change entry. Never silently edit signed-off MVP semantics.

## Review matrix
Product/clinic owner: workflow/permissions. Tech lead: architecture/API. Security owner: sensitive changes. Operations: backup/printing/display rollout. Approval may be recorded in issue/PR; placeholders do not equal actual signoff.
