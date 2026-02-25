# Data Model: Send Decision Notification

## Entities

### Paper
- **Fields**: `id`, `title`, `author_ids`, `review_status`, `decision_id`
- **Relationships**: One Paper has many Authors; one Paper has zero or one Decision.

### Decision
- **Fields**: `id`, `paper_id`, `outcome` (accept|reject), `recorded_at`, `final` (true), `notification_status` (sent|partial|failed)
- **Validation Rules**:
  - Only one Decision per Paper.
  - Decision can be recorded only when all required reviews are complete.
  - Decision is final once recorded and cannot be changed.

### Author
- **Fields**: `id`, `name`, `email`
- **Relationships**: Author can be associated with multiple Papers.

### ReviewStatus
- **Fields**: `paper_id`, `required_count`, `submitted_required_count`, `complete` (boolean)
- **Validation Rules**: `complete` is true only when `submitted_required_count >= required_count` and no required review assignment remains in `invited`, `pending`, or `in_progress`.

### ReviewAssignment
- **Fields**: `paper_id`, `reviewer_id`, `status` (invited|pending|in_progress|submitted), `required` (boolean)
- **Validation Rules**: Decision eligibility requires all `required=true` assignments to be `submitted`.

### NotificationAttempt
- **Fields**: `attempt_id`, `paper_id`, `decision_id`, `author_id`, `status` (pending|delivered|failed), `attempted_at`, `error_reason` (optional)
- **Validation Rules**:
  - One attempt per author per decision send action.
  - Resend attempts only allowed for authors with prior `failed` status.
  - Attempts never modify the stored decision.

## State Transitions

- **Decision lifecycle**: `none` → `recorded(final=true)`
- **Notification status**: `pending` → `sent` | `partial` | `failed`
- **Resend**: `partial` | `failed` → `partial` | `sent` (targeting only failed authors)
