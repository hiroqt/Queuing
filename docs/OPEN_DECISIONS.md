# Open decisions — resolve before production or affected slice

| ID | Question | Provisional assumption | Required owner |
|---|---|---|---|
| D-01 | Queue reset boundary/timezone? | Per-service daily clinic-local reset with configurable timezone | Clinic operations |
| D-02 | Is queue FIFO only? | FIFO within one service; no clinical triage | Clinic operations |
| D-03 | When skipped, does ticket return to waiting or remain skipped? | Explicit staff-initiated requeue only | Clinic operations |
| D-04 | May any staff issue tickets or only reception? | Assigned/authorized staff | Clinic operations |
| D-05 | Printing hardware, widths, browser/kiosk? | Browser print 58/80mm, manual dialog; SPEC-009 kiosk uses existing 58mm style | IT operations |
| D-06 | Display connectivity/pairing and physical access? | Admin-approved revocable pairing | IT/security |
| D-07 | Single on-prem server or cloud? | Single-host deployment; network assumed during operation | IT operations |
| D-08 | Retention period for tickets and audit? | Do not purge until approved policy | Privacy/security |
| D-09 | Staff account creation/password recovery policy? | Admin managed, secure reset workflow specified later | IT/security |
| D-11 | MySQL installation, backup owner, and restore RPO/RTO? | Local MySQL 8.x for first implementation; isolated dev database. Production backup/restore ownership and targets remain open. | IT operations |

## Resolved for SPEC-005 (2026-10-20)

- One stable anonymous visit code is forwarded through one active department step; staff may select any active next department.
- A missed call returns the same step to pending; that visit can be called again.
- Reception may enter an optional appointment time for the initial department step; forwarding staff may enter one for the next department step. Due appointments order before FIFO walk-ins; future appointments cannot be called early.
- One clinic-wide daily visit sequence uses `Asia/Manila`; department ordering does not create additional patient-facing ticket numbers.
- Admin provisions Admin, Reception, and department-assigned Staff. Monitors are admin-created, scoped to one department, and activated through revocable pairing.
- Initial target is local clinic hosting with MySQL 8.x. This does not authorize production exposure or live patient data.

## Resolved for SPEC-006 (2026-10-21)

- Reuse Department for the legacy Channel concept; do not create a second channel/destination entity.
- Each Service and physical Station belongs to exactly one Department. A Station can handle multiple same-department Services and be assigned to multiple same-department Staff; Staff can use multiple Stations.
- The first slice added Admin configuration only. Reception service selection and service/station-scoped queue calls were deferred to a follow-up spec.

## Resolved for SPEC-008 (2026-10-21)

- Reception selects an active Service; the API derives its Department and persists ServiceId on the initial step.
- Staff chooses an active destination Service when forwarding. Staff can view active destination choices across Departments because the approved workflow permits any next department; actual queue access and call-next authorization remain scoped to assigned Departments.
- A receipt is reloaded by canonical daily visit code plus Asia/Manila clinic date and shows the original issue step after forwarding. Existing visit-ID lookup remains for compatibility.
- Reception authorization is required for receipt lookup; lookup is read-only and has no separate reprint-reason prompt or read audit.
- Physical stations do not constrain issue, forwarding, or call-next yet. Existing Department queue and display behavior remains unchanged.

## Resolved for SPEC-009 (2026-10-22)

- Kiosk flow is Department → Service → confirmation → issue → receipt; one active Service is preselected but still confirmed.
- Kiosks are Admin-enrolled and independently revocable; kiosk identity is stored on Visits and issue audit records. Display credentials/policies are not shared.
- Kiosks issue walk-ins only and cannot access queues or Reception receipt lookup. The API validates active Service/Department and uses the existing daily sequence.
- Kiosk UI uses a distinct responsive touch-first direction; print is an explicit browser action at 58mm and reset is explicit.
- Browser lockdown, clinic network/VLAN policy, and physical printer behavior remain deployment/hardware decisions; no offline issue is supported.

## Resolve before station-aware queue integration

- Department deactivation currently leaves child Services and Stations active, and child reactivation does not check whether the parent Department is active. Decide whether parent deactivation should cascade to children or whether active-child updates should require an active parent.
- The Admin UI offers only active Services when adding a Station, while the Admin API permits assigning an inactive same-department Service. Decide whether to reject new inactive-Service links or preserve this as an administrative association for later reactivation.

The provisional assumptions are not production approvals. Do not implement a contested workflow as settled without stakeholder agreement.
