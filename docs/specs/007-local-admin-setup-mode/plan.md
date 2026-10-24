# Plan — SPEC-007

## Implementation

1. Add a small API access predicate that requires an enabled setting, the Development environment, a loopback remote address, and a loopback Host. Add unauthenticated Admin role claims only to anonymous `/api/v1/admin/*` requests after cookie authentication and before authorization; preserve authenticated principals so cookie sessions and audit attribution continue to work.
2. Make Vite development enable the local setup flag by default while allowing `VITE_LOCAL_SETUP_MODE=false`. The frontend bypasses session checks only on `/` and `/admin/*`; Reception and Staff routes use normal session and role guards. Production builds retain normal authentication everywhere.
3. Preserve the API client's existing CSRF token flow for writes. Do not add an account, credential, endpoint, or database change.

## Verification

- Unit-test enabled/disabled state, Development/Production, IPv4/IPv6 loopback, remote address, Host, and Admin-path matching.
- E2E-test the direct Admin route without a session request or login form.
- Extend the opt-in MySQL API/browser test to verify unauthenticated local Admin configuration access while queue routes still require a real session.
- Run .NET tests/build, frontend unit tests, the local setup browser check, existing authenticated browser workflows, lint/build, and `git diff --check`.

## Review boundary

Inspect middleware ordering, confirm the synthetic principal is limited to Admin API paths, and verify the Host and remote-address checks cannot be satisfied by a non-loopback request. Local setup writes have no authenticated actor ID in audit records.
