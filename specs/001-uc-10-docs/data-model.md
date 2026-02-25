# Data Model: Assignment Rule Violation Notifications

## Entities

### Reviewer Assignment
- **Fields**: paperId, reviewerIds[]
- **Relationships**: belongs to Paper; includes multiple Reviewer references
- **Validation Rules**: must satisfy Assignment Rules at save time

### Assignment Rule
- **Fields**: ruleId, ruleType, parameters
- **Relationships**: applied to Reviewer Assignment
- **Validation Rules**: evaluated on save

### Rule Violation
- **Fields**: violated_rule_id, rule_name, violation_message, affected_reviewer_id (optional)
- **Relationships**: associated with Reviewer Assignment and Assignment Rule
- **Validation Rules**: one violation per failed rule

### Notification
- **Fields**: rule_name, violation_message, corrective_action_hint, affected_reviewer_id (optional), type
- **Relationships**: presented to Editor for a Rule Violation or validation error

### Audit Log Entry
- **Fields**: editor_id, paper_id, violated_rule_id, violation_message, timestamp
- **Relationships**: generated when Rule Violation is detected
- **Validation Rules**: retained for 1 year; visible only to admin role

## State Transitions

### Reviewer Assignment Save Attempt
- **Draft/Selected** → **Valid Saved** (no violations)
- **Draft/Selected** → **Blocked** (one or more violations)
- **Draft/Selected** → **Blocked (validation unavailable)** (validation dependency failure)
