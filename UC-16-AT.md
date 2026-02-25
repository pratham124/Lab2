# Acceptance Test Suite — UC-16 Generate Conference Schedule

## Overview

**Use Case**: UC-16 Generate Conference Schedule  
**Objective**: Verify that an authenticated administrator can generate and store a conference schedule that assigns accepted papers to sessions/time slots, and that the system handles missing parameters, unsatisfiable constraints, and persistence failures safely.  
**In Scope**: Access control, input/parameter validation, schedule generation, assignment of accepted papers to slots, persistence, display to administrator, error handling/logging.  
**Out of Scope**: Manual schedule editing after generation, specific optimization/algorithm quality, speaker availability constraints unless explicitly implemented.

---

## AT-UC16-01 — Generate Schedule Successfully (Main Success Scenario)

**Priority**: High  
**Preconditions**:

- Administrator `A1` is registered and logged in.
- There are accepted papers available (e.g., `P1..P10`).
- Scheduling parameters are fully defined in CMS (conference dates, session lengths, available rooms, daily time window).
- CMS scheduling service and database are available.

**Test Data** (example):

- Conference dates: 2 days
- Rooms: 2 rooms
- Session length: 90 minutes
- Time slots window: 09:00–17:00
- Accepted papers: 10

**Steps**:

1. Log in as administrator `A1`.
2. Navigate to conference administration section.
3. Select **Generate Schedule**.
4. Confirm generation (if confirmation is required).

**Expected Results**:

- System retrieves accepted papers and scheduling parameters.
- System generates a schedule that assigns each accepted paper to a specific session/time slot.
- System stores the schedule in the database.
- System displays the generated schedule to `A1` for review.
- Each accepted paper appears exactly once in the schedule (unless multi-slot presentations are implemented).

**Pass/Fail Criteria**:

- PASS if schedule is generated, stored, and displayed with assigned slots; FAIL otherwise.

---

## AT-UC16-02 — Generated Schedule Persists and Can Be Re-Viewed

**Priority**: High  
**Preconditions**:

- AT-UC16-01 completed successfully (schedule exists).
- Administrator can start a new session.

**Test Data**:

- Existing generated schedule

**Steps**:

1. Log out (or end session).
2. Log back in as administrator `A1`.
3. Navigate to schedule view page.

**Expected Results**:

- Previously generated schedule loads from database.
- Schedule content matches what was generated (no missing sessions/papers).

**Pass/Fail Criteria**:

- PASS if schedule persists across sessions; FAIL otherwise.

---

## AT-UC16-03 — Reject Generation When Required Parameters Missing (Extension 4a)

**Priority**: High  
**Preconditions**:

- Administrator `A1` logged in.
- Accepted papers exist.
- At least one required scheduling parameter is missing (e.g., no rooms defined OR no conference dates).

**Test Data**:

- Missing parameter: Rooms list is empty (or conference dates unset)

**Steps**:

1. Attempt to generate schedule.

**Expected Results**:

- System detects missing/incomplete parameters.
- System blocks schedule generation.
- System displays an error indicating which parameters must be defined.
- No schedule is generated or saved.

**Pass/Fail Criteria**:

- PASS if generation is blocked with clear guidance; FAIL otherwise.

---

## AT-UC16-04 — Handle Unsatisfiable Constraints (Extension 5a)

**Priority**: High  
**Preconditions**:

- Administrator logged in.
- Scheduling parameters are defined but insufficient for workload (e.g., too many accepted papers for available slots).
- Example: 1 room, 1 day, limited time window, many papers.

**Test Data** (example):

- Conference dates: 1 day
- Rooms: 1 room
- Time window: 09:00–10:00 (1 hour)
- Session length: 60 minutes
- Accepted papers: 10

**Steps**:

1. Attempt to generate schedule.

**Expected Results**:

- System cannot produce a valid schedule due to conflicts/constraints.
- System displays a failure message indicating scheduling conflicts prevent generation.
- No partial schedule is stored as “final.”

**Pass/Fail Criteria**:

- PASS if system fails safely with clear message and no final schedule saved; FAIL otherwise.

---

## AT-UC16-05 — Database Failure While Saving Generated Schedule (Extension 7a)

**Priority**: High  
**Preconditions**:

