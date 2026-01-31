# Acceptance Test Suite — UC-19 View Published Conference Schedule

## Overview

**Use Case**: UC-19 View Published Conference Schedule  
**Objective**: Verify that an attendee can view the published conference schedule to plan attendance; verify behavior when schedule is unpublished, retrieval fails, and optional filter/view controls (if supported).  
**In Scope**: Schedule visibility to attendee role, retrieval/display of sessions/time/locations, unpublished-state messaging, error handling, optional filtering/view switching.  
**Out of Scope**: Editing schedule (UC-17), generating schedule (UC-16), exporting schedule formats (not specified).

---

## AT-UC19-01 — View Published Schedule Successfully (Main Success Scenario)

**Priority**: High  
**Preconditions**:

- A final conference schedule exists and is marked **Published**.
- Attendee user `T1` exists (or public access is enabled, depending on implementation).
- Schedule viewing service and database are available.

**Test Data**:

- Published schedule includes at least:
  - Multiple sessions
  - Time slots
  - Locations/rooms

**Steps**:

1. Access the CMS as attendee `T1` (log in if required).
2. Navigate to “View Schedule.”
3. Observe displayed schedule.

**Expected Results**:

- System retrieves the published schedule.
- System displays sessions, times, and locations clearly.
- Attendee can browse the schedule (scroll/page through schedule view).

**Pass/Fail Criteria**:

- PASS if published schedule is displayed correctly; FAIL otherwise.

---

## AT-UC19-02 — Schedule Not Yet Published Message (Extension 3a)

**Priority**: High  
**Preconditions**:

- No schedule is published (schedule status is Draft/Unpublished or absent).
- Attendee can attempt to access schedule view.

**Test Data**:

- Unpublished schedule state

**Steps**:

1. Access schedule view as attendee.

**Expected Results**:

- System does not show unpublished schedule details.
- System displays a clear message that the schedule is not yet available/published.
- No error stack traces shown.

**Pass/Fail Criteria**:

- PASS if attendee sees an “unavailable” message and no schedule details leak; FAIL otherwise.

---

## AT-UC19-03 — Handle Retrieval Error Gracefully (Extension 3b)

**Priority**: High  
**Preconditions**:

- Schedule is published.
- Simulate database read failure or schedule retrieval service outage.

**Test Data**:

- Any published schedule

**Steps**:

1. Access schedule view as attendee while retrieval failure is active.

**Expected Results**:

- System displays an error indicating schedule cannot be retrieved at this time.
- No technical stack traces or sensitive details are shown.
- Error is logged (verifiable in test environment logs).

**Pass/Fail Criteria**:

- PASS if failure is handled safely with clear messaging; FAIL otherwise.

---

## AT-UC19-04 — Access Control: Attendee Can View Published Schedule

**Priority**: Medium  
**Preconditions**:

- Schedule is published.
- Attendee account exists and is logged in (if authentication required).

**Test Data**:

- Attendee: `T1`

**Steps**:

1. Log in as `T1` (if required).
2. Navigate to schedule view.

**Expected Results**:

- Attendee is permitted to view the published schedule (no access denied).
- Display matches what is published.

**Pass/Fail Criteria**:

- PASS if attendee access works as intended; FAIL otherwise.

---

## AT-UC19-05 — Public Access Without Login (If Supported)

**Priority**: Low  
**Preconditions**:

- Schedule is published.
- System configured to allow public schedule viewing without authentication (if supported).

**Test Data**:

- None

**Steps**:

1. Open the schedule page without logging in.
2. Attempt to browse schedule.

**Expected Results**:

- If public access is supported: schedule is visible.
- If not supported: user is redirected to login or shown access-required message.
- In both cases, behavior is consistent and clearly communicated.

**Pass/Fail Criteria**:

- PASS if behavior matches system configuration; FAIL otherwise.

---

## AT-UC19-06 — Filter/View by Day (Extension 4a, If Supported)

**Priority**: Medium  
**Preconditions**:

- Schedule is published and spans multiple days.
- Filter/view controls exist (e.g., Day 1 / Day 2 tabs).

**Test Data**:

- Day 1 has sessions S1..S3, Day 2 has sessions S4..S6

**Steps**:

1. Open published schedule view.
2. Select “Day 1” filter/view.
3. Select “Day 2” filter/view.

**Expected Results**:

- System updates display to show only sessions for the selected day.
- No sessions from other days appear while filtered (unless intended).
- Switching back restores appropriate view.

**Pass/Fail Criteria**:

- PASS if filtering behaves correctly and predictably; FAIL otherwise.

---

## AT-UC19-07 — Filter/View by Session (Extension 4a, If Supported)

**Priority**: Low  
**Preconditions**:

- Schedule is published with multiple sessions.
- Session filter exists.

**Test Data**:

- Sessions: `S1`, `S2`

**Steps**:

1. Open schedule view.
2. Apply filter to show only session `S1`.
3. Clear filter.

**Expected Results**:

- When filtered, only session `S1` items appear.
- Clearing filter restores full schedule.

**Pass/Fail Criteria**:

- PASS if session filter works; FAIL otherwise.

---

## AT-UC19-08 — Data Integrity: Sessions Show Correct Time and Location

**Priority**: Medium  
**Preconditions**:

- Published schedule exists with known session data.

**Test Data**:

- Known entry: Session `S1` at 10:00 in Room `R1`

**Steps**:

1. Open schedule view.
2. Locate known entry `S1`.

**Expected Results**:

- Displayed time and location match stored/published schedule data.
- No missing/blank room or time fields for scheduled items.

**Pass/Fail Criteria**:

- PASS if displayed values match expected schedule; FAIL otherwise.

---

## Traceability (UC-19 Paths → Tests)

- **Main Success Scenario** → AT-UC19-01
- **Extension 3a (not published)** → AT-UC19-02
- **Extension 3b (retrieval error)** → AT-UC19-03
- **Extension 4a (filters/views)** → AT-UC19-06, AT-UC19-07
- **Access/robustness** → AT-UC19-04, AT-UC19-05, AT-UC19-08
