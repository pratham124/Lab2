# Feature Specification: Send Decision Notification

**Feature Branch**: `002-send-decision-notification`  
**Created**: 2026-02-03  
**Status**: Draft  
**Input**: User description: "UC-15.md UC-15-AT.md"

## Clarifications

### Session 2026-02-03

- Q: Can editors change a final decision after it has been sent? → A: Decision is final once sent (no changes allowed).
- Q: When a notification fails, should the system auto-retry delivery? → A: No auto-retry; editor must manually resend.
- Q: Should the decision be visible to authors immediately once recorded, even if notification failed? → A: Yes, visible immediately after recording.
- Q: How should the system treat partial notification delivery (some co-authors receive, others fail)? → A: Treat as partial success; show which authors failed.
- Q: Should resending notifications be allowed only for failed recipients, or always to all authors? → A: Resend only to authors who failed to receive.

## User Scenarios & Testing *(mandatory)*

## Use Case Mapping *(mandatory)*

- **Primary Use Case(s)**: UC-15
- **Acceptance Tests**: UC-15-AT
- **Notes**: Existing use case and acceptance tests will be implemented as written.

### User Story 1 - Send Final Decision to Authors (Priority: P1)

As an editor, I want to record and send the final acceptance or rejection decision for a paper so authors are informed of the outcome.

**Why this priority**: This is the primary value of the feature and the core editorial workflow outcome.

**Independent Test**: Can be fully tested by an editor sending a decision on a paper with completed reviews and verifying the decision is stored and the authors are notified.

**Acceptance Scenarios**:

1. **Given** a paper with all required reviews complete and an editor assigned, **When** the editor records and sends an acceptance decision, **Then** the decision is stored, all authors are notified of acceptance, and the editor sees a success confirmation.
2. **Given** a paper with all required reviews complete and an editor assigned, **When** the editor records and sends a rejection decision, **Then** the decision is stored, all authors are notified of rejection, and the editor sees a success confirmation.
3. **Given** a non-editor user, **When** they attempt to access decision sending, **Then** access is denied and no decision is recorded or sent.
4. **Given** a completed paper and a decision ready to send, **When** the editor triggers send twice, **Then** the decision is recorded once and authors receive at most one notification.

---

### User Story 2 - Block Decisions When Reviews Are Incomplete (Priority: P2)

As an editor, I want the system to prevent sending a final decision until all required reviews are complete so decisions are based on complete evaluations.

**Why this priority**: Prevents premature decisions and protects process integrity.

**Independent Test**: Can be tested by attempting to send a decision for a paper with pending reviews and verifying no decision is stored or sent.

**Acceptance Scenarios**:

1. **Given** a paper with one or more required reviews pending, **When** the editor attempts to send a final decision, **Then** the system blocks the action with a clear message and no decision is stored or sent.

---

### User Story 3 - Preserve Decisions Despite Notification Failures (Priority: P3)

As an editor, I want the decision to remain recorded even if author notification fails so the outcome is not lost and can be resent.

**Why this priority**: Ensures decisions are not lost and editors are aware of delivery issues.

**Independent Test**: Can be tested by simulating a notification failure after decision storage and verifying the decision remains visible and the editor is informed.

**Acceptance Scenarios**:

1. **Given** a paper with completed reviews, **When** the editor sends a decision and notification fails, **Then** the decision remains stored and the editor is informed of the notification failure.
2. **Given** a paper with completed reviews and a recorded decision with prior notification failure, **When** the editor retries sending the notification, **Then** the system attempts delivery without altering the recorded decision.
3. **Given** a storage failure occurs while sending a decision, **When** the editor submits the final decision, **Then** no decision is recorded, no notification is sent, and the editor is informed of the failure.

---

### User Story 4 - Authors Can View Recorded Decisions (Priority: P3)

As an author, I want to view the final decision in the system after it has been recorded so I can confirm the outcome even if email delivery fails.

**Why this priority**: Provides a reliable, in-system source of truth for the decision.

**Independent Test**: Can be tested by logging in as an author after a decision is recorded and verifying the decision is visible on the submission.

