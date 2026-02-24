# Quickstart: Save Submission Draft

## Goal
Validate draft save, resume, and update flow for an authenticated author.

## Prerequisites
- A registered author account
- Ability to open the submission form

## Manual Smoke Check

1. Open `/submissions/new` and enter partial data.
2. Click **Save Draft** and confirm success + `Last saved` timestamp.
3. Reload `/submissions/new?draft=<submissionDraftId>` and verify fields pre-populate.
4. Change one field and save again; confirm same draft is updated.
5. Attempt access to the draft as another author; confirm access is denied.

## API Smoke Check

1. `PUT /submissions/{submissionId}/draft` with `{ data: { ... } }`.
2. `GET /submissions/{submissionId}/draft` as owner returns saved payload.
3. Repeat `PUT` rapidly with same idempotency key and verify no duplicate draft creation.
