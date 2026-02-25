# Quickstart: View Completed Reviews for a Paper

## Goal
Validate that an assigned editor can view completed reviews, with correct access control, empty state handling, and safe error messaging.

## Preconditions
- An editor account assigned to a paper
- A paper with at least one submitted review
- A paper with no submitted reviews
- A paper not assigned to the editor

## Steps
1. Log in as the assigned editor.
2. Open the submitted papers list and select a paper with completed reviews.
3. Choose “View completed reviews.”
4. Confirm all submitted reviews appear and include reviewer identities.
5. Open a paper with no completed reviews and confirm the empty-state message.
6. Attempt to view reviews for a paper not assigned to the editor and confirm access is denied.
7. Simulate a retrieval failure and confirm a user-friendly error message appears.

## Expected Results
- Completed reviews are visible immediately after submission.
- Pending reviews are not shown.
- Reviewer identities are visible to the assigned editor.
- Unauthorized access is blocked without leaking review content.
- Errors are shown clearly and recorded for administrators.
