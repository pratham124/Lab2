# Quickstart: Save Submission Draft

## Goal
Validate the draft save/resume flow for an author in the CMS.

## Prerequisites
- A registered author account
- Ability to start a new submission

## Manual Smoke Check

1. Start a new submission and fill any subset of fields.
2. Choose **Save**.
3. Confirm a success message and that the draft appears in the author’s submissions list.
4. Log out and log back in.
5. Reopen the draft and verify saved fields are pre-populated.
6. Edit one field and save again; confirm the same draft is updated.

## Acceptance Tests
Run the documented acceptance tests in `UC-06-AT.md` to verify full coverage, including validation failures, access control, and save failure handling.
