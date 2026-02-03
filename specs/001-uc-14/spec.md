# Feature Specification: View Completed Reviews for a Paper

**Feature Branch**: `001-uc-14`  
**Created**: 2026-02-02  
**Status**: Draft  
**Input**: User description: "UC-14.md UC-14-AT.md"

## User Scenarios & Testing *(mandatory)*

## Use Case Mapping *(mandatory)*

- **Primary Use Case(s)**: UC-14
- **Acceptance Tests**: UC-14-AT
- **Notes**: Existing use case and acceptance tests are being specified for implementation.

## Out of Scope

- Viewing pending (not submitted) reviews
- Editing or responding to reviews
- Exporting, downloading, or printing reviews
- Filtering or sorting reviews
- Changing reviewer anonymization rules

### User Story 1 - View completed reviews for a paper (Priority: P1)

As an editor, I want to view all completed reviews for a selected paper so I can make a final decision.

**Why this priority**: This is the core decision-support workflow for editors and is required to complete the review cycle.

**Independent Test**: Can be fully tested by selecting a paper with completed reviews and verifying all completed review content is shown.

**Acceptance Scenarios**:

1. **Given** an editor is logged in and manages a paper with completed reviews, **When** the editor selects “View completed reviews,” **Then** all completed reviews for that paper are displayed.
2. **Given** a paper has both completed and pending reviews, **When** the editor views completed reviews, **Then** only completed reviews are shown and pending reviews are excluded.

---

### User Story 2 - See an empty state when no completed reviews exist (Priority: P2)

As an editor, I want to know when no completed reviews are available so I can return later.

**Why this priority**: Clear feedback prevents confusion and reduces unnecessary support requests.

**Independent Test**: Can be tested by selecting a paper with zero completed reviews and verifying the empty state message.

**Acceptance Scenarios**:

1. **Given** an editor selects a paper with zero completed reviews, **When** the editor views completed reviews, **Then** the system shows a clear “no completed reviews” message and no error.

---

### User Story 3 - Handle access and retrieval failures safely (Priority: P3)

As an editor, I want access to reviews to be protected and failures to be clearly explained without leaking information.

**Why this priority**: Protects confidentiality and maintains trust when errors occur.

**Independent Test**: Can be tested by attempting access to an unauthorized paper and by simulating a review-retrieval failure.

**Acceptance Scenarios**:

1. **Given** an editor is not authorized to manage a paper, **When** they attempt to view completed reviews, **Then** access is denied and no review content is shown.
2. **Given** a retrieval error occurs, **When** the editor views completed reviews, **Then** a user-friendly error message is shown and the failure is recorded for administrators.

---

### Edge Cases

- Paper has zero completed reviews while some reviews are pending.
- Paper has multiple completed reviews; all are shown exactly once.
- Editor attempts to access reviews for a paper outside their permissions.
- Review retrieval fails due to a temporary system issue.

## Requirements *(mandatory)*

### Definitions

- **Completed review**: A review with status = Submitted (or an equivalent “submitted” state). Only completed reviews are displayed.
- **Assigned editor**: The single editor recorded as responsible for the paper (e.g., Paper.assigned_editor_id / managing editor). Only this editor may view completed reviews.

### Functional Requirements

- **FR-001**: The system MUST allow an authenticated editor to request completed reviews for a selected paper they manage.
- **FR-002**: The system MUST display all completed reviews (status = Submitted) for the selected paper and exclude reviews that are not completed.
- **FR-003**: The system MUST present the review content as submitted, including all required review fields defined by the active Review Form used for submissions (UC-13 / current review form schema).
- **FR-004**: The system MUST display a clear empty-state message when no completed reviews exist for the paper.
- **FR-005**: The system MUST deny access to review content when the editor is not authorized to manage the paper.
- **FR-006**: The system MUST show a user-friendly error message when reviews cannot be retrieved, including a brief failure statement, a suggested next step, and safe navigation back to the paper page, and MUST record the failure for administrative review.
- **FR-007**: The system MUST avoid exposing review content or reviewer identifiers to unauthorized users.
- **FR-008**: The system MUST display reviewer identities to the editor when viewing completed reviews.
- **FR-009**: The system MUST restrict viewing of completed reviews to the paper's assigned editor (the single editor recorded as responsible for the paper).
- **FR-010**: The system MUST make completed reviews visible as soon as they are submitted, even if other assigned reviews are still pending.
- **FR-011**: Each submitted review MUST be shown once; on retrieval failure, show no partial review content.

### Key Entities *(include if feature involves data)*

- **Paper**: A submitted manuscript with metadata, current review status, and assigned editor.
- **Review**: A reviewer’s completed evaluation for a paper, including required feedback fields and completion status.
- **Editor**: A user with permission to manage papers and view their completed reviews.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Editors can reach and view completed reviews for a paper in 3 minutes or less in 95% of attempts when the system is available.
- **SC-001a**: The completed reviews view loads within 2 seconds for typical papers (<=10 reviews).
- **SC-002**: For papers with completed reviews, 100% of completed reviews are displayed and 0% of pending reviews are shown.
- **SC-003**: 100% of unauthorized access attempts to completed reviews are blocked without content leakage.
- **SC-004**: In test scenarios, 100% of retrieval failures show a user-friendly error message and are recorded for administrative follow-up.

## Assumptions

- Reviewer identity visibility follows existing CMS access rules for editors; if no explicit rule exists, reviewer identifiers are visible to editors for decision-making.
- Required review fields are defined by current review forms and must be displayed as submitted.

## Clarifications

### Session 2026-02-02

- Q: How should reviewer identities be shown to editors when viewing completed reviews? → A: Show reviewer identities to the editor.
- Q: Who is allowed to view completed reviews for a paper? → A: Only the paper's assigned editor.
- Q: When should completed reviews become visible to the editor? → A: As soon as they are submitted.
