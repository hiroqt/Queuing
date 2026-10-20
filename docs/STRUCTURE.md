# Repository Structure

This file distinguishes the **current checkout** from the **proposed growth path**. The source tree below reflects the current repository; later stages are guidance, not folders to create in advance.

## Current checkout

```text
Queuing/
├── AGENTS.md, README.md, PRD.md, ARD.md, SDD.md, SKILLS.md
├── Queuing.slnx
├── backend/
│   ├── Queuing.Api/       # C# ASP.NET Core API, Identity, EF Core/MySQL persistence
│   │   ├── Auth/          # Bootstrap, claims and department scope
│   │   ├── Controllers/   # Auth, admin configuration, visits, queues, displays
│   │   ├── Data/          # DbContext, design-time factory, health check, migrations
│   │   ├── Hubs/          # Read-only scoped SignalR notifications
│   │   └── Services/      # Persisted outbox dispatcher
│   ├── Queuing.Core/      # VB.NET queue transition and eligibility rules; legacy demo store
│   └── Queuing.Core.Tests/ # C# xUnit tests for the VB.NET core rules
├── frontend/
│   ├── package.json       # React + JavaScript + Vite scripts
│   ├── playwright.config.js
│   ├── src/
│   │   ├── App.jsx        # shared shell and frontend routes
│   │   ├── api/           # Central versioned HTTP API client
│   │   ├── auth/          # Login, session, password-change and route guards
│   │   └── features/      # Admin, Reception, Department Staff, Display pairing/view
│   └── tests/             # Node API/role unit tests and Playwright E2E
├── docs/                  # code map, specs, ADRs, decisions, templates, runbooks
└── skills/
    ├── project-knowledge/   # default shared knowledge, docs and delivery guidance
    ├── clinic-queue/         # queue-specific implementation and review guidance
    └── render/               # frontend design workflow and progressive references
```

The projects target .NET 10. The earlier SPEC-003/SPEC-004 in-memory presentation slices are retained as historical specifications/core tests; their old API routes were removed when SPEC-005 took over the application API.

SPEC-005 is implemented in the existing API and React app: persistent MySQL-backed visits and dynamic departments/users/displays. The initial schema and timestamp-precision migrations, one-time admin bootstrap, and covered MySQL 8.4 API/browser workflow have passed locally. Date rollover, concurrent issue/forward races, recovery, and production readiness remain unverified. `docs/adr/0002-mysql-and-forwarding-visits.md` supersedes ADR-0001's proposed PostgreSQL choice for this slice.

## Growth path

Keep the root `frontend/`, `backend/`, and solution layout. Add structure only alongside the first approved implementation of each capability:

1. **Frontend:** keep each capability in `features/<capability>/`, shared versioned HTTP calls in `src/api/`, and auth state/route guards in `src/auth/`. Keep JavaScript; TypeScript is a separately approved migration.
2. **Backend:** keep HTTP endpoints and persistence in the current API project until a concrete dependency boundary justifies another project. Keep workflow rules independent from ASP.NET Core and EF. Preserve the VB.NET core unless an approved migration changes it.
3. **Tests:** keep core rules in the existing test project; add a separate integration project only when its database/container lifecycle requires it. Exercise database-specific invariants against MySQL 8.x for SPEC-005.
4. **Deployment:** add deployment files only after a deployment target and operational requirements are approved.

## Proposed capability map

These are product areas, not required directories today: Identity/Access, Configuration, Queuing, Ticketing, Displays, and Audit. Keep one deployable modular monolith. Separate projects or services only when compile-time boundaries, team ownership, operational scaling, or measured performance provide a concrete benefit. Document architectural changes in an ADR and update the approved feature spec first.
