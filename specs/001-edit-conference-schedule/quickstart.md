# Quickstart: Edit Generated Conference Schedule

## Goal

Verify that an editor can reassign an existing schedule item, conflicts are blocked, and changes are immediately visible to all viewers.

## Prerequisites

- An editor account with permission to edit schedules.
- A generated schedule with at least one session, room, time slot, and paper assigned.

## Manual Test Flow

1. Log in as an editor.
2. Open the current schedule view.
3. Select a schedule item and change its session/room/time slot to a non-conflicting slot.
4. Save and confirm success message appears.
5. Refresh the schedule (or view as another user) and confirm the change is visible.
6. Attempt a conflicting edit (same room/time or paper/time) and confirm the save is blocked with a clear message.
7. Simulate a stale edit by changing the schedule elsewhere (updates `lastUpdatedAt`), then attempt to save the older edit and confirm refresh is required.
8. Log in as a non-editor and confirm edit controls are hidden or disabled.
9. Attempt to access edit via direct action and confirm the edit is blocked with an access-denied message and no changes saved.
10. Trigger a save failure and confirm no partial updates occur and the error includes `SAVE_FAILED` with a recommended action.
11. Double-submit the same save request rapidly and confirm the final state is unchanged and not duplicated.
12. After a successful save, immediately fetch the current schedule and confirm it reflects the latest persisted state.
