# Feature Specification: Assign Reviewers to Papers

**Feature Branch**: `001-uc-08-docs`  
**Created**: February 2, 2026  
**Status**: Draft  
**Input**: User description: "UC-08.md UC-08-AT.md"

## Clarifications

### Session 2026-02-02
- Q: Do we need explicit performance targets for reviewer assignment? → A: No specific targets.
- Q: What happens if assignment succeeds but sending invitations fails? → A: Keep assignments; assignments remain valid if invitations fail; warn the editor and retry invitations later.
- Q: What happens when a paper already has reviewers assigned? → A: Block re-assignment and show a clear message that reviewers are already assigned.
- Q: What happens when fewer than the required number of eligible reviewers exist? → A: Block assignment and show a clear message that insufficient eligible reviewers exist.
## User Scenarios & Testing *(mandatory)*

## Use Case Mapping *(mandatory)*

- **Primary Use Case(s)**: UC-08
- **Acceptance Tests**: UC-08-AT
- **Notes**: Existing use case and acceptance tests are the source of expected behavior for reviewer assignment.

### User Story 1 - Assign Required Reviewers (Priority: P1)

An editor assigns the required number of qualified reviewers to a submitted paper so the review process can start on time.

**Why this priority**: Without reviewer assignments, the review process cannot proceed.

**Independent Test**: Can be fully tested by assigning reviewers to a single submitted paper and verifying assignments are saved; invitations may be attempted but failures do not invalidate the assignment.

**Acceptance Scenarios**:

1. **Given** a submitted paper requires reviewers and at least three eligible reviewers are available, **When** the editor selects exactly three reviewers and confirms, **Then** the system assigns those reviewers and confirms success to the editor.
2. **Given** the assignment is saved successfully, **When** the system completes the assignment, **Then** the assigned reviewers receive review invitations.

---

### User Story 2 - Enforce Reviewer Count Rules (Priority: P2)

An editor is guided when selecting too few or too many reviewers, preventing invalid assignments.

**Why this priority**: Prevents invalid assignments and reduces rework.

**Independent Test**: Can be fully tested by attempting to save assignments with fewer or more than the required number of reviewers.

**Acceptance Scenarios**:

1. **Given** a submitted paper requires exactly three reviewers, **When** the editor selects fewer or more than three reviewers, **Then** the system blocks the assignment and shows a clear error message.

---

### User Story 3 - Enforce Reviewer Workload Limits (Priority: P3)

An editor cannot assign a reviewer who has reached the maximum workload, ensuring fair distribution and compliance with conference rules.

**Why this priority**: Maintains reviewer capacity constraints and fairness.

**Independent Test**: Can be fully tested by selecting a reviewer at the workload limit and attempting to save the assignment.

**Acceptance Scenarios**:

1. **Given** a reviewer has already reached the maximum allowed assigned papers, **When** the editor attempts to assign that reviewer, **Then** the system blocks the assignment and explains the workload limit violation.

---

### Edge Cases

- The system blocks assignment and shows a clear message when fewer than three eligible reviewers are available.
- The system blocks re-assignment and shows a clear message when a paper already has reviewers assigned.
- The system keeps assignments, warns the editor, and retries invitations when notifications fail.

## Requirements *(mandatory)*

## Non-Functional Requirements

- No explicit performance targets are required beyond standard responsiveness.

### Functional Requirements

- **FR-001**: The system MUST allow an editor to view submitted papers that require reviewer assignment.
- **FR-002**: The system MUST display a list of eligible reviewers for the selected paper; for this feature, eligible means the reviewer has eligible status and currentAssignmentCount < 5.
- **FR-003**: The system MUST require exactly three reviewers to be selected for a paper.
- **FR-003a**: The system MUST block assignment and show a clear message when fewer than three eligible reviewers exist.
- **FR-003b**: The system MUST block re-assignment and show a clear message when a paper already has reviewers assigned.
- **FR-004**: The system MUST prevent assignments that exceed the maximum reviewer workload of five assigned papers.
- **FR-005**: The system MUST save reviewer assignments when all rules are satisfied; assignment success depends only on this save.
- **FR-006**: The system MUST attempt to notify assigned reviewers after a successful assignment as a post-assignment action that does not affect assignment success.
- **FR-006a**: If invitations fail after assignment, the system MUST log the issue, warn the editor, and may retry sending invitations; assignments remain valid.
- **FR-007**: The system MUST show a clear confirmation message to the editor after a successful assignment.
- **FR-008**: The system MUST show a clear error message when assignments fail due to rule violations or system errors.
- **FR-009**: The system MUST ensure no partial reviewer assignments are saved when validation fails.

### Key Entities *(include if feature involves data)*

- **Paper**: A submitted item that requires reviewer assignments and tracks assignment status.
- **Reviewer**: A qualified user eligible for assignment, with a current workload count.
- **Assignment**: A record linking a reviewer to a paper.
- **Invitation**: A notification sent to a reviewer requesting a review.

### Assumptions

- Exactly three reviewers are required per paper, and the maximum reviewer workload is five assigned papers.
- Editors are authenticated and authorized to assign reviewers.
- Eligibility rules beyond workload limits (such as conflicts of interest) are handled elsewhere.
- For this feature, an eligible reviewer is in eligible status and has currentAssignmentCount < 5 prior to assignment.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of reviewer assignments are completed successfully on the first attempt.
- **SC-002**: Editors can complete a valid reviewer assignment in under 3 minutes from opening the assignment screen.
- **SC-003**: 100% of invalid reviewer count selections are blocked with a clear error message.
- **SC-004**: 100% of assignments that exceed reviewer workload limits are blocked.
- **SC-005**: At least 95% of assigned reviewers receive invitations within 2 minutes of assignment confirmation (does not affect assignment success).
- **SC-006**: 100% of invitation failures after assignment trigger an editor-visible warning and a retry attempt.
