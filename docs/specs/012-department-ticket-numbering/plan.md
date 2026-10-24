# SPEC-012 Implementation Plan

1. Add the additive MySQL sequence table and nullable Department ticket date/number to DepartmentSteps, with a scoped unique index.
2. Allocate numbers inside the existing issue and forward transactions; keep idempotency responses stable.
3. Return the Department ticket number through issue, receipt, staff queue, and display projections. Update Reception, kiosk, Staff, and Department/lobby displays while retaining the clinic visit code for receipt lookup.
4. Enable muted autoplay on lobby videos and retain a user gesture for sound.
5. Verify with focused MySQL/API/browser workflows, frontend lint/build, migration inspection, and diff review.

## Risks and rollback

The new values are additive and nullable for old rows. Number allocation must remain database-transactional under concurrent issue/forward requests. Apply the additive migration before deploying code. Rollback only after reverting code and confirming the new API is no longer in use.
