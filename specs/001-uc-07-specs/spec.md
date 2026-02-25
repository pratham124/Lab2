# Feature Specification: Receive Final Paper Decision

**Feature Branch**: `001-decision-publish-clarify`  
**Created**: 2026-02-01  
**Status**: Draft  
**Input**: User description: "UC-07.md UC-07-AT.md"

## User Scenarios & Testing *(mandatory)*

### Overview

- P1: Submitting author views the final decision only after official publication.
- P2: Submitting author receives a single email notification at publish time.
- P3: Unauthorized access and retrieval failures are handled safely without exposing decision data.

### Testing Approach

- Validate publish-gated visibility in the submissions list and paper detail view.
- Verify email notifications are sent only to the submitting author at publish time.
- Simulate retrieval failures and unauthorized access to confirm safe messaging and no decision exposure.

## Use Case Mapping *(mandatory)*

- **Primary Use Case(s)**: UC-07
- **Acceptance Tests**: UC-07-AT
- **Notes**: Aligns to the existing UC-07 flow for author decision visibility and notification.

## Clarifications

### Session 2026-02-01

- Q: Which authors can view the final decision? → A: Only the submitting author.
- Q: Which notification channel should be used by default? → A: Email only.
- Q: Should reviewer comments be shown with the final decision? → A: No, do not show reviewer comments.
- Q: When should the decision be visible to authors? → A: When the decision is officially published to authors.
- Q: Who should receive decision emails? → A: Only the submitting author.
- Q: Are there co-authors on submissions? → A: No, each submission has a single author only.

### User Story 1 - View Final Decision in CMS (Priority: P1)

As the submitting author of a paper, I want to see the final accept/reject decision in my submissions list so I can understand the outcome of the review process.

**Why this priority**: This is the core user value of the feature and is required for authors to receive results.

**Independent Test**: Create a final decision for a submitted paper and verify the submitting author can view the decision from their submissions page.

**Acceptance Scenarios**:

1. **Given** a submitted paper with a recorded final decision, **When** the submitting author opens their submissions list, **Then** the decision is displayed clearly as Accepted or Rejected.
2. **Given** a submitted paper with a recorded final decision, **When** the submitting author opens the paper details, **Then** the decision shown matches the recorded decision.

---

### User Story 2 - Receive Decision Notification (Priority: P2)

As an author, I want to be notified when a final decision is recorded so I know to check my submission status.

**Why this priority**: Timely awareness improves author experience but the decision should still be accessible without the notification.

**Independent Test**: Record a final decision and verify a notification attempt is made to the submitting author and is delivered when the notification service is available.

**Acceptance Scenarios**:

1. **Given** a final decision is recorded for a paper, **When** the decision is saved, **Then** the system sends an email notification to the submitting author that a decision is available.

---

### User Story 3 - Handle Access and Retrieval Failures (Priority: P3)

As an author, I want the system to safely handle access and retrieval issues so I am not shown incorrect information.

**Why this priority**: Protects data privacy and ensures trustworthy decision visibility.

**Independent Test**: Attempt to access a decision as a non-submitting author and simulate a retrieval failure; verify the system blocks access and shows a clear error without exposing details.

**Acceptance Scenarios**:

1. **Given** a paper was submitted by another author, **When** a different author attempts to access the decision, **Then** access is denied or the decision is not shown.
2. **Given** a decision retrieval error occurs, **When** the submitting author tries to view the decision, **Then** a clear error message is shown and no decision is displayed.

---

### Edge Cases

- Notification fails to send, but the decision remains available in the CMS.
- Author does not log in immediately; decision remains available later.
- Decision retrieval fails; the system shows an error and does not show an incorrect decision.
- An unauthorized author attempts to access the decision by direct link or guessing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST display the final decision (Accepted or Rejected) for a submitted paper to the submitting author in the CMS only when officially published.
- **FR-002**: The system MUST ensure the displayed decision matches the recorded final decision for the paper.
- **FR-003**: The system MUST send an email notification only to the submitting author when a final decision is officially published to authors.
- **FR-004**: The system MUST keep the final decision accessible to the submitting author even if notification delivery fails.
- **FR-005**: The system MUST allow the submitting author to view the decision at any later time after it is officially published.
- **FR-006**: The system MUST prevent non-submitting authors from viewing the decision for a paper they did not submit.
- **FR-007**: The system MUST present a clear, user-friendly error message if the decision cannot be retrieved.
- **FR-008**: The system MUST not display a decision when retrieval fails.
- **FR-009**: The system MUST not display reviewer comments alongside the final decision.

### Key Entities *(include if feature involves data)*

- **Paper**: A submitted manuscript owned by a specific author.
- **Final Decision**: The recorded outcome for a paper (Accepted or Rejected) associated with a paper.
- **Author**: The user who submitted the paper and is entitled to view the decision.
- **Notification**: A message indicating that a decision is available for viewing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of submitting authors can locate and view their final decision within 2 minutes of logging in.
- **SC-002**: 99% of displayed decisions match the recorded decision value in audit checks.
- **SC-003**: When notification delivery is available, 90% of decision notifications are delivered within 5 minutes of decision recording.
- **SC-004**: 100% of decision retrieval failures show a user-friendly error message and no decision content.

## Assumptions

- Decision notifications inform the author that a decision is available without including reviewer comments.
- Notification is delivered via email only.
- Each submission has a single author; co-authors are not supported.

## Dependencies

- Final decisions are recorded by editors before authors attempt to view them.
- Notification delivery service is operational for notification success scenarios.
