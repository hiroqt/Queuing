# SPEC-013 Acceptance

| Acceptance | Evidence | Status |
|---|---|---|
| Explicit lookup type; code `1000` remains a visit code | API client unit test sends explicit type and body; MySQL workflow checks code `1000` is accepted as a search | Frontend passed; MySQL pending |
| Duplicate reference matches require a user choice | Mocked Reception workflow presents two visits and loads the selected receipt | Passed in mocked browser workflow |
| Editing criteria clears old candidates and stale requests cannot replace current results | Mocked browser workflow checks changed reference/date remove candidates and a delayed earlier search cannot replace the newer result | Passed in mocked browser workflow |
| Reference values stay out of URLs, response DTOs, receipts, and audit details | API client and mocked UI assertions; API code projects only summary/receipt fields and audits visit IDs | Frontend passed; live API/MySQL pending |
| Receipt searches and selected receipts are non-cacheable and Reception-authorized | Controller sets `Cache-Control: no-store` and keeps Reception policy; opt-in workflow asserts cache headers | Source reviewed; MySQL/API pending |
| Manual 58 mm printing only | UI removes auto-print and 80 mm controls; mocked browser confirms issue does not print and manual action does | Passed in mocked browser workflow |
| Ordinary API startup does not apply migrations; explicit operation does | `Program.cs` runs migrations only for `--bootstrap-admin` or `--apply-migrations`; solution build | Passed by source review/build; live migration smoke pending |
| Existing visit records and reference values are preserved | Existing migration is unchanged and no data cleanup migration was added | Passed by diff review |

## Executed checks

- `npm test` — 10 passed.
- `npm run lint` — passed.
- `npm run build` — passed.
- `npm run test:e2e -- --config=playwright.mocked.config.js tests/e2e/clinic-authenticated-workflows.spec.js` — 12 passed. The temporary test config used Vite port 4174 because the default API port was occupied; the mocked workflow did not require the API.
- `NUGET_PACKAGES=/Users/arnel/.nuget/packages dotnet build Queuing.slnx --no-restore --disable-build-servers -m:1 -p:UseSharedCompilation=false` — passed, 0 warnings/errors.
- `NUGET_PACKAGES=/Users/arnel/.nuget/packages dotnet test Queuing.slnx --no-restore --disable-build-servers -m:1 -p:UseSharedCompilation=false` — 40 passed (22 API, 18 Core).
- `git diff --check` — passed.

## Verification boundary

The opt-in MySQL/API/browser test was not run. The configured local connection points to `queuing_dev`, which is not a safe test target, and Docker is unavailable. No data was changed in MySQL. The API's MySQL query translation, migration command against a disposable database, and existing ReferenceId contents remain unverified.
