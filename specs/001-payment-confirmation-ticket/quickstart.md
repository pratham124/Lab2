# Quickstart: Receive Payment Confirmation Ticket

## Goal

Verify that a confirmed payment produces a single confirmation ticket, delivers it via email, and keeps it accessible through conference end + 90 days.

## Preconditions

- Attendee account exists and is authenticated.
- Payment confirmation can be simulated or received from the gateway.
- Email delivery is observable (stub inbox or logs).

## Steps

1. Trigger a successful payment confirmation for an attendee.
2. Open the attendee account and view tickets.
3. Confirm ticket details include invoice number, payment reference, amount, status, and timestamp.
4. Verify an email was sent to the attendee with the ticket or link.
5. Re-send the same payment confirmation and confirm no duplicate ticket is created and a duplicate event is logged.
6. Simulate email delivery failure and confirm the ticket remains accessible in the CMS.
7. Simulate ticket generation/storage failure and confirm a generic error with support contact path is shown.
8. Attempt cross-attendee ticket access and confirm access is denied.
9. After retention window ends, confirm ticket is no longer accessible and a clear message is shown.

## Implementation Notes

- POST payment confirmation endpoint: `/payments/confirmations` (JSON body; returns ticket JSON or HTML).
- Ticket access endpoints: `/me/tickets` and `/me/tickets/{ticketId}`.
- Auth for ticket access uses attendee session or `x-user-id` headers.
- Retention calculation uses `CONFERENCE_END_DATE` (ISO-8601) if set; otherwise defaults to now + 90 days.
