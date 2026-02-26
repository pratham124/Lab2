# Quickstart: Pay Conference Registration Fee Online

## Purpose
This feature plan aligns implementation to UC-21 and UC-21-AT for online card payments.

## How to Validate
1. Use the acceptance tests in `UC-21-AT.md` as the execution checklist.
2. Verify success, failure, pending confirmation (24-hour timeout), duplicate confirmation handling, and already-paid blocking behavior.
3. Confirm `/registrations/{id}/payment-status` and `/registrations/{id}/payment-records` return expected status codes and record fields for the scenario under test.

## Notes
- No runnable application is defined in this plan; implementation should follow the MVC structure described in `plan.md`.

## Datastore Consistency
- If atomic writes are unavailable, the system performs ordered writes: payment transaction is persisted first, then the registration status is updated.
- During this brief window, the attendee may see `pending_confirmation` while status propagation completes. Expected propagation is under 1 minute in normal operation.

## Clock & Timezone
- The authoritative clock for the “pending >24 hours” rule is the server clock in UTC.
