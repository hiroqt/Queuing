# Transactional queue checklist
- [ ] Queue session/numbering boundary documented and tested across midnight/timezone
- [ ] Database unique constraint on `(queue_session_id,sequence)`
- [ ] Atomic sequence generation; no `MAX()+1` outside lock/transaction
- [ ] Atomic call-next with row locking/conditional update; stable FIFO policy
- [ ] Transaction includes ticket/event/idempotency/outbox as applicable
- [ ] Repeated command with same idempotency key yields stable result
- [ ] Invalid transitions rejected; no lost updates
- [ ] Tests against actual PostgreSQL with multiple concurrent connections
- [ ] Outbox dispatcher handles retries and duplicates; client refreshes snapshots
