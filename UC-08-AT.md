# Acceptance Test Suite — UC-08 Assign Reviewers to Submitted Papers

## Overview

**Use Case**: UC-08 Assign Reviewers to Submitted Papers  
**Objective**: Verify that an editor can assign reviewers to a submitted paper according to conference rules, that invitations are issued, and that rule violations and failures are handled correctly.  
**In Scope**: Reviewer selection UI/workflow, validation of required reviewer count, workload limit enforcement, persistence of assignments, notification/invitation sending, error handling, access control.  
**Out of Scope**: Reviewer acceptance/rejection of invitations (separate use case), conflict-of-interest checks and expertise matching rules beyond what is implemented.

### Conference Rules (as per system expectations)

- Each submitted paper must be assigned **exactly 3** reviewers.
- Each reviewer must have **no more than 5** assigned papers.

---

## AT-UC08-01 — Successful Assignment of 3 Reviewers (Main Success Scenario)

**Priority**: High  
**Preconditions**:

- Editor is registered and logged in.
- Submitted paper `P1` exists and is in a state requiring reviewer assignment.
- At least 3 eligible reviewers exist: `R1`, `R2`, `R3`.
- Each selected reviewer currently has <= 4 assigned papers.
- Assignment and notification services are available.

**Test Data**:

- Paper: `P1`
- Reviewers: `R1`, `R2`, `R3`

**Steps**:

1. Navigate to the editor’s submitted papers list.
2. Select paper `P1`.
3. Select reviewers `R1`, `R2`, and `R3`.
4. Confirm/save the assignment.

**Expected Results**:

- System validates reviewer count = 3.
- System validates each reviewer workload <= 5 after assignment.
- System persists reviewer assignments for `P1`.
- System shows a success confirmation to the editor.
- System sends review invitations to `R1`, `R2`, `R3` as a post-assignment action.
- `P1` shows 3 assigned reviewers in the UI (or equivalent).

**Pass/Fail Criteria**:

- PASS if exactly 3 assignments are saved; invitations are attempted post-assignment.

---

## AT-UC08-02 — Reject Fewer Than 3 Reviewers (Extension 4a)

**Priority**: High  
**Preconditions**:

- Editor logged in.
- Paper `P1` requires assignment.
- Eligible reviewers exist.

**Test Data**:

- Paper: `P1`
- Reviewers selected: `R1`, `R2` (2 reviewers)

**Steps**:

1. Open assignment UI for `P1`.
2. Select only `R1` and `R2`.
3. Attempt to confirm/save.

**Expected Results**:

- System rejects the assignment.
- System displays an error indicating exactly 3 reviewers are required.
- No assignments are saved for `P1` (no partial save).
- No invitations are sent.

**Pass/Fail Criteria**:

- PASS if fewer-than-required selection is blocked; FAIL otherwise.

---

## AT-UC08-03 — Reject More Than 3 Reviewers (Extension 4a)

**Priority**: High  
**Preconditions**:

- Editor logged in.
- Paper `P1` requires assignment.
- Eligible reviewers exist.

**Test Data**:

- Paper: `P1`
- Reviewers selected: `R1`, `R2`, `R3`, `R4` (4 reviewers)

**Steps**:

1. Open assignment UI for `P1`.
2. Select `R1`, `R2`, `R3`, `R4`.
3. Attempt to confirm/save.

**Expected Results**:

- System rejects the assignment.
- System displays an error indicating exactly 3 reviewers are required.
- No assignments are saved and no invitations are sent.

**Pass/Fail Criteria**:

- PASS if more-than-required selection is blocked; FAIL otherwise.

---

## AT-UC08-04 — Enforce Reviewer Workload Limit (Extension 5a)

**Priority**: High  
**Preconditions**:

- Editor logged in.
- Paper `P1` requires assignment.
- Reviewer `R5` already has 5 assigned papers.
- Other eligible reviewers exist with <= 4 assignments.

**Test Data**:

- Paper: `P1`
- Reviewers selected: `R1`, `R2`, `R5`

**Steps**:

1. Open assignment UI for `P1`.
2. Select `R1`, `R2`, `R5`.
3. Attempt to confirm/save.

**Expected Results**:

- System detects `R5` would exceed workload limit.
- System rejects the assignment and informs editor of workload violation.
- No assignments are saved for `P1` (no partial save).
- No invitations are sent.

**Pass/Fail Criteria**:

