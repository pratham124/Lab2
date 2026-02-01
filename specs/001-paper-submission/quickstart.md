# Quickstart — Paper Submission

## Purpose

Validate UC-04 submission behavior against acceptance tests for metadata validation, manuscript upload rules, and duplicate detection.

## Prerequisites

- Access to the CMS running in the target environment.
- An author test account.
- Sample manuscripts: PDF, DOCX, and LaTeX ZIP (each <= 7 MB).

## Verify (Manual)

1. Follow UC-04-AT tests in `/root/493-lab/Lab2/UC-04-AT.md`.
2. Confirm success path, validation errors, file format/size rules, and duplicate blocking within the submission window.
3. Confirm edge-case handling for session expiry, upload interruption/network loss, and invalid LaTeX ZIP.

## Expected Outcomes

- Valid submissions are saved and marked submitted.
- Invalid metadata or files are blocked with clear messages.
- Duplicate submissions within the submission window are blocked with a duplicate notice.

## Post-Release Metrics Verification

- Track SC-001..SC-004 via analytics/support dashboards after release.
