# Data Model: Upload Manuscript File

## Entities

### Submission

- **Purpose**: Represents an in-progress or submitted paper by an author.
- **Key Fields**:
  - `id` (unique identifier)
  - `authorId`
  - `status` (e.g., in-progress, submitted)
  - `activeManuscriptId` (nullable when none uploaded)
  - `updatedAt`
- **Relationships**:
  - One `Submission` has zero or one active `ManuscriptFile`.

### ManuscriptFile

- **Purpose**: Stores the uploaded manuscript associated with a submission.
- **Key Fields**:
  - `id` (unique identifier)
  - `submissionId`
  - `originalFilename`
  - `format` (pdf, doc/docx, latex-zip)
  - `sizeBytes`
  - `uploadedAt`
  - `uploadedByAuthorId`
  - `isActive` (boolean; only one active per submission)
- **Validation Rules**:
  - `format` must be one of: PDF, Word, LaTeX `.zip`.
  - `sizeBytes` must be <= 7 MB.
  - Only one active manuscript per submission.
  - Access to manuscript files is limited to the submitting author and authorized CMS roles.

### UploadAttempt

- **Purpose**: Tracks a single upload attempt for observability and user feedback.
- **Key Fields**:
  - `id`
  - `submissionId`
  - `authorId`
  - `attemptedAt`
  - `status` (success, failed)
  - `failureReason` (nullable)

## State Transitions

- **Submission**: `in-progress` → `submitted` (unchanged by upload; upload only updates manuscript attachment).
- **ManuscriptFile**: `inactive` → `active` when set as latest upload; previous active becomes inactive.
- **UploadAttempt**: `failed` → new `success` or `failed` on retry (attempts are independent).
