# Feature Specification: Edit Generated Conference Schedule

**Feature Branch**: `001-edit-conference-schedule`  
**Created**: February 3, 2026  
**Status**: Draft  
**Input**: User description: "UC-17.md UC-17-AT.md"

## Clarifications

### Session 2026-02-03

- Q: What should happen if the schedule changed since the editor loaded it? → A: Reject with reload (block save and prompt refresh)
- Q: What is the allowed scope of edits? → A: Reassign only (change time/room/session for existing items)
- Q: Which conflicts must be blocked during validation? → A: Block room/time overlaps and paper/time double-bookings
- Q: When do edits become visible to others? → A: Immediately to all viewers after save

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Edit a Schedule Item (Priority: P1)

As an editor, I want to update a scheduled item (session, paper, time slot, or room) so I can resolve conflicts and make necessary adjustments.

**Why this priority**: This is the core value of the feature and enables editors to keep the schedule accurate.

**Independent Test**: An editor can modify one schedule item and see the updated schedule persisted and displayed correctly.

**Acceptance Scenarios**:

1. **Given** an editor is logged in and a generated schedule exists, **When** the editor edits a schedule item to a valid, non-conflicting slot and saves, **Then** the schedule is updated and the change is confirmed.
2. **Given** a schedule item is selected for editing, **When** the editor attempts to save a change that introduces a conflict, **Then** the system blocks the save and explains the conflict.
3. **Given** the schedule has changed since the editor loaded it, **When** the editor attempts to save an edit, **Then** the system blocks the save and prompts the editor to refresh/reload the schedule.

---

### User Story 2 - Changes Persist Across Sessions (Priority: P2)

As an editor, I want my valid schedule changes to remain after I leave and return, so I can trust the schedule reflects the latest edits.

**Why this priority**: Persistent updates prevent confusion and rework for editors and participants.

**Independent Test**: After saving a valid change, logging out and back in shows the updated schedule.

**Acceptance Scenarios**:

1. **Given** a valid schedule change was saved, **When** the editor returns to the schedule view later, **Then** the updated placement remains.

---

### User Story 3 - Safe Handling of Errors and Invalid Targets (Priority: P3)

As an editor, I want clear feedback if the save fails or the item no longer exists, so I can take corrective action without corrupting the schedule.

**Why this priority**: Protects data integrity and avoids confusion during edits.

**Independent Test**: A simulated save failure or missing item results in no partial update and a clear message.

**Acceptance Scenarios**:

1. **Given** the editor attempts to save a valid change during a system failure, **When** the save fails, **Then** the schedule remains unchanged and the editor is informed.
2. **Given** the editor selects an item that was removed, **When** the editor attempts to edit it, **Then** the system indicates it cannot be edited and no changes are saved.
3. **Given** a non-editor attempts to edit the schedule, **When** the user initiates or saves an edit, **Then** the system blocks the action, saves no changes, and shows an access-denied message.

---

### Edge Cases

- The system treats identical rapid save submissions as idempotent and does not create duplicates.
- The system blocks edits that assign a paper to two sessions at the same time (paper/time double-booking).
- Users without editor permissions cannot access edit controls and cannot save changes.

## Use Case Mapping *(mandatory)*

- **Primary Use Case(s)**: UC-17
- **Acceptance Tests**: UC-17-AT
- **Notes**: This spec refines existing UC-17 behavior without adding new use cases.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow an editor to select an existing schedule item (session, paper, time slot, or room) for modification.
- **FR-002**: System MUST allow an editor to change the assigned time slot, session, and/or room for a selected schedule item.
- **FR-002a**: System MUST limit edits to reassigning existing items only and MUST NOT add or remove sessions or papers.
- **FR-003**: System MUST validate edits for scheduling conflicts, including room/time overlaps and paper/time double-bookings, before saving.
- **FR-004**: System MUST block saving when a conflict is detected and provide a clear, actionable message that includes `errorCode`, `summary`, `affectedItemId`, optional `conflicts`, and `recommendedAction`. Expected `errorCode` values include `CONFLICT`, `STALE_EDIT`, and `SAVE_FAILED`.
- **FR-005**: System MUST save valid edits and confirm success to the editor.
- **FR-006**: System MUST ensure saved edits persist across editor sessions.
- **FR-006a**: System MUST make saved edits visible to all schedule viewers immediately after save, meaning a subsequent GET `/schedule/current` reflects the saved state with no caching delay.
- **FR-007**: System MUST prevent users without editor permissions from editing the schedule.
- **FR-008**: System MUST handle save failures atomically (no partial updates), inform the editor, and return `errorCode` `SAVE_FAILED` with a `recommendedAction` to retry or refresh.
- **FR-009**: System MUST prevent edits to schedule items that no longer exist and inform the editor.
- **FR-010**: System MUST treat identical rapid save submissions as idempotent, returning the same final state without creating duplicates.
- **FR-011**: System MUST detect when the schedule has changed since the editor loaded it and block saving until the editor refreshes.

### Key Entities *(include if feature involves data)*

- **Schedule**: The published arrangement of sessions, time slots, rooms, and assigned papers for the conference.
- **Schedule Item**: A specific assignment within the schedule (e.g., a paper assigned to a session, room, and time slot).
- **Editor**: A user role authorized to modify the schedule.
- **Conflict**: A violation of basic scheduling rules (e.g., overlapping assignments for the same room or the same paper).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Editors can complete a valid schedule edit and receive confirmation within 2 minutes of starting the edit.
- **SC-002**: 95% of valid edit attempts are saved successfully on the first try in normal conditions.
- **SC-003**: 100% of detected conflicts block saving and provide a clear, actionable message.
- **SC-004**: 0 schedule data corruption incidents are observed from failed saves or double-save attempts during acceptance testing.
- **SC-005**: At least 90% of editors can complete a schedule edit without assistance in usability testing.
- **SC-006**: Validation plus save completes within p95 ≤ 5 seconds for schedules of approximately 1,000 items under normal conditions.

## Assumptions

- The schedule already exists and is viewable by the editor before edits are made.
- Basic conflict rules include preventing overlapping assignments for the same room/time or the same paper/time.
- Validation must block both room/time overlaps and paper/time double-bookings.
- This feature updates the current schedule only; previous versions are not accessible within this scope.

## Dependencies

- Editor authentication and role permissions are available.
- The schedule view is accessible to editors.
- Schedule data can be saved and retrieved reliably by the CMS.
