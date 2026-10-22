# SPEC-007 — Local setup and frontend role previews without sign-in

**Status:** Approved for local implementation | **Updated:** 2026-10-22 | **Scope:** Local configuration and frontend route previews before staff accounts are provisioned

## Goal

Let a clinic operator open the Admin workspace and frontend Reception or Department routes before signing in or provisioning role accounts. Admin configuration remains available through its existing loopback-only API exception.

## Approved behavior

- The normal Vite development command opens `/admin` without showing the login page. `/admin` redirects to the Departments section at `/admin/departments`; the UI labels the session as Local setup and does not offer sign-out.
- In Vite development local setup mode, direct `/reception` and `/department` routes open without a session. The frontend labels these as Reception or Staff route previews based on the URL; `/` continues to open Admin.
- For anonymous `/api/v1/admin/*` requests only, the API adds temporary Admin role claims that remain unauthenticated when all of these are true: `LocalSetup:Enabled` is true, ASP.NET Core is running in `Development`, the request's remote address is loopback, and the request Host is `localhost` or a loopback IP address. Real authenticated users keep their own claims and audit attribution. The existing anonymous CSRF-token endpoint therefore stays bound to the anonymous request; no other API path receives setup claims.
- Reception and Staff preview identities exist only in the frontend. Reception and department API requests remain protected and require real accounts; preview routes do not issue tickets or read or mutate department queues.
- Local setup access does not create an Identity account or password. Admin writes continue through the existing API and antiforgery client. Audit actor ID is empty until a signed-in administrator performs the action.
- Normal login and API authorization remain in effect for production builds, non-Development API environments, non-loopback requests, and queue/reception endpoints.
- A local operator can turn this mode off with `VITE_LOCAL_SETUP_MODE=false` for Vite and `LocalSetup__Enabled=false` for the API.

## Out of scope

- A hard-coded or shared username/password, anonymous access over a LAN, production setup bypass, changes to Identity/password policy, ticket issue/call behavior, database migrations, or a public admin API.

## Acceptance

1. `npm run dev` opens the Admin workspace directly; direct `/reception` and `/department` URLs show the respective frontend role previews without requesting an auth session or displaying the login form.
2. With the API in Development and loopback access enabled, an unauthenticated local request can read and write Admin configuration, and writes must pass antiforgery validation.
3. The bypass does not apply when disabled, outside Development, or when either the remote address or Host is not loopback.
4. Non-admin API routes remain unauthorized without a real session; production frontend builds retain the existing sign-in and role guards.
5. The existing authenticated setup and queue workflows continue to work.

## Risks and limits

Anyone with access to the same local machine can change clinic configuration while this mode is enabled. Keep both development servers bound to loopback. Audit records created in Local setup have no authenticated actor ID. Disable the mode before exposing either server to another machine or environment.
