# Phase 0 Research: Send Decision Notification

## Decision 1: Technical stack for implementation
- **Decision**: Vanilla HTML/CSS/JavaScript with MVC separation
- **Rationale**: Required by project constitution; avoids frameworks and keeps implementation aligned with constraints.
- **Alternatives considered**: Framework-based stack (rejected by constitution).

## Decision 2: API style for contracts
- **Decision**: REST-style endpoints
- **Rationale**: Fits vanilla stack constraints and aligns with common CMS patterns; straightforward for controllers/services.
- **Alternatives considered**: GraphQL (unnecessary complexity for narrow feature scope).

## Decision 3: Notification resend behavior representation
- **Decision**: Resend endpoint targets only previously failed recipients
- **Rationale**: Matches clarified requirements; reduces duplicate notifications.
- **Alternatives considered**: Resend to all authors (rejected by clarified requirement).
