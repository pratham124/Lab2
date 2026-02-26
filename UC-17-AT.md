# Acceptance Test Suite — UC-17 Edit Generated Conference Schedule

## Overview

**Use Case**: UC-17 Edit Generated Conference Schedule  
**Objective**: Verify that an editor can modify an existing schedule, that edits are validated for conflicts, that valid edits persist, and that failures (conflicts, missing items, save errors) are handled safely.  
**In Scope**: Schedule view, selection of schedule elements, edit actions (move paper/change slot/room), validation for basic consistency, persistence, confirmation messaging, authorization, error handling/logging.  
**Out of Scope**: Specific UI mechanics (drag-and-drop vs form) and advanced constraint optimization beyond basic conflict detection.

---

## AT-UC17-01 — Edit a Schedule Item Successfully (Main Success Scenario)

**Priority**: High  
**Preconditions**:

- Editor `E1` is registered and logged in.
- A generated schedule exists in CMS.
- Editor `E1` has permission to edit the schedule.
- Schedule contains paper `P1` in Session `S1`, Room `R1`, Time slot `T1`.
- CMS and database are available.

**Test Data**:

- Move `P1` from `S1/R1/T1` to `S2/R2/T2` (a free, non-conflicting slot)

**Steps**:

1. Log in as `E1`.
2. Navigate to schedule view.
3. Select schedule item for `P1`.
4. Change its assignment to `S2/R2/T2`.
5. Save changes.

**Expected Results**:

- System validates the updated schedule and finds no conflicts.
- System saves the updated schedule.
- System confirms update success.
- Returning to schedule view shows `P1` in `S2/R2/T2` and no longer in `S1/R1/T1`.
- A subsequent fetch of the current schedule reflects the saved state with no caching delay.

**Pass/Fail Criteria**:

- PASS if edit persists and schedule reflects new placement; FAIL otherwise.

---

## AT-UC17-02 — Persist Changes Across Sessions

**Priority**: Medium  
**Preconditions**:

- AT-UC17-01 completed successfully (schedule updated).

**Test Data**:

- Updated schedule state

**Steps**:

1. Log out (or end session).
2. Log back in as `E1`.
3. Navigate to schedule view.

**Expected Results**:

- The schedule still shows `P1` in the updated slot.
- No rollback to old placement.

**Pass/Fail Criteria**:

- PASS if edits persist; FAIL otherwise.

---

## AT-UC17-03 — Block Save When Edit Introduces a Conflict (Extension 6a)

**Priority**: High  
**Preconditions**:

- Editor `E1` logged in.
- Generated schedule exists.
- Room `R1` already has a different paper `P2` scheduled at `T1`.

**Test Data**:

- Attempt to move `P1` into `R1/T1` where `P2` already exists (room-time overlap)

**Steps**:

1. Open schedule edit.
2. Select `P1`.
3. Change assignment to `R1/T1` where conflict exists.
4. Attempt to save.

**Expected Results**:

- System detects scheduling conflict (e.g., two papers in same room/time).
- System blocks saving changes.
- System displays an error message describing the conflict.
- Schedule remains unchanged (no partial updates).

**Pass/Fail Criteria**:

- PASS if conflict is detected, save blocked, and schedule unchanged; FAIL otherwise.

---

## AT-UC17-04 — Conflict Message Is Actionable

**Priority**: Medium  
**Preconditions**:

- Same as AT-UC17-03 (a conflict can be triggered).

**Test Data**:

- Any conflict scenario

**Steps**:

1. Trigger a conflict and observe the displayed error.

**Expected Results**:

- Error message identifies what conflicts (e.g., “Room R1 already has a session at 10:00”).
- Error message suggests what to do (e.g., choose another room/time slot).
- Error message includes required fields: `errorCode`, `summary`, `affectedItemId`, optional `conflicts`, `recommendedAction`.
- No stack traces or internal IDs shown to end user.

**Pass/Fail Criteria**:

- PASS if message helps editor correct the issue; FAIL otherwise.

---

## AT-UC17-05 — Handle System/Database Failure While Saving (Extension 7a)

**Priority**: High  
**Preconditions**:

- Editor logged in.
- Generated schedule exists.
- Edit made that would normally be valid.
- Simulate database write failure during save.

**Test Data**:

- Valid move of `P1` to a free slot

**Steps**:

1. Make a valid schedule change.
2. Click save while DB failure is active.

**Expected Results**:

