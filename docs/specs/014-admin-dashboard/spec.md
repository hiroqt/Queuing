# SPEC-014 — Admin dashboard

**Status:** Approved for local implementation | **Date:** 2026-10-27 | **Scope:** Admin overview and live queue counts

## User problem

Admins currently land on Departments and must open individual sections to understand clinic setup. They also have no Admin view of current queue volume. Provide one overview as the `/admin` index without exposing ticket-level or patient data.

## Approved decisions

- `/admin` opens a Dashboard; existing section routes remain stable and directly navigable.
- Dashboard links lead to Departments, Services, Stations, Users & access, Displays, and Kiosks.
- Show each section's total and active/inactive configuration counts where applicable.
- Show live queue activity as pending and called counts, overall and by Department. Do not return ticket codes, visit IDs, names, appointments, references, or other visit details.
- Fetch setup counts/checks on initial load and Admin-triggered refresh only; cache them in API memory for up to one minute. The 15-second poll refreshes only live queue activity, Department labels, and active display counts. An Admin-triggered refresh bypasses the setup cache. Show update times and understandable loading/error states.
- Replace an aborted initial request immediately rather than waiting for the next poll. Bound dashboard requests to 10 seconds; show a friendly error and Retry when an initial load times out, while preserving the last successful data if a later refresh times out.
- Show actionable setup checks for active Departments with no active Services and active Stations with no active assigned Staff. Link each check to its section.
- Use the existing green Admin visual system and responsive layout.
- Match the heading font sizes and weights used by the other Admin pages. Use plain-language labels and explain where each card leads.
- Use a single Admin-authorized summary endpoint, including the existing Development + loopback local Admin setup behavior. No database migration or queue mutation is introduced.

## Authorization and privacy

- `GET /api/v1/admin/dashboard` requires the existing Admin policy. Local setup access applies only through the current API loopback/Development gate.
- The aggregate endpoint returns configuration counts and queue counts only. It does not expose the ticket-level queue projection used by Staff or Displays.
- Admin navigation remains protected by the existing frontend Admin role guard. UI visibility is not an authorization boundary.

## Acceptance criteria

1. Opening `/admin` renders the Dashboard; browser refresh at `/admin` works and the Dashboard link is active.
2. Each of the six configuration summaries displays counts from persisted API data and links to its existing Admin section.
3. The Dashboard shows pending and called counts overall and per Department, including Departments with no current queue, without returning ticket or visit details.
4. Queue activity, Department labels, and active display counts reload on entry and every 15 seconds. Setup counts/checks are fetched on entry and explicit refresh only, served from a one-minute API memory cache; selecting Refresh recomputes and replaces that cache. A failed refresh preserves the last successful values and shows a concise error.
5. Setup checks identify active Departments without active Services and active Stations without active assigned Staff; each links to the relevant section. Empty setup checks are clearly reported.
6. Anonymous/non-Admin requests are rejected outside the existing local setup exception. No queue state, ordering, command, numbering, or database schema changes.
7. A delayed initial request resolves after the development mount/remount cycle without waiting for the 15-second poll. A request that does not resolve within 10 seconds exits loading and shows a friendly retry path.

## Verification boundary

The endpoint authorization and response shape require API verification; the polling, route, links, loading/error behavior, and responsive presentation require the existing frontend workflow. Queue and display values are point-in-time aggregates; cached setup values can be up to one minute old until manually refreshed.
