# Frontend

This is the React JavaScript + Vite app for the Queuing repository. The repository-level [README](../README.md) describes the full solution and its current status.

Run `npm ci` here to install the locked dependencies. Available scripts are `npm run dev`, `npm run test`, `npm run test:e2e`, `npm run lint`, and `npm run build`. Install the matching Playwright Chromium browser once in a fresh environment with `npx playwright install chromium`.

The default dashboard calls the local ASP.NET Core API to issue tickets and refresh the waiting display. The demo queue is in API memory and resets when the API restarts. It has no authentication or database; run on localhost with synthetic data only. Admin setup remains a static preview. See [`docs/specs/003-presentation-queue/spec.md`](../docs/specs/003-presentation-queue/spec.md) for scope and limits.
