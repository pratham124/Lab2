# Quickstart: Receive Final Paper Decision

## Prerequisites

- Node and npm installed
- From repo root: `npm test` and `npm run lint`

## Manual Test Scenarios

### Scenario 1: Decision visible only after publish

1. Ensure a paper has a final decision recorded with no `published_at`.
2. Log in as the submitting author and view the submissions list.
3. Confirm no decision value is shown.
4. Set `published_at` for the decision.
5. Refresh and confirm the decision is shown.

### Scenario 2: Notification to submitting author only

1. Publish a decision for a paper.
2. Verify only the submitting author receives the email notification.
3. Confirm no other recipients receive the email.

### Scenario 3: Notification failure does not block decision visibility

1. Simulate email/notification service failure.
2. Publish a decision for a paper.
3. Verify notification status is recorded as failed.
4. Log in as the submitting author and verify the decision is still visible.

### Scenario 4: Retrieval failure message and no decision exposure

1. Simulate a decision retrieval failure for a published decision.
2. Attempt to view the decision as the submitting author.
3. Confirm the UI shows: "Decision temporarily unavailable. Please try again later."
4. Confirm no decision value is shown and no internal IDs or stack traces appear.

### Scenario 5: Reviewer comments not shown

1. Ensure reviewer comments exist for the paper.
2. View the final decision as the submitting author.
3. Confirm no reviewer comments are displayed or returned.

### Scenario 6: Manual performance check (decision view load time)

1. Publish a decision for a paper.
2. Log in as the submitting author and open "My Submissions."
3. Measure time from request start to decision rendering.
4. Verify response renders within 1 second for expected environment conditions.
