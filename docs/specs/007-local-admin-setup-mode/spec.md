# SPEC-007 — Local Admin setup without sign-in

**Status:** Approved for local implementation | **Updated:** 2026-10-24 | **Scope:** Login-free local Admin configuration while Reception and Staff use real accounts

## Goal

Let a clinic operator open the Admin workspace and frontend Reception or Department routes before signing in or provisioning role accounts. Admin configuration remains available through its existing loopback-only API exception.

## Approved behavior

- The normal Vite development command opens `/admin` without showing the login page. `/admin` redirects to the Departments section at `/admin/departments`; the UI labels Local setup mode and offers Sign out to exit the bypass for the current browser tab session.
- In Vite development local setup mode, `/` and `/admin/*` open the Admin workspace without a staff session. Direct `/reception` and `/department` routes use normal session and role guards and send signed-out users to `/login`, preserving their requested destination.
- For anonymous `/api/v1/admin/*` requests only, the API adds temporary Admin role claims that remain unauthenticated when all of these are true: `LocalSetup:Enabled` is true, ASP.NET Core is running in `Development`, the request's remote address is loopback, and the request Host is `localhost` or a loopback IP address. Real authenticated users keep their own claims and audit attribution. The existing anonymous CSRF-token endpoint therefore stays bound to the anonymous request; no other API path receives setup claims.
- Reception and Staff do not have preview identities. Their pages and API actions require real, active accounts with the Reception or Staff role; Staff queue access additionally requires Service assignments.
- Local setup access does not create an Identity account or password. Admin writes continue through the existing API and antiforgery client. Audit actor ID is empty until a signed-in administrator performs the action.
- Signing out while Local setup is active checks for and ends any existing authenticated API session, then disables the frontend bypass until the browser tab session ends and opens the normal login page.
- Normal login and API authorization remain in effect for production builds, non-Development API environments, non-loopback requests, and queue/reception endpoints.
- A local operator can turn this mode off with `VITE_LOCAL_SETUP_MODE=false` for Vite and `LocalSetup__Enabled=false` for the API.

## Out of scope

- A hard-coded or shared username/password, anonymous access over a LAN, production setup bypass, changes to Identity/password policy, ticket issue/call behavior, database migrations, or a public admin API.

## Acceptance

1. `npm run dev` opens the Admin workspace directly without requesting an auth session. Direct `/reception` and `/department` URLs request the actual session and redirect signed-out users to `/login`.
2. With the API in Development and loopback access enabled, an unauthenticated local request can read and write Admin configuration, and writes must pass antiforgery validation.
3. The bypass does not apply when disabled, outside Development, or when either the remote address or Host is not loopback.
4. Non-admin API routes remain unauthorized without a real session; production frontend builds retain the existing sign-in and role guards.
5. Signing in as Reception from `/reception` returns to Reception; signing in as Staff from `/department` returns to Department. A signed-in role cannot enter the other role's workspace.
6. Signing out from the login-free Admin workspace exits Local setup and opens `/login`; the bypass remains off after a reload in the same browser tab.

## Risks and limits

Anyone with access to the same local machine can change clinic configuration while this mode is enabled. Keep both development servers bound to loopback. Admin writes made in Local setup have no authenticated actor ID. Disable the mode before exposing either server to another machine or environment.