**Acceptance Scenarios**:

1. **Given** a recorded decision for a paper, **When** an author views their submission, **Then** the correct decision is displayed.

---

### Edge Cases

- What happens when the editor clicks send twice quickly for the same paper?
- How does the system handle a storage failure while attempting to record the decision?
- What happens when an author has multiple co-authors and only some notifications can be delivered?

## Requirements *(mandatory)*

### Definitions

- **Required reviews complete**: A paper is eligible only when `count(status=Submitted) >= required_review_count` and no required assignment remains in `Pending`, `Invited`, or `InProgress` status.
- **Decision finality**: A decision becomes final when it is persisted successfully; it cannot be changed afterward. Notification success or failure does not affect finality. Authors can view the decision immediately after persistence (defined as within 1 minute).

### Functional Requirements

- **FR-001**: System MUST allow an editor to record a final decision of accept or reject for a paper with completed required reviews.
- **FR-002**: System MUST block decision sending when any required review for the paper is incomplete and provide a clear message to the editor.
- **FR-003**: System MUST restrict decision sending to editor roles only.
- **FR-004**: System MUST persist the recorded decision with the paper so it is retrievable later.
- **FR-005**: System MUST notify all listed authors of the recorded decision when delivery services are available.
- **FR-006**: System MUST inform the editor whether the notification was sent successfully or failed, using statuses of sent or failed.
- **FR-014**: If notifications are partially delivered, System MUST report partial success and identify which authors failed to receive the notification, using a status of partial.
- **FR-007**: If notification fails after decision storage, System MUST keep the decision recorded and allow later resend attempts.
- **FR-015**: Resend attempts MUST target only authors who did not receive the notification previously.
- **FR-012**: System MUST not auto-retry failed notifications; only an editor-initiated resend is allowed.
- **FR-008**: If decision storage fails, System MUST not send notifications and MUST inform the editor of the failure.
- **FR-009**: Authors MUST be able to view the final decision for their submissions in the system once recorded; the decision MUST be visible immediately after recording (within 1 minute), regardless of notification delivery success.
- **FR-010**: System MUST prevent duplicate notifications for the same decision when duplicate send attempts occur.
- **FR-011**: System MUST prevent editors from changing a final decision after it has been sent.
- **FR-016**: Author decision views MUST show the decision outcome (accept/reject), paper title/id, and decision timestamp, and MUST NOT show review content, reviewer identities, reviewer comments/scores, or internal notes.

### Key Entities *(include if feature involves data)*

- **Paper**: Submission under review, includes identifier, title, and associated authors.
- **Decision**: Final outcome for a paper (accept/reject), recorded timestamp, and decision status.
- **Review Status**: Indicates whether required reviews are completed for a paper.
- **Author**: User associated with a paper who receives and views the decision.
- **Notification Attempt**: Record of delivery outcome for notifying authors of the decision.
  - **Fields**: attempt_id, paper_id, decision_id, author_id, delivery_status (Pending/Delivered/Failed), attempt_timestamp, failure_reason (nullable)
  - **Rules**:
    - One attempt record per author per send attempt.
    - Resend creates new attempts only for authors whose latest status is Failed.
    - Attempts never modify the stored decision.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of editor decision submissions receive a visible success or failure confirmation within 10 seconds.
- **SC-002**: 100% of recorded decisions are visible to authors in the system within 1 minute of being recorded.
- **SC-003**: 0 unauthorized (non-editor) users can successfully record or send decisions in quarterly access audits.
- **SC-004**: At least 98% of decision notifications are delivered to all listed authors within 5 minutes when delivery services are operational.

## Assumptions

- Decision notifications include only the accept/reject outcome and the paper identifier/title, not reviewer comments or rationale.
- Editors have already determined the final decision before sending.

## Dependencies

- User authentication and role management are available to distinguish editors from non-editors.
- Review completion status is available for each paper.
- A notification delivery service exists to attempt author notifications.

## Out of Scope

- Editing a final decision after it is recorded.
- Appeals or reconsideration workflows.
- Batch sending decisions for multiple papers at once.
- Messaging content beyond the decision outcome.
