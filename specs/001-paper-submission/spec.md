# Feature Specification: Paper Submission

**Feature Branch**: `001-paper-submission`  
**Created**: February 1, 2026  
**Status**: Draft  
**Input**: User description: "UC-04.md"

## Clarifications

### Session 2026-02-01

- Q: What manuscript formats are accepted for submission? → A: PDF, DOCX, and LaTeX source (ZIP).
- Q: Who can edit a paper submission before it is submitted? → A: Single author only; each paper has exactly one author.
- Q: How should the system handle duplicate submissions in the same submission window? → A: Block duplicates in the same submission window.
- Q: How should validation errors be shown to the author? → A: Block submit and highlight invalid fields only.
- Q: What defines the submission window for duplicate checks? → A: The official conference submission window (open/close dates).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Submit a new paper (Priority: P1)

As a logged-in author, I want to submit a paper with all required metadata and a manuscript file so the paper can enter the review process.

**Why this priority**: This is the core value of the CMS for authors and is required for the review pipeline to start.

**Independent Test**: Can be fully tested by completing a valid submission and confirming the paper is marked as submitted.

**Acceptance Scenarios**:

1. **Given** a logged-in author on the submission form, **When** the author provides all required metadata and a valid manuscript file and submits, **Then** the paper is saved, marked as submitted for review, and a confirmation is shown before returning the author to their home page.
2. **Given** a logged-in author on the submission form, **When** the author submits with all required fields completed but no manuscript file, **Then** the system prevents submission and shows a clear error indicating the missing file.

---

### User Story 2 - Resolve validation issues and resubmit (Priority: P2)

As a logged-in author, I want clear feedback when metadata or file requirements are invalid so I can correct issues and complete submission.

**Why this priority**: Error recovery prevents abandoned submissions and reduces support burden during peak submission periods.

**Independent Test**: Can be fully tested by attempting submission with invalid data, correcting it, and successfully submitting without starting over.

**Acceptance Scenarios**:

1. **Given** required metadata is missing or invalid, **When** the author submits, **Then** the system highlights each invalid field with a clear message and keeps the author on the submission form.
2. **Given** an invalid or oversized manuscript file is uploaded, **When** the author submits, **Then** the system rejects the file, explains the requirements, and allows a corrected file to be uploaded.

---

### Edge Cases

- What happens when a user’s session expires during submission?
- How does the system handle a transient failure while saving the submission?
- How does the system handle upload interruption or network loss mid-upload?
- How does the system handle a ZIP that is not a valid LaTeX source package?
- How does the system apply the duplicate-submission rule defined in FR-009?

## Use Case Mapping *(mandatory)*

- **Primary Use Case(s)**: UC-04
- **Acceptance Tests**: UC-04-AT
- **Notes**: Existing use case; this feature formalizes submission behavior and validations.

## Requirements *(mandatory)*

Acceptance criteria are defined in the User Scenarios & Testing section and trace to the requirements below.

### Functional Requirements

- **FR-001**: System MUST allow logged-in authors to start a new paper submission.
- **FR-002**: System MUST collect required metadata: author name, affiliation, contact information, abstract, and keywords.
- **FR-003**: System MUST validate that all required metadata fields are present and properly formatted before submission.
- **FR-004**: System MUST accept a manuscript file in PDF, DOCX, or LaTeX source ZIP that meets defined size constraints.
- **FR-005**: System MUST save the manuscript and metadata and mark the paper as submitted only after all validations pass.
- **FR-006**: System MUST display a clear confirmation of successful submission and return the author to their home page.
- **FR-007**: System MUST prevent submission when validation fails and highlight each invalid field at the field level, using a visual indicator and an inline error label tied to that field.
- **FR-008**: System MUST present a user-safe, non-technical error message on failed submission saves that (a) states the submission was not saved, (b) does not expose system internals, and (c) instructs the author to retry later or contact support.
- **FR-009**: System MUST block duplicate submissions within the official submission window using the match key {author + title} and/or manuscript content hash, and inform the author that a submission already exists.

### Key Entities *(include if feature involves data)*

- **Paper Submission**: A submission record with title, abstract, keywords, status, and timestamps.
- **Manuscript File**: The uploaded document associated with a submission, including filename, format, and size.
- **Author**: The single submitting user with name, affiliation, and contact details.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 95% of authors complete a valid submission within 5 minutes from opening the submission form. *(Post-release metric; tracked via analytics/support.)*
- **SC-002**: At least 99% of valid submission attempts succeed without system errors. *(Post-release metric; tracked via analytics/support.)*
- **SC-003**: At least 90% of authors who encounter validation errors successfully resubmit within the same session. *(Post-release metric; tracked via analytics/support.)*
- **SC-004**: Fewer than 2% of submission attempts fail due to system-side errors during peak submission week. *(Post-release metric; tracked via analytics/support.)*

## Assumptions

- Manuscripts are accepted in PDF, DOCX, or LaTeX source ZIP format with a maximum size of 7 MB.
- Each paper has exactly one author; no co-authors are listed.
- The author must be logged in to access the submission form.
- The submission window is defined by official conference open and close dates.

## Dependencies

- Existing CMS authentication and user profiles for author identity.
- Existing CMS storage for submission records and uploaded files.

## Out of Scope

- Peer review assignment and reviewer workflows.
- Editing or withdrawing submissions after they are marked as submitted.
