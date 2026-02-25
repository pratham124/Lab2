# Data Model: Receive Final Paper Decision

## Entities

### Paper

- **Fields**: id, title, submitting_author_id
- **Relationships**:
  - One Paper has one FinalDecision (optional until recorded)
  - One Paper has one submitting Author

### FinalDecision

- **Fields**: id, paper_id, decision_value (Accepted|Rejected), published_at, recorded_at
- **Relationships**:
  - Belongs to one Paper
- **Notes**:
  - `published_at` represents official publication to authors and is the gate for visibility and notification.

### Author

- **Fields**: id, name, email
- **Relationships**:
  - Can submit many Papers (one submitting author per Paper)

### Notification

- **Fields**: id, paper_id, recipient_author_id, channel (email), status, sent_at, failure_reason
- **Relationships**:
  - Links to one Paper and one Author

## Validation Rules

- Only the submitting author may view a paper's final decision.
- A decision is visible only when `published_at` is set.
- Reviewer comments are not returned or displayed in author-facing decision views.

## State Transitions

- FinalDecision: recorded -> published (when `published_at` is set)
- Notification: pending -> sent or failed
