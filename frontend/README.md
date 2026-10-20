# Frontend

This is the React JavaScript + Vite app for the Queuing repository. The repository-level [README](../README.md) describes the full solution and its current status.

Run `npm ci` here to install the locked dependencies. Available scripts are `npm run dev`, `npm run test`, `npm run test:e2e`, `npm run lint`, and `npm run build`. Install the matching Playwright Chromium browser once in a fresh environment with `npx playwright install chromium`.

The default dashboard calls the local ASP.NET Core API to issue tickets, call the next ticket for the selected service, and refresh waiting/calling state. The standalone `/display` route reads called tickets from the same in-memory store and updates over SignalR, with snapshots as the recovery source. The demo starts empty and resets when the API restarts. It has no authentication or database; bind it to loopback and use synthetic data only. Admin setup remains a static preview. See [`docs/specs/004-demo-call-flow/spec.md`](../docs/specs/004-demo-call-flow/spec.md) for scope and limits.
