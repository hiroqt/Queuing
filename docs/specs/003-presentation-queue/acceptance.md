# ACCEPTANCE-003 — Presentation queue dashboard

**Status:** Core behavior and browser flow verified; host restart and physical printing remain unverified | **Spec:** [SPEC-003](spec.md)

| ID | Given / when | Then | Proof |
|---|---|---|---|
| AC-01 | Dashboard loads | Service choices come from the API; loading and API failure states are understandable | Browser E2E |
| AC-02 | Operator issues a ticket for each supported service | API returns a canonical ticket with globally increasing, zero-padded number; UI shows that exact ticket | Core unit + browser E2E |
| AC-03 | An issue request is retried with the same idempotency key and service | The same ticket is returned without incrementing sequence | Core unit |
| AC-04 | An idempotency key is reused with another service | API returns conflict and does not create another ticket | Core unit/API verification |
| AC-05 | Unknown service is submitted | API rejects it and queue state is unchanged | Core unit/API verification |
| AC-06 | More than three waiting tickets exist | Display lists the first three in issue order before the now-calling section | Core unit + browser E2E |
| AC-07 | No tickets have been called | Now-calling section shows an empty state; no call action is offered | Browser E2E |
| AC-08 | A ticket is issued | Only anonymous ticket fields appear in the public display; the confirmation invokes browser print | Browser E2E + source review |
| AC-09 | Concurrent issue calls arrive in one API process | Returned sequence values are unique and monotonically assigned | Core concurrency unit |
| AC-10 | A fresh queue store is created | Demo state starts empty and numbering begins again; docs/UI disclose that limitation | Fresh-store unit + docs review; actual host restart not exercised |

## Recorded verification — 2026-10-19

- .NET SDK 10.0.402: solution build succeeded with 0 warnings/errors; core tests passed 6/6.
- Frontend: `npm run test` passed 3/3; `npm run lint` and `npm run build` passed.
- Playwright: `npm run test:e2e` passed 2/2 with the API and Vite servers running. Covered issue/display flow, first three waiting tickets and order, empty calling section, print-button invocation, exact anonymous response fields, unknown-service 400, same-key replay, key/service conflict 409, keyboard focus and brand accessible name, reduced motion, and no horizontal overflow at 320, 390, 768, 1120, and 1440 px.
- The shared muted text color measures 4.89:1 against the page canvas by relative-luminance calculation. This covers that color pair only and is not a full contrast or WCAG assessment.
- Rendered screens were captured and visually inspected at 1440 px (empty queue) and 390 px (empty queue and issued receipt); the combined layout and receipt remained legible and ordered as intended.
- `git diff --check` passed.
- Not verified: actual browser print dialog or printer hardware, restart of a running API process, full WCAG criteria, or assistive-technology behavior. The frontend accessibility report linked from the code map covers the prior routes, not this dashboard.
