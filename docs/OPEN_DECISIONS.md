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

The provisional assumptions are not production approvals. Do not implement a contested workflow as settled without stakeholder agreement.
