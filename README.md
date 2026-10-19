# Queuing

This repository contains an early application starter and a proposed clinic-queue MVP specification. The specification describes the intended product; it is not evidence that those features or services are implemented.

## Current code

- Frontend: React + JavaScript + Vite in `frontend/`.
- API: C# ASP.NET Core in `backend/Queuing.Api/`.
- Core library: VB.NET in `backend/Queuing.Core/`.
- Solution: `Queuing.slnx`.

Keep this small structure until real features require more boundaries. The target React/TypeScript architecture in `ARD.md` is a proposal; language or framework migrations require an approved spec.

## Repository guide

- `AGENTS.md` — required instructions for coding agents.
- `PRD.md`, `ARD.md`, `SDD.md` — proposed product, architecture, and development workflow.
- `docs/STRUCTURE.md` — current tree and phased growth plan.
- `docs/CODEBASE_MAP.md` — live source responsibilities and current gaps.
- `docs/specs/` — feature specs and acceptance criteria.
- `docs/specs/002-frontend-mvp-demo/` — approved frontend-only preview scope and acceptance checks; sample controls do not issue backend commands.
- `skills/project-knowledge/SKILL.md` — default persistent-knowledge, documentation, and commit/PR guidance for all agents.
- `skills/clinic-queue/SKILL.md` — specialist implementation and review guidance.
- `skills/render/SKILL.md` — frontend design and implementation guidance; sourced from [hiroqt/overdrive](https://github.com/hiroqt/overdrive) at commit `1686bca01365d76f8e25cfb7a0ee7ccb7920e76e` (MIT; license included).

## Local commands

From the repository root:

```sh
dotnet build Queuing.slnx
```

For the frontend, run `npm ci` once from `frontend/`, then use `npm run dev`, `npm run test`, `npm run test:e2e`, `npm run lint`, or `npm run build` there. Install Playwright Chromium in a fresh environment with `npx playwright install chromium` before E2E tests.

## Read order

1. `AGENTS.md` — mandatory agent guidance and scope boundaries.
2. `PRD.md` and `ARD.md` — proposed requirements and architecture.
3. `docs/OPEN_DECISIONS.md` and the relevant files under `docs/specs/`.
4. `skills/clinic-queue/SKILL.md` for relevant queue/auth/display/printing work.
5. `skills/render/SKILL.md` for frontend/UI work, with only the relevant references loaded as needed.
6. `SDD.md` and `docs/adr/` for workflow and decisions.

## Status

The queue MVP remains a proposal. Follow `docs/specs/001-mvp/tasks.md` only after the relevant scope is approved, and verify the live code before claiming implementation or test coverage.