- System displays a save failure message (non-technical).
- Error payload includes `errorCode` `SAVE_FAILED` and a `recommendedAction` to retry or refresh.
- Error is logged (verifiable in test environment logs).
- Schedule is not partially saved.
- Viewing schedule after failure shows original schedule (or last saved state).

**Pass/Fail Criteria**:

- PASS if save failure handled safely and no partial corruption occurs; FAIL otherwise.

---

## AT-UC17-06 — Editing Non-Existent Schedule Element (Extension 4a)

**Priority**: Medium  
**Preconditions**:

- Editor logged in.
- Schedule exists.
- A schedule item is removed or changed externally (simulate concurrent modification) so the selected item no longer exists.

**Test Data**:

- Attempt to edit deleted session/paper/time slot entry

**Steps**:

1. Open schedule view and select a schedule element.
2. Before saving, simulate the element being removed.
3. Attempt to edit/save the now-nonexistent element.

**Expected Results**:

- System detects the item no longer exists.
- System displays an error indicating the selected item cannot be edited.
- System does not save any changes based on stale selection.
- Editor remains in schedule view and can choose another element.

**Pass/Fail Criteria**:

- PASS if system prevents editing a nonexistent item with clear error; FAIL otherwise.

---

## AT-UC17-07 — Authorization: Non-Editor Cannot Edit Schedule

**Priority**: High  
**Preconditions**:

- A non-editor user (e.g., author or reviewer) exists and is logged in.
- A schedule exists.

**Test Data**:

- None

**Steps**:

1. Attempt to access schedule edit mode as non-editor (UI or direct URL).
2. Attempt to save an edit (if UI allows reaching it).

**Expected Results**:

- Access denied or edit controls hidden.
- No schedule changes can be saved by non-editor.
- Access-denied message is shown.

**Pass/Fail Criteria**:

- PASS if only authorized editors can edit; FAIL otherwise.

---

## AT-UC17-08 — Prevent Duplicate/Overlapping Edits From Double-Save

**Priority**: Low  
**Preconditions**:

- Editor logged in.
- Valid edit ready to be saved.

**Test Data**:

- Any valid edit

**Steps**:

1. Click Save twice rapidly (double-click).
2. Review schedule state.

**Expected Results**:

- Schedule is saved once (or multiple saves result in the same final consistent state).
- No duplicated schedule entries appear.
- No error page/stack trace displayed.
- Identical rapid submissions are treated as idempotent and return the same final state.

**Pass/Fail Criteria**:

- PASS if system remains consistent and stable; FAIL otherwise.

---

## AT-UC17-09 — Block Stale Edit When Schedule Changed Since Load

**Priority**: High  
**Preconditions**:

- Editor logged in.
- Generated schedule exists.
- Editor loads schedule at `lastUpdatedAt` = `T1`.
- Schedule is updated elsewhere to `lastUpdatedAt` = `T2`.

**Test Data**:

- Edit prepared using `lastUpdatedAt` = `T1`

**Steps**:

1. Load schedule as editor and start an edit.
2. Change the schedule elsewhere to advance the version.
3. Attempt to save the original edit.

**Expected Results**:

- System detects the schedule version has changed.
- Save is blocked.
- Editor is prompted to refresh/reload the schedule.
- No changes from the stale edit are saved.

**Pass/Fail Criteria**:

- PASS if stale edit is blocked and refresh is required; FAIL otherwise.

## Traceability (UC-17 Steps → Tests)

- **Main Success Scenario (edit + validate + save)** → AT-UC17-01, AT-UC17-02
- **Extension 6a (conflict introduced)** → AT-UC17-03, AT-UC17-04
- **Extension 7a (save failure)** → AT-UC17-05
- **Extension 4a (item missing)** → AT-UC17-06
- **Security/robustness** → AT-UC17-07, AT-UC17-08
- **Stale edit handling** → AT-UC17-09

## Execution Notes (2026-02-25)

- API coverage implemented and verified on `/schedule/current`, `GET /schedule/items/{itemId}`, and `PUT /schedule/items/{itemId}`.
- Double-submit behavior validated as idempotent for identical rapid submissions; no `DUPLICATE_SUBMIT` error path is used.
- Error payload rendering validated for `CONFLICT`, `STALE_EDIT`, and `SAVE_FAILED` with required fields: `errorCode`, `summary`, `affectedItemId`, `recommendedAction` (and optional `conflicts`).
