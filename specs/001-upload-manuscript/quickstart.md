# Quickstart: Upload Manuscript File

## Purpose

Provide a lightweight, manual validation path for UC-05 without framework-specific tooling.

## Preconditions

- Author account is available and authenticated.
- An active submission exists for the author.

## Manual Validation Steps

1. Navigate to the manuscript upload step in the submission flow.
2. Upload a valid PDF (<= 7 MB) and confirm success message with attached filename.
3. Upload a valid Word document (<= 7 MB) and confirm replacement behavior.
4. Upload a valid LaTeX `.zip` (<= 7 MB) and confirm success.
5. Attempt to upload an unsupported format and confirm inline error with accepted formats.
6. Attempt to upload a file > 7 MB and confirm inline error with size limit.
7. Simulate a network interruption during upload and confirm safe failure state plus retry.
8. Retry the failed upload and confirm success.

## Expected Outcomes

- Only one active manuscript is associated with the submission.
- Errors are inline, specific, and actionable.
- No partial/corrupt uploads are attached after failures.
