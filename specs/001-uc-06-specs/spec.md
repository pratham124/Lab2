# Feature Specification: Save Submission Draft

**Feature Branch**: `001-uc-06-specs`  
**Created**: 2026-02-01  
**Status**: Draft  
**Input**: User description: "UC-06.md UC-06-AT.md"

## Clarifications

### Session 2026-02-01

- Q: Are any fields required to save a draft, or can an author save with no required fields? → A: No required fields; validate only provided fields.
- Q: Is there a limit on the number of drafts per author? → A: One draft per submission.
- Q: What logging is required for draft saves? → A: Log save failures and unauthorized access attempts.
- Q: Should drafts auto-expire? → A: No auto-expiration.
- Q: How should concurrent save conflicts be handled? → A: Last-write-wins; no merge.
- Q: What does basic consistency validation include? → A: Trim whitespace, validate only provided fields, apply field-format checks only when present, and show field-level inline warnings.
- Q: How should rapid double-click saves behave? → A: Idempotent save with no duplicate drafts; same draft is updated.
- Q: What is required for save success confirmation? → A: Visible confirmation near save control or top of form, including a “last saved” timestamp if available.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save Draft Progress (Priority: P1)

An author saving an in-progress paper submission wants to store their current work as a draft so they can return later without losing data.

**Why this priority**: Prevents loss of work and enables longer, multi-session submission flows.

**Independent Test**: Can be fully tested by starting a submission, entering partial data, saving, and confirming the draft appears for the author.

**Acceptance Scenarios**:

1. **Given** an author is logged in and has started a submission, **When** they choose to save their progress, **Then** the system saves a draft and confirms success.
2. **Given** an author enters invalid values in one or more fields, **When** they try to save, **Then** the system does not save the draft and shows field-specific warnings.
3. **Given** the author submits a save request during a storage failure, **When** the save is attempted, **Then** the system reports the failure and no draft is stored.
4. **Given** the author has entered no required fields, **When** they choose to save, **Then** the system allows the draft to be saved while validating only any provided fields.
5. **Given** the author triggers save twice rapidly, **When** both requests are received, **Then** the system processes them idempotently and updates the same draft without creating duplicates.

---

### User Story 2 - Resume Draft Later (Priority: P2)

An author wants to return later and continue a saved draft from exactly where they left off.

**Why this priority**: Enables the core benefit of saving progress; without resuming, saving has limited value.

**Independent Test**: Can be fully tested by saving a draft, logging out/in, and verifying the draft loads with previously saved values.

**Acceptance Scenarios**:

1. **Given** a draft exists for the author, **When** they reopen it, **Then** all previously saved data is pre-populated and editable.
2. **Given** a draft exists for Author A, **When** Author B attempts to access it, **Then** access is denied and the draft is not visible or editable.

---

### User Story 3 - Update Existing Draft (Priority: P3)

An author wants to re-save changes to an existing draft without creating duplicates.

**Why this priority**: Ensures drafts remain manageable and accurately reflect the latest edits.

**Independent Test**: Can be fully tested by editing a saved draft and saving again, then verifying the draft reflects the updates without duplicates.

**Acceptance Scenarios**:

1. **Given** a saved draft exists, **When** the author edits and saves again, **Then** the existing draft is updated and no duplicate draft is created.

---

### Edge Cases

- Rapid double-click saves are idempotent and update the same draft without duplicates.
- Storage failure during save results in no draft saved and a clear failure message.
- Non-owners attempting to access a draft are denied access.

## Use Case Mapping *(mandatory)*

- **Primary Use Case(s)**: UC-06
- **Acceptance Tests**: UC-06-AT
- **Notes**: Existing use case and acceptance tests; this specification aligns with the documented behavior.

## Scope

**In Scope**:
- Saving an in-progress submission as a draft
- Basic validation on save and user feedback
- Resuming and updating drafts by the owning author

**Out of Scope**:
- Final submission workflow
- Manuscript upload requirements beyond saving already-entered data
- Editorial review or decision workflows

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow an authenticated author to save a partially completed submission as a draft.
- **FR-002**: The system MUST trim whitespace in provided fields and validate only provided fields for format consistency before saving a draft.
- **FR-003**: The system MUST display a clear success confirmation when a draft is saved.
- **FR-004**: The system MUST prevent saving when validation fails and identify the problematic fields to the author.
- **FR-005**: The system MUST allow an author to reopen their own drafts and continue editing with previously saved values pre-populated.
- **FR-006**: The system MUST restrict draft access so only the draft owner can view or edit it.
- **FR-007**: The system MUST update an existing draft when the author saves again instead of creating unintended duplicate drafts.
- **FR-008**: The system MUST handle save failures by informing the author that the draft was not saved.
- **FR-009**: The system MUST ensure no partial or corrupt draft is stored when a save fails.
- **FR-010**: The system MUST allow saving a draft even when no required fields are completed, validating only fields that contain data.
- **FR-011**: The system MUST allow at most one draft per submission.
- **FR-012**: The system MUST log draft save failures and unauthorized access attempts.
- **FR-013**: The system MUST not auto-expire drafts.
- **FR-014**: The system MUST treat concurrent save requests as last-write-wins with no merge behavior.
- **FR-015**: The system MUST process rapid repeat saves idempotently so the same draft is updated without duplicates.
- **FR-016**: The system MUST show a visible save confirmation near the save control or at the top of the form, including a “last saved” timestamp when available.

### Key Entities *(include if feature involves data)*

- **Draft Submission**: A partially completed paper submission linked to a specific author, including saved field values and a draft status.
- **Author**: A registered user who owns drafts and can save, reopen, and update them.

### Assumptions

- Drafts can be saved with incomplete information; only provided fields are checked for basic format/consistency.

### Dependencies

- Users can authenticate and are logged in as authors.
- The submission storage service is available to persist drafts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Authors can save a draft in under 10 seconds from initiating the save action in typical conditions.
- **SC-002**: At least 95% of draft save attempts with valid data complete successfully on the first try.
- **SC-003**: At least 90% of authors who save a draft can successfully resume it without support.
- **SC-004**: Draft access violations (attempts by non-owners) result in zero successful unauthorized accesses in testing.
