# Feature Specification: Upload Manuscript File

**Feature Branch**: `001-upload-manuscript`  
**Created**: February 1, 2026  
**Status**: Draft  
**Input**: User description: "UC-05.md UC-05-AT.md"

## User Scenarios & Testing *(mandatory)*

## Use Case Mapping *(mandatory)*

- **Primary Use Case(s)**: UC-05
- **Acceptance Tests**: UC-05-AT
- **Notes**: Updates existing use case and acceptance tests for manuscript upload behavior.

### User Story 1 - Upload a valid manuscript (Priority: P1)

An authenticated author uploads a manuscript in an accepted format during the submission flow and receives confirmation that the file is attached to their current submission.

**Why this priority**: Core submission compliance depends on a successful manuscript upload.

**Independent Test**: Can be tested by uploading a valid file and verifying it is associated with the current submission and confirmed to the author.

**Acceptance Scenarios**:

1. **Given** an authenticated author with an active submission, **When** they upload a PDF/Word/LaTeX file within size limits, **Then** the file is accepted, stored, and linked to the current submission with a success confirmation.
2. **Given** an authenticated author with an active submission, **When** they upload another valid manuscript file, **Then** the latest file is the one associated with the submission and the UI clearly indicates the attached manuscript.

---

### User Story 2 - Correct invalid file selections (Priority: P2)

An authenticated author is prevented from uploading unsupported or oversized files and is told how to correct the issue.

**Why this priority**: Submission rules must be enforced while keeping authors informed and unblocked.

**Independent Test**: Can be tested by attempting uploads of invalid format and oversized files and confirming rejection with clear guidance.

**Acceptance Scenarios**:

1. **Given** an authenticated author with an active submission, **When** they upload a file in an unsupported format, **Then** the upload is rejected with a message listing accepted formats and no file is stored.
2. **Given** an authenticated author with an active submission, **When** they upload a file larger than the maximum size, **Then** the upload is rejected with the size limit shown and no file is stored.

---

### User Story 3 - Recover from upload failures (Priority: P3)

An authenticated author can retry a manuscript upload if a network or system error interrupts the upload.

**Why this priority**: Upload failures are common and should not block submission completion.

**Independent Test**: Can be tested by simulating an upload failure and confirming a safe failure state with a retry path.

**Acceptance Scenarios**:

1. **Given** an authenticated author with an active submission, **When** a network or system error occurs mid-upload, **Then** the author sees a non-technical failure message and no partial file is associated with the submission.
2. **Given** a prior failed upload and a restored connection, **When** the author retries the upload, **Then** the upload can succeed and the submission shows the attached manuscript.

---

### Edge Cases

- What happens when an unauthenticated user attempts to access the upload step or endpoint?
- How does the system handle rapid double-submit/double-click during upload?
- What happens when a user attempts to upload multiple different manuscript files in quick succession?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow an authenticated author to upload a manuscript file during the submission workflow.
- **FR-002**: System MUST accept only the following manuscript formats: PDF, Word, and LaTeX (as a single `.zip` archive).
- **FR-003**: System MUST enforce a maximum manuscript file size of 7 MB.
- **FR-004**: System MUST validate format and size before associating a file with a submission.
- **FR-005**: System MUST associate the successfully uploaded manuscript with the author’s current submission.
- **FR-006**: System MUST provide a clear success confirmation that identifies the attached manuscript.
- **FR-007**: System MUST reject unsupported formats and display an inline error message that lists the accepted formats (PDF, Word, LaTeX `.zip`).
- **FR-008**: System MUST reject oversized files and display an inline error message that states the maximum size limit (7 MB).
- **FR-009**: System MUST ensure failed uploads do not leave partial or corrupted files associated with a submission.
- **FR-010**: System MUST allow the author to retry a failed upload without restarting the submission process, with no retry limit.
- **FR-011**: System MUST prevent unauthenticated users from uploading manuscripts.
- **FR-012**: System MUST treat the most recently uploaded valid manuscript as the active file for the submission.
- **FR-013**: System MUST prevent duplicate attachments when the upload action is triggered multiple times rapidly.
- **FR-014**: System MUST retain uploaded manuscripts indefinitely unless explicitly removed by an authorized user. Retention has no TTL and no automatic deletion; removal occurs only through an authorized action.

### 🔐 Security & Privacy Requirements

- **FR-015**: System MUST restrict access to stored manuscripts to the submitting author and authorized CMS roles only (Program Chair, Track Chair, Admin).
- **FR-016**: System MUST ensure manuscripts are not publicly accessible via direct URLs.
- **FR-017**: System MUST store manuscript files outside the public web root and prevent direct public URL access; files are accessible only via authenticated endpoints with authorization checks for the submitting author or authorized CMS roles.

### Key Entities *(include if feature involves data)*

- **Manuscript File**: The uploaded document, including filename, format, size, and upload timestamp.
- **Submission**: The current paper submission to which the manuscript is attached.
- **Author**: The authenticated user performing the upload and owner of the submission.
- **Upload Attempt**: A single upload action with status (success/failure) and failure reason when applicable.

### Assumptions

- The system supports a single active manuscript per submission; uploading a new manuscript replaces the previous one.
- LaTeX submissions are accepted as a single `.zip` archive within the allowed formats and size limit.

### Dependencies

- Author authentication and session management are available.
- A file upload service is available during submission.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 95% of valid manuscript uploads complete successfully on the first attempt.
- **SC-002**: 90% of authors can complete a valid manuscript upload in under 2 minutes.
- **SC-003**: 100% of invalid-format and oversized uploads are blocked with an actionable error message.
- **SC-004**: 100% of upload failures leave no partial or corrupted file associated with a submission.
- **SC-005**: 90% of authors who experience an upload failure can successfully retry within 5 minutes.

## Clarifications

### Session 2026-02-01

- Q: What LaTeX upload artifact should be accepted? → A: Accept a single `.zip` archive containing LaTeX sources.
- Q: Should a new upload replace an existing manuscript or keep versions? → A: Replace the existing manuscript (only one active file).
- Q: How should invalid format/size errors be presented? → A: Inline error specifying accepted formats and size limit.
- Q: How long should uploaded manuscripts be retained? → A: Retain indefinitely unless explicitly removed by an authorized user.
- Q: Should retries be limited after a failed upload? → A: Unlimited retries.
