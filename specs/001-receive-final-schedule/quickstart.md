# Quickstart: Receive Final Conference Schedule

## Purpose

Validate that authors can view final presentation details and receive notifications when the final schedule is published.

## Preconditions

- Final schedule is ready to be published.
- At least one author has an accepted paper with assigned presentation details.
- Notification channels (in-app and email) are available.

## Steps

1. Publish the final schedule as an administrator or editor (sets schedule status to published).
2. Confirm the publish response includes `publishedAt` and `notificationsEnqueuedCount`, and that notifications are enqueued only for authors with accepted papers.
3. Log in as an author with an accepted paper.
4. Navigate to the author’s submissions list.
5. Open the accepted paper and verify date, time, session, location, and timezone are shown (timezone equals the conference’s official timezone).
6. Attempt to access another author’s accepted paper and confirm access is denied.
7. Simulate a schedule retrieval error and verify the error message includes a short cause category and a clear next step (retry, check connection, or contact support/admin), with optional “Report issue.”

## Expected Results

- Notifications are sent immediately upon publication using best-effort delivery with retries.
- Presentation details are visible only after publication and only to the paper’s author.
- Schedule times are displayed in the conference’s official timezone.
- Error messages do not expose internal details and provide retry/support guidance.
