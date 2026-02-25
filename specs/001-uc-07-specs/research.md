# Research Notes: Receive Final Paper Decision

## Decision 1: Official publication indicator

**Decision**: Use `FinalDecision.published_at` as the official publication timestamp that gates author visibility and email notification.
**Rationale**: A single timestamp provides an unambiguous, auditable switch for "published" state across UI and notifications.
**Alternatives considered**:
- Boolean `is_published` flag (less auditable, lacks timing detail)
- Status enum (adds complexity without additional user value for this feature)

## Decision 2: Notification channel

**Decision**: Email only to the submitting author.
**Rationale**: Matches clarified requirements and keeps communication aligned to a single accountable recipient.
**Alternatives considered**:
- Email all co-authors (out of scope per clarified requirements)
- In-app only (does not meet explicit notification requirement)

## Decision 3: Retrieval failure messaging

**Decision**: Use a user-facing message: "Decision temporarily unavailable. Please try again later." with no internal IDs or stack traces.
**Rationale**: Provides clear guidance while protecting internal details and decision confidentiality.
**Alternatives considered**:
- Generic error without guidance (poor UX)
- Detailed technical error (security and privacy risk)
