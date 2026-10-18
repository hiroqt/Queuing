# Frontend

This is the React JavaScript + Vite app for the Queuing repository. The repository-level [README](../README.md) describes the full solution and its current status.

Run `npm ci` here to install the locked dependencies. Available scripts are `npm run dev`, `npm run test`, `npm run test:e2e`, `npm run lint`, and `npm run build`. Install the matching Playwright Chromium browser once in a fresh environment with `npx playwright install chromium`.

The four queue views are a frontend-only demo backed by synthetic data. UI actions explain their effect but do not call or persist to a backend. See [`docs/specs/002-frontend-mvp-demo/spec.md`](../docs/specs/002-frontend-mvp-demo/spec.md) for scope and boundaries.
