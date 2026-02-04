# Data Model: Pay Conference Registration Fee Online

## Entities

### Attendee
- **Fields**: attendee_id, name, email, auth_status
- **Relationships**: One Attendee has one or more Registrations

### Registration
- **Fields**: registration_id, attendee_id, category, fee_amount, status
- **Status values**: unpaid, pending_confirmation, paid_confirmed
- **Relationships**: One Registration has zero or more Payment Transactions

### Payment Transaction
- **Fields**: payment_id, registration_id, amount, status, created_at, confirmed_at, gateway_reference
- **Status values**: initiated, pending_confirmation, succeeded, failed, declined
- **Uniqueness**: gateway_reference must be unique per transaction for idempotent confirmation handling

## State Transitions

### Registration Status
- **unpaid → pending_confirmation**: payment initiated and awaiting confirmation
- **pending_confirmation → paid_confirmed**: confirmation received
- **pending_confirmation → unpaid**: pending exceeds 24 hours
- **paid_confirmed → paid_confirmed**: duplicate confirmation received (no change)

### Payment Transaction Status
- **initiated → pending_confirmation**: redirected to gateway and awaiting confirmation
- **pending_confirmation → succeeded**: confirmation received
- **pending_confirmation → failed/declined**: invalid, declined, or pending exceeds 24 hours

## Validation Rules
- Payment initiation allowed only when registration status is unpaid
- Duplicate confirmations identified by gateway_reference and ignored
- Pending confirmations older than 24 hours revert registration to unpaid and notify attendee
