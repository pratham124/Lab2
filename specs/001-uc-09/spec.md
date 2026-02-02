# Feature Specification: Enforce Reviewer Workload Limit

**Feature Branch**: `001-uc-09`  
**Created**: February 2, 2026  
**Status**: Draft  
**Input**: User description: "UC-09.md UC-09-AT.md"

## User Scenarios & Testing *(mandatory)*

## Use Case Mapping *(mandatory)*

- **Primary Use Case(s)**: UC-09
- **Acceptance Tests**: UC-09-AT
- **Notes**: Update existing use case and acceptance tests; no new use cases required.

## Clarifications

### Session 2026-02-02

- Q: Which assignments count toward the 5-paper limit? → A: Assigned papers only; no pending state, and reviewers with 5 assigned papers are not selectable.
- Q: Is the 5-paper limit per conference or global? → A: Per conference only.
- Q: Should workload verification failures be logged for admins? → A: Yes, log the failure for admin review.
- Q: Should reviewers at the workload limit be hidden or disabled in selection? → A: Hidden from selection when at limit.
- Q: Is the workload limit fixed or configurable? → A: Fixed at exactly 5 for this release.

### User Story 1 - Block assignment at workload limit (Priority: P1)

As an editor, I want the system to prevent assigning a reviewer who already has the maximum allowed workload so that reviewer assignments remain fair and balanced.

**Why this priority**: Preventing overload is the core business rule and protects reviewer capacity.

**Independent Test**: Attempt to assign a reviewer with 5 existing assignments and confirm the system blocks the assignment and communicates the reason.

**Acceptance Scenarios**:

1. **Given** a reviewer has 5 assigned papers, **When** an editor attempts to assign that reviewer to another paper, **Then** the system blocks the assignment and explains the workload limit.
2. **Given** the assignment is blocked, **When** the editor returns to the assignment flow, **Then** no invalid assignment is saved and reviewer workload remains unchanged.

---

### User Story 2 - Allow assignment under the limit (Priority: P2)

As an editor, I want to assign a reviewer who is below the workload limit so that the assignment can proceed without unnecessary blockers.

**Why this priority**: Editors must still complete valid assignments efficiently.

**Independent Test**: Assign a reviewer with fewer than 5 assignments and confirm the assignment succeeds and workload updates to reflect the new count.

**Acceptance Scenarios**:

1. **Given** a reviewer has 4 assigned papers, **When** an editor assigns that reviewer to a new paper, **Then** the system allows the assignment and the workload becomes 5.

---

### User Story 3 - Fail safe when workload cannot be verified (Priority: P3)

As an editor, I want the system to block assignments when workload data cannot be retrieved so that the system avoids accidental overload and clearly communicates the issue.

**Why this priority**: Safety and data integrity require conservative behavior when validation is unavailable.

**Independent Test**: Simulate a workload lookup failure and confirm the assignment is blocked with a clear message and no data is saved.

**Acceptance Scenarios**:

1. **Given** workload verification fails, **When** an editor attempts an assignment, **Then** the system blocks the assignment and informs the editor that workload cannot be verified.

---

### Edge Cases

- A reviewer has exactly 5 assignments and two editors attempt to assign concurrently; only one new assignment is allowed and the workload never exceeds 5.
- Workload data cannot be retrieved due to a system error; the assignment is blocked and no partial data is saved.
- An editor attempts to assign a reviewer who has 0 assignments; the assignment should succeed and workload becomes 1.
- A non-editor attempts to access reviewer assignment; access is denied and no assignment attempt is executed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST prevent assigning a reviewer to a paper when the reviewer already has 5 assigned papers.
- **FR-002**: System MUST allow assignment when the reviewer has fewer than 5 assigned papers.
- **FR-003**: System MUST block the assignment if reviewer workload cannot be verified.
- **FR-004**: System MUST display a clear message to the editor when an assignment is blocked due to workload limit or verification failure; the message MUST be non-technical, state the reason (limit reached or workload cannot be verified), include the numeric limit “5” when applicable, and must not expose internal IDs or stack traces.
- **FR-005**: System MUST ensure no assignment record is created when an assignment is blocked.
- **FR-006**: Only editors MUST be able to initiate reviewer assignments that trigger workload checks.
- **FR-007**: System MUST ensure the workload limit is enforced under concurrent assignment attempts.
- **FR-008**: Reviewers who already have 5 assigned papers MUST be excluded from the reviewer selection list during the assignment flow.
- **FR-009**: The 5-paper workload limit MUST be enforced per conference, not across all conferences.
- **FR-010**: System MUST record workload verification failures for administrative review.
- **FR-011**: Reviewers at the workload limit MUST be hidden (not disabled) by exclusion from the reviewer selection list.

### Key Entities *(include if feature involves data)*

- **Reviewer**: User who can be assigned papers; tracked by current assignment count.
- **Paper**: Submission eligible for reviewer assignment within a conference.
- **Assignment**: Relationship between reviewer and paper indicating an assigned paper (no pending state).
- **Workload Count**: Total number of assigned papers for a reviewer within a conference.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of attempts to assign a reviewer with 5 existing assignments are blocked in acceptance testing.
- **SC-002**: 100% of attempts to assign a reviewer with fewer than 5 assignments succeed in acceptance testing.
- **SC-003**: Under concurrent assignment attempts, final reviewer workload never exceeds 5 in acceptance testing.
- **SC-004**: 100% of assignment attempts during workload verification failure are blocked with a user-visible message.
- **SC-005**: 90% of editors report that workload-limit messages are clear in a post-task survey.

## Assumptions & Dependencies

- The workload limit is fixed at 5 assignments per reviewer for this release.
- Workload counts reflect assigned papers only; there is no pending state.
- Editor authentication and role permissions are already available in the system.
