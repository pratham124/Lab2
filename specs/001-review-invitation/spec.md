# Feature Specification: Receive Review Invitation

**Feature Branch**: `001-review-invitation`  
**Created**: February 02, 2026  
**Status**: Draft  
**Input**: User description: "UC-11.md UC-11-AT.md"

## User Scenarios & Testing *(mandatory)*

## Clarifications

### Session 2026-02-02

- Q: What should happen to a review invitation after the review due date passes? → A: Automatically becomes declined.
- Q: What level of paper detail should be visible in the invitation list before acceptance? → A: Title only; abstract visible after accepting.
- Q: What error message style should be shown when invitations cannot be retrieved? → A: Generic message with retry guidance (“Try again later or refresh”).
- Q: What invitation statuses should be shown in the default invitations list view? → A: Show only pending by default; allow filtering for others.
- Q: Is login required to view the invitations list? → A: Yes, login required.

## Scope Clarifications

- Accept/Reject processing logic is in scope for UC-11; selecting either updates the invitation status.
- Invitation detail view and abstract visibility after acceptance are handled in a separate use case; UC-11 only covers the invitations list view.
- Invitation list ordering (newest first) and pagination (beyond 20 items) are required in this feature.
- Keyboard-only navigation support is required for the invitations list view.

## Use Case Mapping *(mandatory)*

- **Primary Use Case(s)**: UC-11
- **Acceptance Tests**: UC-11-AT
- **Notes**: Specifies behavior for receiving and viewing review invitations for assigned papers.

## Constitution Check

*GATE: Must pass before implementation.*

- [x] Use-case traceability: feature maps to `UC-11.md`
- [x] Acceptance tests: `UC-11-AT.md` identified for updates
- [x] MVC separation: model/view/controller boundaries planned
- [x] Vanilla stack: HTML/CSS/JS only; no frameworks or build-tool dependencies

### User Story 1 - View Pending Review Invitation (Priority: P1)

As a reviewer, I want to see my pending review invitations so I can decide whether to accept or reject each assignment.

**Why this priority**: This is the core value of the feature; without it, reviewers cannot respond to review requests.

**Independent Test**: Can be fully tested by assigning a reviewer to a paper and confirming the invitation appears with Accept/Reject options.

**Acceptance Scenarios**:

1. **Given** a reviewer is assigned to a paper, **When** the reviewer views their invitations list, **Then** the pending invitation appears with paper title and Accept/Reject options.
2. **Given** a reviewer has multiple pending invitations, **When** they view the invitations list, **Then** each invitation is listed and correctly associated with its paper.

---

### User Story 2 - Receive Invitation Notification (Priority: P2)

As a reviewer, I want to be notified when I receive a new review invitation so I don’t miss review requests.

**Why this priority**: Notifications reduce missed assignments and improve response time.

**Independent Test**: Can be tested by creating an invitation and verifying a notification is sent to the reviewer’s registered contact method.

**Acceptance Scenarios**:

1. **Given** a reviewer is assigned to a paper and notification service is available, **When** the invitation is created, **Then** the reviewer receives a notification of the invitation.

---

### User Story 3 - Secure and Resilient Access (Priority: P3)

As a reviewer, I want my invitations to remain accessible even if notifications fail, and I expect only invited reviewers to see each invitation.

**Why this priority**: Ensures reliability and protects confidentiality of submissions.

**Independent Test**: Can be tested by simulating notification failure, delayed login, and unauthorized access attempts while verifying correct visibility and messaging.

**Acceptance Scenarios**:

1. **Given** a notification failure occurs, **When** the reviewer later views their invitations, **Then** the invitation is still visible and actionable.
2. **Given** a reviewer who is not invited to a paper, **When** they attempt to access that invitation, **Then** access is denied or the invitation is not shown.
3. **Given** an invitation retrieval error occurs, **When** the reviewer views invitations, **Then** a generic error message with retry guidance is shown.

---

### Edge Cases

- Reviewer does not log in until days after the invitation is created.
- Notification delivery fails but the invitation still exists.
- Multiple invitations for different papers must be distinguishable.
- A system error prevents invitations from loading.
- A reviewer attempts to access an invitation they were not assigned.
- Review due date passes before response.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST create a review invitation when an editor assigns a reviewer to a paper.
- **FR-002**: System MUST display pending review invitations to the invited reviewer with paper title and invitation status.
- **FR-003**: System MUST provide Accept and Reject options for each pending invitation and persist the reviewer decision.
- **FR-004**: System MUST attempt to send a review invitation notification to the reviewer when an invitation is created.
- **FR-005**: System MUST keep the invitation available in the CMS even if notification delivery fails.
- **FR-006**: System MUST restrict invitation visibility to the invited reviewer.
- **FR-007**: System MUST automatically mark an invitation as declined when the review due date passes without a response.
- **FR-008**: System MUST show a generic, user-friendly error message with retry guidance when invitations cannot be retrieved.
- **FR-009**: System MUST allow reviewers with multiple invitations to view each invitation as a distinct item linked to the correct paper.
- **FR-010**: System MUST limit invitation list details to paper title prior to acceptance.
- **FR-011**: System MUST show only pending invitations by default and allow filtering to view non-pending invitations.
- **FR-012**: System MUST require the reviewer to be logged in to view invitations.
- **FR-013**: System MUST order invitations newest first and support pagination beyond 20 items.
- **FR-014**: System MUST include paper title and response due date in invitation notifications.

### Assumptions

- The reviewer’s registered contact method is used for invitation notifications.

### Key Entities *(include if feature involves data)*

- **Review Invitation**: Represents a request to review a paper; includes status (pending/accepted/rejected/declined/expired), created date, and response deadline.
- **Reviewer**: Registered user who can view and respond to invitations; includes contact information.
- **Paper**: The submission being reviewed; includes identifier, title, and abstract.
- **Notification**: The outbound message informing a reviewer about a new invitation and its delivery status.

### Non-Functional Requirements

- **NFR-001**: Invitation list loads within 2 seconds under normal load.
- **NFR-002**: Invitations are visible to the invited reviewer within 1 minute of assignment.
- **NFR-003**: Invitations list is keyboard accessible (tab order, focus states, and actionable controls usable without a mouse).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of reviewers can locate a pending invitation within 2 minutes of logging in during usability testing.
- **SC-002**: 99% of invitations are visible to the invited reviewer within 1 minute of assignment in controlled tests.
- **SC-003**: 98% of invitation notifications are delivered successfully when the notification service is available.
- **SC-004**: 100% of access attempts by non-invited reviewers are blocked in authorization tests.
- **SC-005**: 100% of invitation retrieval failures display a generic message with retry guidance in testing.
