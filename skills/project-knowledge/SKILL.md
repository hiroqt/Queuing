---
name: project-knowledge
description: Preserve verified Queuing project knowledge across sessions, use context efficiently, and keep documentation, commits, and pull requests easy for developers and agents to navigate. Apply by default to every repository task.
---

# Project Knowledge and Change Delivery

Apply this skill by default for every task in this repository, even when it is not explicitly invoked. Follow `AGENTS.md` and the project's SDD/spec gates; this skill keeps changes discoverable and does not grant permission to commit, push, publish, or broaden scope.

## Before changing files

- Start with `README.md` and `docs/CODEBASE_MAP.md` as the repository index. Read `docs/STRUCTURE.md` for path or architecture work. For documentation-only changes, read the pages being edited and check their incoming references.
- Load only the relevant approved spec, ADR, API contract, runbook, and skill references for the task; use the root docs as an index instead of rereading every project document on unrelated work.
- Verify claims against the live project files and source. Keep implemented behavior separate from proposed requirements and architecture.
- Identify the documentation affected by the change before editing; do not update unrelated pages or repeat the same instructions in multiple places.

## Persistent project knowledge

Treat the repository as the shared, durable knowledge base. Chat history and an individual agent's private memory are not the source of truth for other contributors.

- Keep current code responsibilities and entry points in `docs/CODEBASE_MAP.md`; paths and growth rules in `docs/STRUCTURE.md`; approved product behavior in `docs/specs/`; architecture decisions in `docs/adr/`; operational procedures in `docs/runbooks/`.
- Record durable decisions with status, date, rationale, and evidence in the existing spec or ADR. Keep proposed assumptions visibly proposed. Do not store transcripts, secrets, personal data, or unverified guesses as project knowledge.
- When a prior decision or implementation fact is not in the repository, verify the current code/history or mark it unknown. Never invent continuity from a remembered conversation. Documentation and memory do not grant fresh authorization.
- Cite the file/path or executed evidence behind important implementation claims. If evidence is missing, say so instead of filling gaps with a plausible story.
- For efficient context use, follow progressive disclosure: index first, task-specific source/spec next, and detailed references only when triggered. Prefer targeted searches and concise evidence pointers over loading or copying whole documents.
- At handoff, leave the next contributor a compact status: what changed, verified facts, relevant decisions, open questions, and the next action. Persist reusable facts in the appropriate repo docs, not session transcripts.

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
