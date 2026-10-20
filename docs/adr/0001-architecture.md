# ADR-0001: Modular monolith, React and ASP.NET Core

**Status:** Proposed; database choice superseded by ADR-0002 | **Date:** 2026-10-16

## Context
Clinic MVP needs admin configuration, staff operations, ticket print and realtime public displays, with minimal operator overhead and strong queue consistency.

## Decision
One React SPA; one ASP.NET Core Web API organized into bounded modules and internal vertical slices; relational persistence/EF Core; SignalR notifications after committed transaction; code-registered display templates; same-origin HTTPS hosting; cookie auth plus antiforgery protection. The initial draft named PostgreSQL; [ADR-0002](0002-mysql-and-forwarding-visits.md) supersedes that database choice with MySQL 8.x for SPEC-005.

## Alternatives
MVC/Razor: acceptable but not selected given React frontend. Microservices: unnecessary operations and distributed consistency burden. Pure layered god-service: weak module boundaries. Client-side numbering: invalid consistency/security.

## Consequences
Simpler release/debugging, explicit module code discipline, transactional queue engine. Scaling beyond one API instance needs reviewed SignalR topology, shared cryptographic keys/session config, outbox dispatcher coordination and load testing. Track as future ADR rather than implementing now.
