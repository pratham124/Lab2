# Feature Specification: Receive Final Conference Schedule

**Feature Branch**: `001-receive-final-schedule`  
**Created**: February 3, 2026  
**Status**: Draft  
**Input**: User description: "UC-18.md UC-18-AT.md"

## User Scenarios & Testing *(mandatory)*

## Use Case Mapping *(mandatory)*

- **Primary Use Case(s)**: UC-18
- **Acceptance Tests**: UC-18-AT
- **Notes**: Existing use case and acceptance tests; no new use case required.

## Clarifications

### Session 2026-02-03

- Q: What timezone should be used when displaying final schedule times? → A: Show times in the conference’s official timezone only.
- Q: Which notification channel(s) should be used when the final schedule is published? → A: Use both in-app and email notifications.
- Q: Who should receive the final schedule notification? → A: Only authors with accepted papers.
- Q: When should notifications be sent relative to schedule publication? → A: Send immediately upon publication.
- Q: Should authors see schedule details before the final schedule is published? → A: Hide schedule details until the final schedule is published.

### User Story 1 - View Final Schedule Details (Priority: P1)

An author with an accepted paper can view the final presentation details (date, time, session, location, timezone) once the schedule is published.

**Why this priority**: This is the core value: authors need to know when and where to present.

**Independent Test**: Can be tested by publishing the schedule and verifying a single accepted paper shows complete presentation details to its author.

**Acceptance Scenarios**:

1. **Given** an author has an accepted paper and the final schedule is published, **When** the author opens their accepted paper, **Then** the system shows the paper’s date, time, session, location, and timezone.
2. **Given** the final schedule is published, **When** the author attempts to view another author’s accepted paper, **Then** access is denied and no schedule details are shown.

---

### User Story 2 - Receive Schedule Availability Notification (Priority: P2)

An author is notified when the final schedule becomes available.

**Why this priority**: Proactive notification reduces uncertainty and support requests.

**Independent Test**: Can be tested by publishing the schedule and verifying an author with an accepted paper receives a notification.

**Acceptance Scenarios**:

1. **Given** the final schedule is published and notification services are available, **When** the schedule is published, **Then** authors with accepted papers are notified that the final schedule is available.

---

### User Story 3 - View Details for Multiple Accepted Papers (Priority: P3)

An author with multiple accepted papers can view the final presentation details for each accepted paper.

**Why this priority**: Authors may present multiple papers and need a complete, accurate view.

**Independent Test**: Can be tested by assigning two accepted papers to one author and confirming each paper shows its own schedule details.

**Acceptance Scenarios**:

1. **Given** an author has multiple accepted papers and the final schedule is published, **When** the author opens each accepted paper, **Then** each paper displays its own correct date, time, session, and location.

---

### Edge Cases

- What happens when notification delivery fails at publish time? The author can still access schedule details through the CMS.
- How does the system handle a schedule retrieval error? The author sees a clear error and can retry later.
- What happens when the author has not logged in immediately after notification? Schedule details remain available later.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow authors with accepted papers to view final presentation details for each accepted paper after the schedule is published.
- **FR-002**: Presentation details MUST include date, time, session, and location for the paper.
- **FR-003**: System MUST notify authors with accepted papers when the final schedule is published.
- **FR-004**: System MUST restrict access so authors can only view schedule details for their own accepted papers.
- **FR-005**: If notification delivery fails, the system MUST still allow authors to access schedule details through the CMS.
- **FR-006**: If schedule details cannot be retrieved, the system MUST display a user-friendly error message that includes a short cause category (e.g., “Service unavailable”) and a clear next step (retry, check connection, or contact support/admin), without exposing internal details. The error message MUST include retry guidance and MAY include a “Report issue” support path.
- **FR-007**: The system MUST log notification failures and schedule retrieval errors for administrative review.
- **FR-008**: Schedule times MUST be displayed in the conference’s official timezone.
- **FR-009**: The system MUST notify authors via both in-app and email when the final schedule is published.
- **FR-010**: Notifications MUST be sent only to authors with accepted papers.
- **FR-011**: Notifications MUST be sent immediately upon schedule publication.
- **FR-012**: Schedule details MUST remain hidden until the final schedule is published.
- **FR-013**: After publication, schedule details MUST remain accessible regardless of when the author logs in.
- **FR-014**: The publish action MUST return the publication timestamp and the count of notifications enqueued.

### Key Entities *(include if feature involves data)*

- **Author**: Registered user who has one or more accepted papers.
- **Paper**: Submission that has been accepted and linked to presentation details.
- **Final Schedule**: Published schedule containing presentation details for accepted papers.
- **Presentation Details**: Date, time, session, and location assigned to a paper.
- **Notification**: Message sent to authors indicating the final schedule is available.

## Dependencies

- An administrator or editor triggers “Publish Final Schedule,” which sets the schedule to published and enables access and notifications.
- Notification services are available to send schedule-available messages.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of authors with accepted papers can locate their presentation details within 2 minutes of logging in after schedule publication.
- **SC-002**: 100% of accepted papers in the final schedule display complete presentation details (date, time, session, location) to their respective authors.
- **SC-003**: When notification services are available, at least 98% of authors with accepted papers receive a schedule-available notification within 15 minutes of publication.
- **SC-004**: 0 confirmed incidents of authors accessing another author’s schedule details during acceptance testing.
- **SC-005**: 95% of authors can load presentation details within 2 seconds for typical load (<= 100 submissions).

## Non-Functional Requirements

- **NFR-001**: Notification delivery MUST use best-effort delivery with retries on transient failures.

## Assumptions

- Viewing or downloading the full conference schedule, calendar invitations, and public schedule access without login are out of scope for this feature.
- The schedule is considered final only after explicit publication by an administrator or editor.
