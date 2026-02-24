# Data Model — Paper Submission

## Entities

### Author

- **Represents**: The single submitting user.
- **Key fields**: author_id, name, affiliation, contact_email.
- **Relationships**: 1 Author → many PaperSubmissions.

### PaperSubmission

- **Represents**: A submitted paper and its metadata.
- **Key fields**: submission_id, author_id, title, abstract, keywords, status, submission_window_id, created_at.
- **Relationships**: 1 PaperSubmission → 1 ManuscriptFile.
- **Validation rules**:
  - title, abstract, keywords, affiliation, contact_email are required.
  - status transitions: draft → submitted (no edits after submitted).
  - duplicate check: within the same submission_window_id, prevent another submission by the same author for the same title and/or the same manuscript content hash.

### ManuscriptFile

- **Represents**: The uploaded manuscript file.
- **Key fields**: file_id, submission_id, filename, format, size_bytes, content_hash.
- **Validation rules**:
  - format in {PDF, DOCX, LaTeX ZIP}.
  - size_bytes <= 7 MB.

## Submission Window

- **Represents**: Official conference open/close dates used for duplicate checks.
- **Key fields**: submission_window_id, opens_at, closes_at, conference_id.

## State Transitions

- **PaperSubmission**: draft → submitted.
- **Failure handling**: validation or storage failure leaves submission unsubmitted.
