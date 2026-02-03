# Quickstart: View Published Conference Schedule

## Purpose

Validate the published schedule view against UC-19 acceptance tests with a minimal manual walkthrough.

## Prerequisites

- Published schedule exists with multiple entries, each having time and location.
- At least one incomplete entry exists (missing time or location).
- Schedule view is publicly accessible without login.

## Manual Verification Steps

1. Open the schedule view as an unauthenticated user.
2. Confirm published schedule entries display with time and location.
3. Confirm entries missing time or location are not shown.
4. Confirm the “not yet published” message appears when the schedule is unpublished.
5. Simulate retrieval failure and confirm a user-friendly error plus retry action appears.
6. If day/session filters exist, verify filtering and no-results behavior.

## Expected Results

- Schedule view is accessible without login.
- Only complete entries are shown.
- Unpublished schedules show a clear availability message.
- Retrieval failure shows an error message and retry action.
- Optional filters update the visible entries correctly.
