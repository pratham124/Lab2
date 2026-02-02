# Feature Specification: Assignment Rule Violation Notifications

**Feature Branch**: `001-uc-10-docs`  
**Created**: February 2, 2026  
**Status**: Draft  
**Input**: User description: "UC-10.md UC-10-AT.md"

## Clarifications

### Session 2026-02-02

- Q: What notification channels should be used for assignment rule violations? → A: In-app notification only at save time.
- Q: Should assignment rule violations be recorded for audit? → A: Record each violation event for audit (editor, paper, rule).
- Q: How should the system handle save when violations are found? → A: Block save immediately and show violations.
- Q: How long should violation audit logs be retained? → A: Retain audit logs 1 year.

## User Scenarios & Testing *(mandatory)*

- Primary scenarios: invalid reviewer count, reviewer workload violation, multiple violations in one save.
- Exception scenario: validation unavailable blocks save with user-facing message.
- Verification source: acceptance tests in `UC-10-AT.md` cover these scenarios.

## Use Case Mapping *(mandatory)*

- **Primary Use Case(s)**: UC-10
- **Acceptance Tests**: UC-10-AT
- **Notes**: Update existing UC-10 behavior and UC-10-AT coverage; no new use cases required.

### User Story 1 - Block Invalid Assignment and Notify (Priority: P1)

An editor attempts to save a reviewer assignment that violates one or more conference rules, and the system blocks the save while showing clear violation notifications so the editor can correct the assignment.

**Why this priority**: Prevents invalid reviewer assignments and ensures the editor can resolve issues immediately.

**Independent Test**: Can be fully tested by attempting to save an invalid assignment and verifying the save is blocked and a clear violation message appears.

**Acceptance Scenarios**:

1. **Given** an editor selects fewer than the required number of reviewers, **When** the editor saves the assignment, **Then** the system blocks the save and shows a message that exactly 3 reviewers are required.
2. **Given** an editor selects a reviewer who exceeds workload limits, **When** the editor saves the assignment, **Then** the system blocks the save and identifies the reviewer who cannot be assigned.

---

### User Story 2 - Multiple Violations Reported Together (Priority: P2)

An editor attempts to save a reviewer assignment that violates more than one rule, and the system shows each violation so the editor can fix all issues in one pass.

**Why this priority**: Improves correction efficiency and reduces repeated save attempts.

**Independent Test**: Can be fully tested by triggering two violations in one save and confirming both are shown.

**Acceptance Scenarios**:

1. **Given** an editor selects too few reviewers and includes an over-limit reviewer, **When** the editor saves the assignment, **Then** the system blocks the save and displays each violation distinctly.

---

### User Story 3 - Safe Failure on Validation Error (Priority: P3)

An editor attempts to save a reviewer assignment while validation cannot be performed, and the system blocks the save and explains that validation is temporarily unavailable.

**Why this priority**: Protects data integrity when validation cannot run.

**Independent Test**: Can be fully tested by simulating validation failure and verifying the save is blocked with an error message.

**Acceptance Scenarios**:

1. **Given** validation dependencies are unavailable, **When** the editor saves the assignment, **Then** the system blocks the save and informs the editor that validation cannot be completed.

---

### Edge Cases

- What happens when the editor repeatedly attempts to save without changing the invalid selection?
- How does the system handle a violation message when multiple reviewers exceed workload limits?
- What happens when rule configuration changes between selection and save?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST validate reviewer assignments against conference rules at the time of save.
- **FR-002**: System MUST block saving any reviewer assignment that violates one or more rules.
- **FR-003**: System MUST display a clear, actionable in-app notification at save time describing each detected rule violation, including rule name, affected reviewer (if applicable), corrective action hint, and plain language wording.
- **FR-004**: System MUST allow editors to correct assignments and successfully save once all violations are resolved.
- **FR-005**: System MUST block saving and display a validation-unavailable message stating validation cannot be completed now and the assignment is not saved.
- **FR-006**: System MUST treat assignment save as atomic: either all reviewers are saved or none are saved.
- **FR-008**: System MUST record each assignment rule violation event for audit with fields: editor_id, paper_id, violated_rule_id, violation_message, timestamp.
- **FR-009**: System MUST retain assignment rule violation audit logs for 1 year.
- **FR-010**: System MUST re-run validation on every save attempt with no throttling and re-display all current violations on each invalid attempt.
- **FR-011**: System MUST return all violations detected in a single save attempt together in one response.
- **FR-012**: System MUST validate at save time using the current rule configuration, overriding any selection-time assumptions.
- **FR-013**: Audit logs MUST be visible only to the admin role.

### Key Entities *(include if feature involves data)*

- **Reviewer Assignment**: The set of reviewers selected for a paper, including paper ID and reviewer IDs.
- **Assignment Rule**: A constraint that determines valid assignments (e.g., required reviewer count, workload limit).
- **Rule Violation**: A specific rule that was not satisfied, including a message suitable for editors.
- **Notification**: The user-visible message describing violations or validation errors.
- **Audit Log Entry**: A record of a rule violation event, including editor_id, paper_id, violated_rule_id, violation_message, and timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of invalid save attempts display a clear violation message within 2 seconds of the save-time validation response.
- **SC-002**: 100% of invalid assignments are blocked from being saved.
- **SC-003**: At least 90% of editors can correct an invalid assignment and successfully save on the next attempt without assistance, measured per release acceptance test cycle.
- **SC-004**: Validation failures result in a visible error message in 100% of affected save attempts.
- **SC-005**: Acceptance criteria verify each violation message includes a rule description and a corrective instruction.

## Assumptions

- Standard conference rules include a fixed required reviewer count and reviewer workload limits, with rule values defined outside this feature.
- Notification content is plain language suitable for editors and does not expose internal error details.
