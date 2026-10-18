# Repository Structure

This file distinguishes the **current checkout** from the **proposed growth path**. The source tree below reflects the current repository; later stages are guidance, not folders to create in advance.

## Current checkout

```text
Queuing/
├── AGENTS.md, README.md, PRD.md, ARD.md, SDD.md, SKILLS.md
├── Queuing.slnx
├── backend/
│   ├── Queuing.Api/       # C# ASP.NET Core host and controllers
│   └── Queuing.Core/      # VB.NET class library, currently a stub
├── frontend/
│   ├── package.json       # React + JavaScript + Vite scripts
│   ├── playwright.config.js
│   ├── src/
│   │   ├── App.jsx        # shared shell and frontend routes
│   │   ├── data/          # synthetic demo snapshot
│   │   └── features/      # admin, staff, ticket, public display views
│   └── tests/             # Node unit tests and Playwright E2E
├── docs/                  # code map, specs, ADRs, decisions, templates, runbooks
└── skills/
    ├── project-knowledge/   # default shared knowledge, docs and delivery guidance
    ├── clinic-queue/         # queue-specific implementation and review guidance
    └── render/               # frontend design workflow and progressive references
```

The API and core projects currently target .NET 10. The frontend now contains a frontend-only queue MVP preview; it does not implement the backend workflows described by the product proposal. Do not infer backend modules, migrations, or production services from the design documents.

## Growth path

Keep the root `frontend/`, `backend/`, and solution layout. Add structure only alongside the first approved implementation of each capability:

1. **Frontend:** when multiple screens/features exist, group code by feature (`features/<capability>/`) and keep genuinely shared UI/API utilities in `shared/`. Add app-level routing/providers only when needed. Keep JavaScript now; a move to TypeScript is a separately approved migration.
2. **Backend:** keep HTTP endpoints thin. Put each first use case near its owning feature within the existing projects. Keep domain rules independent from ASP.NET Core and persistence. Add an Infrastructure project only when persistence or other infrastructure is introduced and needs a real dependency boundary. Preserve the current VB.NET core unless an approved migration changes it.
3. **Tests:** create one focused test project when meaningful behavior is added. Split unit, integration, concurrency, or architecture suites only when their dependencies or execution needs justify separate projects. Exercise PostgreSQL-specific invariants against PostgreSQL.
4. **Deployment:** add deployment files only after a deployment target and operational requirements are approved.

## Proposed capability map

These are product areas, not required directories today: Identity/Access, Configuration, Queuing, Ticketing, Displays, and Audit. Keep one deployable modular monolith. Separate projects or services only when compile-time boundaries, team ownership, operational scaling, or measured performance provide a concrete benefit. Document architectural changes in an ADR and update the approved feature spec first.
