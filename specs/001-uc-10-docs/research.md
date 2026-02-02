# Phase 0 Research: Assignment Rule Violation Notifications

## Decision 1: Notification Channel
- **Decision**: In-app notification only at save time.
- **Rationale**: Aligns with UC-10 goal to inform the editor immediately during save, avoids extra delivery channels not required by spec.
- **Alternatives considered**: Email notifications; notifying admin/chair.

## Decision 2: Audit Logging Scope
- **Decision**: Log each rule violation event with editor_id, paper_id, violated_rule_id, violation_message, and timestamp; audit logs visible only to admin role.
- **Rationale**: Supports accountability and troubleshooting without changing user flow.
- **Alternatives considered**: No logging; log only validation failures.

## Decision 3: Audit Log Retention
- **Decision**: Retain violation audit logs for 1 year.
- **Rationale**: Covers a full conference cycle while limiting storage footprint.
- **Alternatives considered**: 90 days; 3 years; indefinite retention.

## Decision 4: Performance Target
- **Decision**: Violation notification shown within 2 seconds of the save-time validation response.
- **Rationale**: Matches success criteria and clarifies timing scope.
- **Alternatives considered**: No explicit latency target.

## Decision 5: Stack Constraints
- **Decision**: Vanilla HTML/CSS/JavaScript with MVC separation.
- **Rationale**: Required by the project constitution.
- **Alternatives considered**: Framework-based stack.
