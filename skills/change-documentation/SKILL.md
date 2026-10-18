---
name: change-documentation
description: Keep the Queuing repository easy to navigate for developers and agents. Apply by default to every repository task; also use when preparing commits or pull requests.
---

# Change Documentation and Delivery

Apply this skill by default for every task in this repository, even when it is not explicitly invoked. Follow `AGENTS.md` and the project's SDD/spec gates; this skill keeps changes discoverable and does not grant permission to commit, push, publish, or broaden scope.

## Before changing files

- Read `README.md`, `docs/STRUCTURE.md`, and `docs/CODEBASE_MAP.md` when the task touches code or repository structure. For a documentation-only change, read the pages being edited and check their incoming references.
- Verify claims against the live project files and source. Keep implemented behavior separate from proposed requirements and architecture.
- Identify the documentation affected by the change before editing; do not update unrelated pages or repeat the same instructions in multiple places.

## Keep navigation current

After every change, ask whether the change affects a developer's understanding of the repository:

- Update `docs/CODEBASE_MAP.md` when a meaningful source file, module responsibility, API entry point, or source dependency changes.
- Update `docs/STRUCTURE.md` when directories, project boundaries, or the growth path changes.
- Update `README.md` when setup, common commands, project status, or the main navigation changes.
- Update PRD/specs for product behavior or acceptance changes; update ARD/ADR for architecture or contract decisions; update runbooks for operational steps.
- Keep maps shallow and factual. Avoid speculative folders, duplicated API documentation, generated inventories that cannot be maintained, timestamp-only edits, and claims unsupported by source or executed checks.
- If no documentation needs to change, leave it untouched and mention that in the handoff only when useful.

## Commit messages

Only prepare or create a commit when the user asks or repository workflow explicitly requires it. Use a concise Conventional Commit header:

```text
<type>(<scope>): <imperative summary>
```

Use a short body to explain why when the header is not enough. For documentation or structure work, name the navigation or maintenance outcome. Reference an issue only when a real issue ID was supplied or verified; never invent one. Keep one reviewable concern per commit. Stage only task-related files and preserve unrelated user changes. Do not add agent attribution unless repository policy explicitly requires a verified identity.

## Pull requests

Only create or publish a PR when explicitly requested. When drafting a PR, include:

1. **Summary:** what changed and why, with a shallow file tree or diff sketch for structure changes.
2. **Documentation:** which navigation, architecture, or user-facing docs changed and how they guide the next developer.
3. **Verification:** exact commands and outcomes; label checks not run or unavailable.
4. **Risk and rollout:** compatibility, migration, or rollback details when relevant; otherwise say there is no runtime impact for docs-only changes.

Keep the description concise and specific to this diff. Do not claim tests, review, issue closure, or deployment that did not happen. A prepared PR body is not authorization to publish it.

## Handoff

Report changed files, documentation impact, exact checks, and any remaining gaps. For folder or project changes, summarize the old-to-new path mapping so other contributors can find moved responsibilities.
