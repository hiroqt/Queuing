# Frontend

This is the React JavaScript + Vite app for the Queuing repository. The repository-level [README](../README.md) describes the full solution and its current status.

Run `npm ci` here to install the locked dependencies. Available scripts are `npm run dev`, `npm run test`, `npm run test:e2e`, `npm run lint`, and `npm run build`. Install the matching Playwright Chromium browser once in a fresh environment with `npx playwright install chromium`.

The SPA routes sign-in, forced password change, Admin, Reception, assigned Department Staff, display pairing (`/display/pair`), and paired department display (`/display`). All versioned HTTP requests use [`src/api/client.js`](src/api/client.js), including CSRF tokens and idempotency keys. The paired display opens without staff sign-in, uses its revocable device cookie, and treats SignalR `QueueChanged` events as refresh hints before loading the assigned department snapshot.

The React route guards are navigation controls; API authorization remains authoritative. The default Playwright UI tests mock API responses. The opt-in `clinic-mysql-integration.spec.js` test exercises real API authorization and a browser workflow against an isolated MySQL `_test` database; it creates departments and visits, so do not point it at shared data. See the root README and SPEC-005 acceptance record for setup and limits.
