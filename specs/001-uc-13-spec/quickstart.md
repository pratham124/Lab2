# Quickstart: Submit Completed Review Form

## Purpose
Validate the UC-13 flow end-to-end using manual acceptance tests.

## Preconditions
- Reviewer `R1` exists, is logged in, and has accepted an invitation for paper `P1`.
- Paper `P1` is assigned to `R1` and has an associated review form.
- Editor `E1` exists and has access to `P1`.

## Steps
1. Log in as reviewer `R1`.
2. Navigate to assigned papers and open `P1`.
3. Complete all required fields and submit the review.
4. Confirm the success message and that the review cannot be edited or resubmitted.
5. Log in as editor `E1` and verify the review is visible immediately.

## Validation
- Use the scenarios in `UC-13-AT.md` as the acceptance checklist.
