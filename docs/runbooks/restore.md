# Restore and continuity runbook (draft)
1. Set clinic-approved RPO/RTO and classify outage: browser, local LAN, API, database, printer.
2. Ensure daily encrypted off-host backups, retention, access control and alert on failed jobs; establish periodic restore drills.
3. In outage, **do not** issue independent offline tickets unless formally designed; switch to approved manual contingency log to avoid duplicates.
4. For disaster recovery, pause mutations, select validated backup, restore to isolated environment, run integrity checks and application smoke tests.
5. Reconcile manually issued tickets via approved clinic procedure before resuming digital numbering.
6. Restart API, verify current session and display snapshot, resume authorized operations and document incident.
7. Keep proof of restore tests, duration, backup age and operator signoff.
