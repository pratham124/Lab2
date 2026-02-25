# Feature Specification: Access Assigned Papers for Review

**Feature Branch**: `001-uc-12-specs`  
**Created**: 2026-02-02  
**Status**: Draft  
**Input**: User description: "UC-12.md UC-12-AT.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View assigned papers list (Priority: P1)

As a reviewer who has accepted invitations, I want to see the list of papers assigned to me so I know what I need to review.

**Why this priority**: Reviewers cannot begin their work without knowing their assignments.

**Independent Test**: Log in as a reviewer with assigned papers and confirm the list is displayed with identifiable items.

**Acceptance Scenarios**:

1. **Given** a reviewer is logged in and has at least one assigned paper, **When** they open the assigned papers page, **Then** the system shows a list containing all assigned papers by title.
2. **Given** a reviewer is logged in and has multiple assigned papers, **When** they open the assigned papers page, **Then** all assigned papers appear without duplicates or omissions.

---

### User Story 2 - Open an assigned paper (Priority: P2)

As a reviewer, I want to open a paper from my assigned list so I can read its content and prepare my review.

**Why this priority**: Access to the paper content is required to perform the review task.

**Independent Test**: From the assigned list, open a specific assigned paper and confirm the content and review-relevant information are displayed.

**Acceptance Scenarios**:

1. **Given** a reviewer is logged in and a paper is assigned to them, **When** they select that paper, **Then** the full paper content and relevant review information are displayed.
2. **Given** a reviewer is logged in and a paper is assigned but its manuscript is unavailable, **When** they attempt to open it, **Then** the system shows a clear error and returns them safely to the assigned list.

---

### User Story 3 - Handle access issues safely (Priority: P3)

As a reviewer, I want clear feedback when I have no assignments or when access is denied so I understand what to do next.

**Why this priority**: Clear feedback prevents confusion and supports secure access boundaries.

**Independent Test**: Test empty assignments and unauthorized access attempts and confirm clear messages are shown without exposing content.

**Acceptance Scenarios**:

1. **Given** a reviewer is logged in and has no assigned papers, **When** they open the assigned papers page, **Then** the system displays a clear empty-state message and no list items.
2. **Given** a reviewer is logged in but attempts to access a paper not assigned to them, **When** they request that paper, **Then** an “Access denied” message is shown, the paper content is not displayed, and they remain within reviewer pages.
3. **Given** a reviewer is logged in and an assignment retrieval error occurs, **When** they open the assigned papers page, **Then** a clear error message is shown and they are not shown partial or incorrect data.

---

### Edge Cases

- Reviewer has accepted invitations but currently has zero active assignments.
- Multiple assigned papers should all appear with unique identifiers.
- Attempt to access an unassigned paper via direct link shows “Access denied” and no content.
- Assignment retrieval fails due to temporary system issues.
- Assigned paper exists but its manuscript is unavailable.

## Use Case Mapping *(mandatory)*

- **Primary Use Case(s)**: UC-12
- **Acceptance Tests**: UC-12-AT
- **Notes**: This feature specifies behavior already covered by UC-12 and its acceptance tests.

## Clarifications

### Session 2026-02-02

- Q: What response should reviewers receive when they try to access an unassigned paper? → A: Show “Access denied” and keep the user in the reviewer area.
- Q: Should reviewers be able to download assigned papers or only view them in the system? → A: View-only in the system (no download).
- Q: What identifiers should be shown in the assigned papers list? → A: Title only.
- Q: Are there any additional user roles involved in this feature besides “Reviewer”? → A: None.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a logged-in reviewer to view a list of papers assigned to them.
- **FR-002**: System MUST display each assigned paper by title only in the assigned papers list.
- **FR-003**: System MUST allow a reviewer to open and view the full content of a paper assigned to them.
- **FR-003a**: System MUST provide view-only access to assigned papers and MUST NOT provide download capability as part of this feature.
- **FR-004**: System MUST prevent reviewers from viewing papers not assigned to them and return “Access denied” (treated as a 403 response), while keeping them within reviewer pages.
- **FR-005**: System MUST show a clear empty-state message when a reviewer has no assigned papers.
- **FR-006**: System MUST display a clear retrieval error message that includes (1) a brief failure statement (e.g., “Unable to load assigned papers”), (2) a suggested next step (e.g., “Please try again later”), and (3) a visible link/button that returns to the assigned papers list.
- **FR-007**: System MUST display a clear manuscript-unavailable message that includes (1) a brief failure statement (e.g., “Manuscript unavailable”), (2) a suggested next step, and (3) a visible link/button that returns to the assigned papers list.

### Key Entities *(include if feature involves data)*

- **Reviewer**: Authenticated user who has accepted review invitations and can access assigned papers.
- **Paper**: Submission assigned for review, including title/ID and manuscript content.
- **Assignment**: Link between reviewer and paper indicating authorization to access the paper.
- **Manuscript**: The full content of a paper that is viewable by assigned reviewers.

## Assumptions

- Offline downloads are not part of this feature scope (view-only access).
- Reviewers can access only their own assigned papers.
- The list of assigned papers is the primary entry point for opening paper content.
- No additional user roles are involved beyond Reviewer.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-002**: 100% of attempts to access unassigned papers are blocked and do not display paper content.
- **SC-003**: 90% of reviewers can open at least one assigned paper on their first attempt without assistance.
- **SC-004**: When a reviewer has no assignments, the empty-state message is displayed in 100% of such cases.