- Administrator logged in.
- Schedule generation inputs are valid and conflicts are resolvable.
- Simulate database write failure during schedule save.

**Test Data**:

- Any valid configuration that would normally succeed.

**Steps**:

1. Trigger schedule generation while DB failure is active at save time.

**Expected Results**:

- System generates schedule in memory but fails to persist it.
- System displays a “schedule could not be saved” failure message (non-technical).
- Error is logged (verifiable in test environment logs).
- No schedule is stored (or any stored schedule remains unchanged).

**Pass/Fail Criteria**:

- PASS if system fails safely and does not falsely claim success; FAIL otherwise.

---

## AT-UC16-06 — Authorization: Non-Admin Cannot Generate Schedule

**Priority**: High  
**Preconditions**:

- Non-admin user exists (e.g., Author or Editor) and is logged in.

**Test Data**:

- None

**Steps**:

1. Attempt to access schedule generation function (UI navigation or direct URL).
2. Attempt to trigger schedule generation.

**Expected Results**:

- System denies access (access denied/redirect/not found as implemented).
- No schedule is generated or modified.
- API response is HTTP 403 for both:
  - `POST /admin/conferences/{conferenceId}/schedule/generate`
  - `GET /admin/conferences/{conferenceId}/schedule`

**Pass/Fail Criteria**:

- PASS if only admins can generate schedules; FAIL otherwise.

---

## AT-UC16-07 — Schedule Assigns Only Accepted Papers

**Priority**: Medium  
**Preconditions**:

- Administrator logged in.
- There is a mix of paper statuses:
  - Accepted: `P1..P5`
  - Rejected/Not decided: `P6..P10`
- Parameters valid.

**Test Data**:

- Mixed paper status set

**Steps**:

1. Generate schedule.

**Expected Results**:

- Schedule includes accepted papers only (`P1..P5`).
- Rejected/not decided papers do not appear in schedule.

**Pass/Fail Criteria**:

- PASS if only accepted papers are scheduled; FAIL otherwise.

---

## AT-UC16-08 — No Duplicate Paper Assignments in Schedule

**Priority**: Medium  
**Preconditions**:

- Administrator logged in.
- Parameters valid.
- Multiple accepted papers exist.

**Test Data**:

- Accepted papers: `P1..P10`

**Steps**:

1. Generate schedule.
2. Scan schedule for duplicate occurrences of any paper.

**Expected Results**:

- Each accepted paper appears at most once (unless the system explicitly supports multiple sessions per paper, in which case behavior must be consistent and explained).
- No paper is assigned to two different time slots accidentally.

**Pass/Fail Criteria**:

- PASS if duplicates are absent; FAIL otherwise.

---

## AT-UC16-09 — Idempotency / Re-Generate Behavior (If Supported)

**Priority**: Low  
**Preconditions**:

- Administrator logged in.
- A schedule already exists from a previous generation.

**Test Data**:

- Existing schedule
- Same parameters/papers

**Steps**:

1. Click **Generate Schedule** again with the same inputs and `confirmReplace=false` (or missing).
2. Click **Generate Schedule** again with the same inputs and `confirmReplace=true`.

**Expected Results**:

- When `confirmReplace` is missing or false, system returns conflict and does not replace the stored schedule.
- When `confirmReplace=true`, system replaces the existing schedule and returns success.
- Behavior is consistent and clearly communicated.

**Pass/Fail Criteria**:

- PASS if regenerate behavior is clear and does not silently corrupt the schedule; FAIL otherwise.

---

## Traceability (UC-16 Steps → Tests)

- **Main Success Scenario** → AT-UC16-01, AT-UC16-02
- **Extension 4a (missing parameters)** → AT-UC16-03
- **Extension 5a (conflicts/constraints)** → AT-UC16-04
- **Extension 7a (DB save error)** → AT-UC16-05
- **Security/authorization** → AT-UC16-06
- **Correctness/robustness** → AT-UC16-07, AT-UC16-08, AT-UC16-09

## Response Code Mapping Checks

- Missing required parameters: **400**
- Unsatisfiable constraints: **409**
- Existing schedule without `confirmReplace=true`: **409**
- Save failure: **500**
- Non-admin access to schedule endpoints: **403**
