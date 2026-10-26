# ACCEPTANCE-014 — Admin dashboard

**Status:** Implemented; API build, frontend lint/build, and mocked Playwright checks pass. Live API/MySQL verification remains open.

| Requirement | Evidence | Status |
|---|---|---|
| `/admin` opens the Dashboard; existing Admin sections keep direct routes | Authenticated mocked workflow verified the `/admin` redirect, Dashboard entry, and direct section routes (14/14 workflow tests passed) | Passed (mocked browser) |
| Configuration counts and setup checks use server data | API projection and one-minute cache compile; mocked browser rendered the configured summary. Live DB-backed query verification remains open. | Implemented; API/MySQL unverified |
| Queue shows only pending/called counts overall and by Department | Aggregate endpoint projection contains counts only; code review confirms no visit-level response fields. Live API response and authorization verification remain open. | Implemented; API unverified |
| Initial load, 15-second refresh, manual refresh, last-update and error states | Mocked Playwright verified StrictMode recovery, live-only polling, manual configuration refresh, and the 10-second timeout/retry path. | Passed (mocked browser) |
| Shared Admin heading sizes and plain-language dashboard labels/actions | Shared page heading hierarchy, larger linked metric cards, and revised user-facing copy; browser/visual review not run | Implemented; unverified |
| Admin-only route and local setup boundary | Mocked authenticated workflow (14/14) and opt-in local-setup route/role workflow (2/2) passed. Dashboard endpoint API authorization was not exercised. | Passed (frontend routes); API authorization unverified |
| No schema or queue command changes | Diff review; API build passed; no migration was added. | Passed (source/build review) |

Checks run:

- `dotnet build backend/Queuing.Api/Queuing.Api.csproj --no-restore --disable-build-servers -m:1 -p:UseSharedCompilation=false` — passed, zero warnings/errors.
- `npm run lint` and `npm run build` from `frontend/` — passed.
- Authenticated mocked Playwright workflow — 14/14 passed, including Dashboard loading/polling/timeout and Admin section workflows.
- Opt-in local-setup mocked Playwright workflow — 2/2 passed.
- `git diff --check` — passed.

Playwright used a temporary config because the default API port was already occupied; it targeted a separate Vite port and the changed browser workflows mocked API responses. The temporary config was removed. Live MySQL/API query and authorization behavior, plus full visual review, remain unverified.
