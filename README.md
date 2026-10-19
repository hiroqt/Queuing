# Queuing

This repository contains a local presentation slice of the clinic queue MVP plus the broader proposed product specification. The demo supports ticket issue and display only; it is not production queue infrastructure.

## Current code

- Frontend: React + JavaScript + Vite in `frontend/`.
- API: C# ASP.NET Core in `backend/Queuing.Api/`.
- Core library: VB.NET in `backend/Queuing.Core/`; currently owns the demo catalog and in-memory queue.
- Solution: `Queuing.slnx`.

The presentation dashboard issues one shared sequence (`001`, `002`, …) across Consultation, Laboratory, and Follow-up. Its public projection shows up to three waiting tickets, followed by an empty calling section. Queue data clears when the API restarts. No sign-in or database is configured; run locally with synthetic data only. Admin setup remains a separate static preview.

Keep this small structure until real features require more boundaries. The target React/TypeScript architecture in `ARD.md` is a proposal; language or framework migrations require an approved spec.

## Repository guide

- `AGENTS.md` — required instructions for coding agents.
- `PRD.md`, `ARD.md`, `SDD.md` — proposed product, architecture, and development workflow.
- `docs/STRUCTURE.md` — current tree and phased growth plan.
- `docs/CODEBASE_MAP.md` — live source responsibilities and current gaps.
- `docs/specs/` — feature specs and acceptance criteria.
- `docs/specs/002-frontend-mvp-demo/` — original frontend-only preview scope.
- `docs/specs/003-presentation-queue/` — approved local backend-connected presentation scope and acceptance criteria.
- `skills/project-knowledge/SKILL.md` — default persistent-knowledge, documentation, and commit/PR guidance for all agents.
- `skills/clinic-queue/SKILL.md` — specialist implementation and review guidance.
- `skills/render/SKILL.md` — frontend design and implementation guidance; sourced from [hiroqt/overdrive](https://github.com/hiroqt/overdrive) at commit `1686bca01365d76f8e25cfb7a0ee7ccb7920e76e` (MIT; license included).

## Local commands

From the repository root:

```sh
dotnet build Queuing.slnx
dotnet test Queuing.slnx
```

Start the API in one terminal from the repository root:

```sh
dotnet run --no-launch-profile --project backend/Queuing.Api/Queuing.Api.csproj --urls http://127.0.0.1:5271
```

In a second terminal, install frontend dependencies once and start Vite:

```sh
npm --prefix frontend ci
npm --prefix frontend run dev -- --host 127.0.0.1
```

The Vite server proxies `/api` to the API. `npm --prefix frontend run test`, `npm --prefix frontend run lint`, and `npm --prefix frontend run build` run frontend checks. `npm --prefix frontend run test:e2e` starts both local servers; install Playwright Chromium with `npx playwright install chromium` in a fresh environment first.

## Read order

1. `AGENTS.md` — mandatory agent guidance and scope boundaries.
2. `PRD.md` and `ARD.md` — proposed requirements and architecture.
3. `docs/OPEN_DECISIONS.md` and the relevant files under `docs/specs/`.
4. `skills/clinic-queue/SKILL.md` for relevant queue/auth/display/printing work.
5. `skills/render/SKILL.md` for frontend/UI work, with only the relevant references loaded as needed.
6. `SDD.md` and `docs/adr/` for workflow and decisions.

## Status

The production MVP remains a proposal. SPEC-003 authorizes only the local presentation slice; its in-memory sequence, anonymous local API, and missing call action must not be treated as clinic-ready behavior. Follow the relevant approved feature spec and verify the live code before claiming implementation or test coverage.
