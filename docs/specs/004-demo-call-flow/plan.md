# Plan — SPEC-004

1. Extend the existing demo store with a small, typed call result, service-scoped FIFO selection, active-call projection, and per-process idempotency for call requests.
2. Add a REST call-next command with Problem Details responses and a post-transition SignalR notification. Keep the Hub read-only.
3. Connect the existing dashboard Call next control to the selected service; refresh its snapshot after success and show empty/error/success states.
4. Remove fabricated TV data and non-approved clinic-specific/medical ticker copy. Keep the existing visual direction and fullscreen display.
5. Add tests first at the agreed public store seam and one browser flow. Update the display/API tests and repository navigation/spec references.
6. Verify solution tests/build and frontend unit, E2E, lint, and production build. Review diff and ensure the working tree contains only this task's changes.

No database, auth, additional projects, or production infrastructure are part of this plan.
