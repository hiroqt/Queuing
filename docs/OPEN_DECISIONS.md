# Open decisions — resolve before production or affected slice

| ID | Question | Provisional assumption | Required owner |
|---|---|---|---|
| D-01 | Queue reset boundary/timezone? | Per-service daily clinic-local reset with configurable timezone | Clinic operations |
| D-02 | Is queue FIFO only? | FIFO within one service; no clinical triage | Clinic operations |
| D-03 | When skipped, does ticket return to waiting or remain skipped? | Explicit staff-initiated requeue only | Clinic operations |
| D-04 | May any staff issue tickets or only reception? | Assigned/authorized staff | Clinic operations |
| D-05 | Printing hardware, widths, browser/kiosk? | Browser print 58/80mm, manual dialog | IT operations |
| D-06 | Display connectivity/pairing and physical access? | Admin-approved revocable pairing | IT/security |
| D-07 | Single on-prem server or cloud? | Single-host deployment; network assumed during operation | IT operations |
| D-08 | Retention period for tickets and audit? | Do not purge until approved policy | Privacy/security |
| D-09 | Staff account creation/password recovery policy? | Admin managed, secure reset workflow specified later | IT/security |
| D-10 | Reprint authorization/reason required? | Assigned staff + audit record | Clinic operations |
| D-11 | MySQL installation, backup owner, and restore RPO/RTO? | Local MySQL 8.x for first implementation; isolated dev database. Production backup/restore ownership and targets remain open. | IT operations |

## Resolved for SPEC-005 (2026-10-20)

- One stable anonymous visit code is forwarded through one active department step; staff may select any active next department.
- A missed call returns the same step to pending; that visit can be called again.
- Reception may enter an optional appointment time for the initial department step; forwarding staff may enter one for the next department step. Due appointments order before FIFO walk-ins; future appointments cannot be called early.
- One clinic-wide daily visit sequence uses `Asia/Manila`; department ordering does not create additional patient-facing ticket numbers.
- Admin provisions Admin, Reception, and department-assigned Staff. Monitors are admin-created, scoped to one department, and activated through revocable pairing.
- Initial target is local clinic hosting with MySQL 8.x. This does not authorize production exposure or live patient data.

The provisional assumptions are not production approvals. Do not implement a contested workflow as settled without stakeholder agreement.
