# Release runbook (draft)
1. Confirm clinic-approved scope/spec and QA AC evidence; security review and documented remaining risks.
2. Schedule change window; confirm secret configuration and up-to-date off-host encrypted DB backup.
3. Deploy to staging, apply reviewed EF migration explicitly, verify startup/auth/issue/call/display/print flows.
4. Record release version and migration version; run production migration with monitored operator action (not on each app startup).
5. Roll out same-origin static React assets + API; check health, queue issue/call, SignalR reconnect and printer profile.
6. Monitor DB connections, API errors, queue conflicts, outbox lag, notification latency; notify operator on anomalies.
7. Rollback: redeploy compatible app; for irreversible schema change use planned restore/forward fix after evaluating data loss; rehearse ahead.
