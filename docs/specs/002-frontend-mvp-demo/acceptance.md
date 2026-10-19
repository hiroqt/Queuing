# ACCEPTANCE-002 — Frontend MVP Demo

| ID | Given / When / Then | Proof |
|---|---|---|
| AC-01 | App opens and all four named MVP destinations are reachable | Playwright E2E |
| AC-02 | Staff view receives a mixed snapshot; view-model returns only waiting rows in source order | Node unit test |
| AC-03 | Admin configuration, ticket issue, and staff command actions are invoked; each clearly says this preview does not save or send the command | Playwright E2E |
| AC-04 | Public display is opened; it shows only anonymous demo queue fields and identifies the snapshot as sample/not live | Playwright E2E + source review |
| AC-05 | No fetch/XHR or `/api`/`/hubs` request is made while navigating and using demo controls | Playwright E2E |
| AC-06 | At desktop and narrow mobile widths, nav and primary content remain available without horizontal page overflow | Playwright E2E |
| AC-07 | Main controls have semantic names, visible keyboard focus, and status feedback not conveyed by color alone | Playwright E2E + manual browser review |
| AC-08 | Frontend lint and production build pass; no backend files change | lint/build + diff review |

This demo does not satisfy backend or production MVP acceptance cases in `docs/specs/001-mvp/acceptance.md`.
