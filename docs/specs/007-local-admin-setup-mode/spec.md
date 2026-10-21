# SPEC-007 — Local admin setup without sign-in

**Status:** Approved for local implementation | **Date:** 2026-10-21 | **Scope:** Local configuration before staff accounts are provisioned

## Goal

Let a clinic operator open the existing Admin workspace and configure departments, services, stations, users, and displays before signing in or creating an initial administrator account.

## Approved behavior

- The normal Vite development command opens `/admin` without showing the login page. `/admin` redirects to the Departments section at `/admin/departments`; the UI labels the session as Local setup and does not offer sign-out.
- For anonymous `/api/v1/admin/*` requests only, the API adds temporary Admin role claims that remain unauthenticated when all of these are true: `LocalSetup:Enabled` is true, ASP.NET Core is running in `Development`, the request's remote address is loopback, and the request Host is `localhost` or a loopback IP address. Real authenticated users keep their own claims and audit attribution. The existing anonymous CSRF-token endpoint therefore stays bound to the anonymous request; no other API path receives setup claims.
- Local setup access does not create an Identity account or password. Admin writes continue through the existing API and antiforgery client. Audit actor ID is empty until a signed-in administrator performs the action.
- Normal login and authorization remain in effect for production builds, non-Development API environments, non-loopback requests, and queue/reception endpoints.
- A local operator can turn this mode off with `VITE_LOCAL_SETUP_MODE=false` for Vite and `LocalSetup__Enabled=false` for the API.

## Out of scope

- A hard-coded or shared username/password, anonymous access over a LAN, production setup bypass, changes to Identity/password policy, ticket issue/call behavior, database migrations, or a public admin API.

## Acceptance

1. `npm run dev` opens the Admin workspace directly and labels Local setup mode; it does not request an auth session or display a login form.
2. With the API in Development and loopback access enabled, an unauthenticated local request can read and write Admin configuration, and writes must pass antiforgery validation.
3. The bypass does not apply when disabled, outside Development, or when either the remote address or Host is not loopback.
4. Non-admin API routes remain unauthorized without a real session; production frontend builds retain the existing sign-in and role guards.
5. The existing authenticated setup and queue workflows continue to work.

## Risks and limits

Anyone with access to the same local machine can change clinic configuration while this mode is enabled. Keep both development servers bound to loopback. Audit records created in Local setup have no authenticated actor ID. Disable the mode before exposing either server to another machine or environment.
