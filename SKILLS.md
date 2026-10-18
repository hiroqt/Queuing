# SKILLS.md — Skill Catalog and Activation

This is the **skill index**, not a replacement for the actionable `SKILL.md` file. `AGENTS.md` requires agents to load `skills/clinic-queue/SKILL.md` for relevant work.

| Skill | Location | Activate when |
|---|---|---|
| change-documentation | `skills/change-documentation/SKILL.md` | **Always; every repository task**, plus commit and PR preparation |
| clinic-queue | `skills/clinic-queue/SKILL.md` | Changes to admin/staff screens, config, ticket issuance/printing, queue engine, display, SignalR, auth or related tests |

## Skill precedence
System/developer instructions → `AGENTS.md` → accepted PRD/ARD/ADRs → approved feature specs → skill procedure → local coding conventions. A skill may refine implementation but must never override scope or security.

## Adding skills later
Create a distinct skill only for a recurring specialty with testable entry/exit criteria, e.g. regulated printing hardware. Include trigger, references, forbidden work, validation and examples. Do not proliferate skills per component or use them as hidden permission to introduce features.

## How to install for tools
- Keep repo-global `AGENTS.md` for compatible coding agents.
- This repository stores the skill under `skills/` because root `.agents/` is read-only in this workspace. `AGENTS.md` explicitly routes agents to it.
- Do not presume all coding agents automatically load `SKILLS.md` or skills; verify the agent actually read the files.
