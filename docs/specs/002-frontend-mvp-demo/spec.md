# SPEC-002 — Frontend MVP Demo

**Status:** Approved for frontend-only demonstration | **Date:** 2026-10-18 | **Parent:** PRD-CQ-001 / ARD-CQ-001 | **Scope:** Admin, staff, ticket issue, and public display screens in the React app.

## Goal

Give clinic staff and stakeholders a readable, navigable preview of the proposed queue MVP without configuring or changing the API, database, authentication, or any backend service.

## Users and primary jobs

- **Admin:** review illustrative service, counter, and display configuration surfaces.
- **Staff:** scan the active queue and the controls for issuing and managing tickets.
- **Reception:** review a ticket issue and print-preview surface without creating a canonical ticket.
- **Public display:** see an anonymous, illustrative called-ticket snapshot.

## Behavior and boundaries

- Provide four directly navigable frontend views: Admin, Staff desk, Issue ticket, and Public display.
- Use synthetic fixtures isolated from UI components. Label the app and data as a demo; show a clear notice that commands and configuration are not saved or sent.
- Do not call the API, persist data, assign canonical ticket numbers, mutate queue status, enforce permissions, or claim the display is live. UI actions may show explanatory demo feedback only.
- Keep public display content limited to synthetic anonymous ticket number, service, counter label, and sample status. Do not include names, staff identity, or clinical information.
- Queue reset, skip/requeue, service, and numbering policies remain unresolved per `docs/OPEN_DECISIONS.md`; sample content must not present those choices as settled policy.
- Preserve the current React + JavaScript + Vite stack and use the already-installed React Router. Do not touch backend projects or contracts.

## Design brief

- **Surface mode:** operate. Staff desk is the primary route, with the other three MVP capabilities one navigation step away.
- **Direction:** a quiet clinic operations workspace: warm neutral canvas, deep evergreen navigation, ink-colored text, and one restrained amber signal for the active call. Use compact tabular data and strong type hierarchy rather than a marketing hero or a grid of metric cards.
- **Distinctive cue:** a narrow perforation/index rule alongside the current ticket, echoing a paper queue ticket while keeping the layout digital and restrained.
- **Responsive behavior:** keep the four routes reachable on narrow screens; allow data tables to reflow into labeled rows or scroll within their own region without page overflow.
- **Relevant UX concepts:** Fitts's Law informs the frequent staff action hit area; Hick's Law informs the four clearly named destinations; Proximity groups labels with values and errors. Counter-risks: emphasis must not imply an action succeeded, nav must not hide capabilities, and visual grouping must remain semantic.
- **Accessibility:** native links, buttons, and labeled inputs; visible focus; keyboard navigation; non-color status labels; reduced-motion support.

## Data and runtime

No data/API contract changes. Fixtures are local preview content only; a future approved integration must replace them with server snapshots and authenticated commands. Server-side authorization, ticket sequencing, transitions, and public-display data minimization remain authoritative.

## Acceptance

See [`acceptance.md`](acceptance.md). The test seam is the pure queue view-model projection; Playwright verifies route navigation and user-visible boundary messaging in the running browser.