- PASS if workload limit is enforced and no partial assignment occurs; FAIL otherwise.

---

## AT-UC08-05 — Boundary Test: Reviewer With 4 Assignments Can Be Assigned a 5th

**Priority**: Medium  
**Preconditions**:

- Editor logged in.
- Paper `P1` requires assignment.
- Reviewer `R4` currently has exactly 4 assigned papers.

**Test Data**:

- Paper: `P1`
- Reviewers: `R1`, `R2`, `R4`

**Steps**:

1. Assign `R1`, `R2`, `R4` to `P1`.
2. Confirm/save assignment.

**Expected Results**:

- System allows assignment (4 -> 5 is within limit).
- Assignments saved successfully and invitations sent.
- `R4` workload becomes 5 assigned papers.

**Pass/Fail Criteria**:

- PASS if boundary condition is handled correctly; FAIL otherwise.

---

## AT-UC08-06 — Handle Notification Failure After Successful Assignment

**Priority**: Medium  
**Preconditions**:

- Editor logged in.
- Paper `P1` requires assignment.
- Notification service failure is simulated, but DB is available.

**Test Data**:

- Paper: `P1`
- Reviewers: `R1`, `R2`, `R3`

**Steps**:

1. Assign `R1`, `R2`, `R3` to `P1`.
2. Confirm/save while notification service is down.

**Expected Results**:

- Assignments are saved in DB.
- System logs notification failure (verifiable in test logs).
- Editor receives a message indicating assignment saved and warning that invitation delivery failed.
- System flags invitation retry action for failed deliveries.
- Reviewers may not receive invitations immediately (expected due to outage).

**Pass/Fail Criteria**:

- PASS if assignments persist even if notifications fail; FAIL otherwise.

---

## AT-UC08-07 — Handle System/Database Failure During Save (Extension 6a)

**Priority**: High  
**Preconditions**:

- Editor logged in.
- Paper `P1` requires assignment.
- Simulate DB write failure/outage.

**Test Data**:

- Paper: `P1`
- Reviewers: `R1`, `R2`, `R3`

**Steps**:

1. Select `P1` and choose `R1`, `R2`, `R3`.
2. Confirm/save while DB failure is active.

**Expected Results**:

- System displays an assignment failure message (non-technical).
- Error is logged (verifiable in test logs).
- No reviewer assignments are saved.
- No invitations are sent.

**Pass/Fail Criteria**:

- PASS if failure is handled safely with no partial assignment; FAIL otherwise.

---

## AT-UC08-08 — Authorization: Non-Editor Cannot Assign Reviewers

**Priority**: High  
**Preconditions**:

- A non-editor role user exists (e.g., Author or Reviewer) and is logged in.
- Paper `P1` exists.

**Test Data**:

- Paper: `P1`

**Steps**:

1. Log in as a non-editor user.
2. Attempt to access reviewer assignment UI for `P1` (via navigation or direct URL).

**Expected Results**:

- System denies access (redirect to unauthorized/access denied/not found as appropriate).
- No assignments can be created or changed.

**Pass/Fail Criteria**:

- PASS if access control prevents assignment by non-editors; FAIL otherwise.

---

## AT-UC08-09 — Prevent Duplicate Assignments on Rapid Confirm/Save

**Priority**: Low  
**Preconditions**:

- Editor logged in.
- Paper `P1` requires assignment.
- Reviewers `R1`, `R2`, `R3` available and within workload limit.

**Test Data**:

- Paper: `P1`
- Reviewers: `R1`, `R2`, `R3`

**Steps**:

1. Select `R1`, `R2`, `R3` for `P1`.
2. Click confirm/save twice rapidly.

**Expected Results**:

- Exactly 3 unique reviewer assignments exist for `P1`.
- No duplicate assignment records are created.
- Invitations are sent at most once per reviewer (or deduplicated safely).

**Pass/Fail Criteria**:

- PASS if duplicates are prevented/handled cleanly; FAIL otherwise.

---

## Traceability (UC-08 Steps → Tests)

- **Main Success Scenario** → AT-UC08-01
- **Extension 4a (wrong reviewer count)** → AT-UC08-02, AT-UC08-03
- **Extension 5a (workload violation)** → AT-UC08-04
- **Extension 6a (system/DB error)** → AT-UC08-07
- **Notification robustness** → AT-UC08-06
- **Security & robustness** → AT-UC08-08, AT-UC08-09
- **Boundary condition** → AT-UC08-05
