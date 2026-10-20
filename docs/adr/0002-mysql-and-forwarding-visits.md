# ADR-0002: MySQL persistence and one forwarded visit

**Status:** Accepted for implementation | **Date:** 2026-10-20 | **Decision owner:** Product owner

## Context

ADR-0001 proposed PostgreSQL, and the running demo uses a volatile in-memory store. The product owner selected a local MySQL 8.x deployment and clarified that a patient receives one stable visit code forwarded between departments, with only one department step active at a time. The clinic's departments are dynamic. Daily patient-facing codes are clinic-wide, not reissued at every department.

## Decision

- Keep one ASP.NET Core modular monolith and the existing React SPA.
- Use MySQL 8.x as the durable source of truth, EF Core 10, database migrations, and transactions/constraints for identity, configuration, visit lifecycle, audit, and outbox.
- Retain the current .NET 10 target and VB.NET core unless an implementation-specific limitation is demonstrated; no incidental language migration.
- Issue one anonymous clinic-wide daily visit code using Asia/Manila date. Forwarding updates that visit's department step without changing the code.
- Persist optional appointment time on each department step. Reception may set the initial step time; staff may set the next step time while forwarding. Eligible appointments run before FIFO walk-ins; future appointments cannot be called early.
- Keep one active department step per visit. Staff selects any active next department when completing the current step; a missed call returns the same step to pending.
- Create displays as dynamic database configuration with one department scope each and revocable pairing credentials.

## Alternatives considered

- PostgreSQL/EF Core as drafted in ADR-0001: rejected for this deployment because the owner selected MySQL.
- A distinct patient-facing ticket number per department: rejected because it conflicts with one forwarded ticket/visit identity.
- In-memory state: rejected because the requested system must retain configuration and visits across restart and coordinate multiple users/screens.
- Microservices, Redis, broker, and separate application projects: not selected; no demonstrated need for the added operations or distributed consistency burden.

## Consequences and safeguards

- Update ADR-0001's PostgreSQL statement and the proposed architecture docs to identify MySQL as the selected database for this feature.
- Exercise sequence allocation, call-next, and forwarding races against MySQL 8.x. EF InMemory or SQLite is not sufficient evidence.
- Provider behavior, migrations, constraints, collation, and locking are database-specific and need tests against the target MySQL version.
- A single API instance is the initial local topology. Outbox dispatch and durable state provide a safe base, but multiple API instances and SignalR scale-out require a later topology decision and verification.
- Local installation needs MySQL backup/restore guidance before any real clinic data is used. Production deployment remains out of scope.

## References

- [SPEC-005 — Forwarding clinic queue](../specs/005-forwarding-clinic-queue/spec.md)
- [PRD-CQ-001](../../PRD.md)
- [ARD-CQ-001](../../ARD.md)
