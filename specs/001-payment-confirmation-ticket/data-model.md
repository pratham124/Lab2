# Data Model: Receive Payment Confirmation Ticket

## Entities

### AttendeeAccount

- **Fields**: attendee_id, name, email, registration_status
- **Relationships**: one AttendeeAccount has many ConfirmationTickets

### PaymentConfirmation

- **Fields**: payment_reference, attendee_id, amount, currency, payment_status, confirmed_at
- **Validation**: payment_status must be "confirmed" to trigger ticket creation
- **Relationships**: one PaymentConfirmation maps to one ConfirmationTicket

### ConfirmationTicket

- **Fields**: ticket_id, attendee_id, payment_reference, invoice_number, amount, registration_status, issued_at, retention_expires_at
- **Validation**:
- payment_reference must match a confirmed PaymentConfirmation
- invoice_number must be present and unique per ticket
- retention_expires_at = conference_end_date + 90 days
- **Relationships**: belongs to AttendeeAccount; references PaymentConfirmation

### DeliveryAttempt

- **Fields**: delivery_id, ticket_id, recipient_email, channel, status, attempted_at, failure_reason
- **Validation**: channel = email only
- **Relationships**: belongs to ConfirmationTicket

## State Transitions

### ConfirmationTicket

- **Not Created** → **Issued**: on confirmed payment
- **Issued** → **Expired**: at retention_expires_at

### DeliveryAttempt

- **Pending** → **Delivered**
- **Pending** → **Failed**
