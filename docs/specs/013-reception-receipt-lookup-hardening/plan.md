# SPEC-013 Implementation Plan

1. Add API request/response contracts for explicit receipt search and selected receipt retrieval; retain the existing visit-code GET route for compatibility.
2. Add a bounded, clinic-date-scoped search that returns the original Department step per visit and never projects the reference value.
3. Update the shared frontend API client and Reception UI for explicit lookup type, duplicate selection, non-identifying guidance, manual 58 mm print, and post-render manual print behavior.
4. Remove automatic migration from normal API startup; retain bootstrap migration and add an explicit `--apply-migrations` operation for existing databases.
5. Add focused frontend and opt-in MySQL workflows, run checks, inspect privacy/auth/migration diff, and record acceptance evidence.

## Risks

- Existing stored reference values are preserved and may need a separately authorized cleanup if users previously entered identifying chart values.
- MySQL translation and ordering for the bounded reference search must be exercised by the opt-in MySQL workflow.
- Physical printer output remains unverified; the interface will support only the already specified 58 mm profile.
