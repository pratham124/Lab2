# Research: Receive Payment Confirmation Ticket

## Decision 1: Idempotent duplicate payment confirmation handling

- **Decision**: Treat duplicate payment confirmations as idempotent events; keep a single confirmation ticket and log the duplicate confirmation event.
- **Rationale**: Prevents duplicate tickets and user confusion while preserving auditability for payment gateway retries.
- **Alternatives considered**:
- Create a new ticket per confirmation (rejected: incorrect proof duplication).
- Block with user-facing error (rejected: could surface internal retries to users).

## Decision 2: Email-only delivery with safe fallback

- **Decision**: Deliver confirmation tickets via email only; on delivery failure, keep ticket accessible in CMS and log the failure.
- **Rationale**: Email is the most reliable and auditable external channel and aligns with the clarified requirement while ensuring access remains available in the CMS.
- **Alternatives considered**:
- Email + in-app notifications (rejected: added scope beyond requirement).
- In-app only (rejected: contradicts clarified requirement).

## Decision 3: Retention enforcement and user messaging

- **Decision**: Retain tickets through the conference end date plus 90 days; after that, tickets are no longer accessible and a clear message is shown.
- **Rationale**: Balances attendee needs with data minimization and aligns with clarified retention requirement.
- **Alternatives considered**:
- Retain indefinitely (rejected: unnecessary data retention).
- Short fixed windows (rejected: insufficient for attendee needs).
