# Acceptance Test Suite — UC-09 Enforce Reviewer Workload Limit

## Overview

**Use Case**: UC-09 Enforce Reviewer Workload Limit  
**Objective**: Verify that the system prevents an editor from assigning a reviewer to more than five assigned papers per conference, allows assignments up to the limit, and fails safely when workload cannot be verified.  
**In Scope**: Workload counting per conference (assigned papers only, no pending state), enforcement at assignment time, UI feedback to editor, persistence rules (no partial/invalid assignment), error handling when workload retrieval fails, logging failures for admin review.  
**Out of Scope**: Reviewer invitation acceptance/rejection, conflict-of-interest checks, reviewer expertise matching.

### Rule Under Test

- A reviewer must not have **more than 5 assigned papers per conference**.

---

## AT-UC09-01 — Block Assignment When Reviewer Already Has 5 Papers (Main Success Scenario)

**Priority**: High  
**Preconditions**:

- Editor is registered and logged in.
- Reviewer `R5` has exactly 5 assigned papers in the conference.
- Paper `P1` is available for assignment.
- CMS and database are available.

**Test Data**:

- Paper: `P1`
- Reviewer: `R5` (workload = 5 in this conference)

**Steps**:

1. Navigate to reviewer assignment for paper `P1`.
2. Select reviewer `R5`.
3. Attempt to confirm/save the assignment.

**Expected Results**:

- System checks `R5`’s current assigned-paper count.
- System prevents the assignment because it would exceed the limit.
- System displays a non-technical error stating the workload limit is reached and includes the numeric limit “5”, without internal IDs or stack traces.
- No new assignment record is created for `P1`→`R5`.

**Pass/Fail Criteria**:

- PASS if assignment is blocked and workload stays at 5; FAIL otherwise.

---

## AT-UC09-02 — Allow Assignment When Reviewer Has 4 Papers (Extension 3a Boundary)

**Priority**: High  
**Preconditions**:

- Editor logged in.
- Reviewer `R4` has exactly 4 assigned papers in the conference.
- Paper `P2` available for assignment.

**Test Data**:

- Paper: `P2`
- Reviewer: `R4` (workload = 4 in this conference)

**Steps**:

1. Open assignment UI for `P2`.
2. Select reviewer `R4`.
3. Confirm/save assignment.

**Expected Results**:

- System allows assignment.
- Assignment record is created for `P2`→`R4`.
- `R4` workload becomes 5.
- Editor sees confirmation that assignment succeeded.

**Pass/Fail Criteria**:

- PASS if assignment succeeds and workload becomes exactly 5; FAIL otherwise.

---

## AT-UC09-03 — Allow Assignment When Reviewer Has 0 Papers (Extension 3a)

**Priority**: Medium  
**Preconditions**:

- Editor logged in.
- Reviewer `R0` has 0 assigned papers in the conference.
- Paper `P3` available.

**Test Data**:

- Paper: `P3`
- Reviewer: `R0` (workload = 0 in this conference)

**Steps**:

1. Assign `R0` to `P3`.

**Expected Results**:

- System allows assignment.
- `R0` workload increments to 1.
- Assignment persists.

**Pass/Fail Criteria**:

- PASS if assignment is allowed and counted; FAIL otherwise.

---

## AT-UC09-04 — Fail Safe When Workload Cannot Be Retrieved (Extension 4a)

**Priority**: High  
**Preconditions**:

- Editor logged in.
- Paper `P4` available.
- Simulate failure retrieving reviewer workload (DB read error/service error).

**Test Data**:

- Paper: `P4`
- Reviewer: `R?` (any reviewer)

**Steps**:

1. Open assignment UI for `P4`.
2. Select a reviewer.
3. Attempt to confirm/save while workload retrieval failure is active.

**Expected Results**:

- System cannot verify workload.
- System blocks the assignment.
- System displays a non-technical error indicating workload cannot be verified, without internal IDs or stack traces.
- Failure is logged for administrative review (verifiable in test environment logs).
- No assignment record is created.

**Pass/Fail Criteria**:

- PASS if assignment is blocked and no data is corrupted; FAIL otherwise.

---

## AT-UC09-05 — No Partial Assignment: Enforcement Applies Per Reviewer Selection

**Priority**: Medium  
**Preconditions**:

- Editor logged in.
- Paper `P5` available.
- Reviewer `R5` has workload 5 in the conference.
- Reviewer `R2` has workload 2 in the conference.

**Test Data**:

- Paper: `P5`
- Reviewers: `R5` (blocked/not selectable), `R2` (allowed)

**Steps**:

1. Confirm `R5` does not appear in the reviewer selection list.
2. Assign `R2` to `P5`.

**Expected Results**:

- Reviewer `R5` is not selectable and no record is created for `R5`.
- Second attempt succeeds (record created for `R2`).
- Workloads update correctly.
- UI messages clearly distinguish failure vs success.

**Pass/Fail Criteria**:

- PASS if blocked reviewer is not assigned and allowed reviewer is assigned; FAIL otherwise.

---

## AT-UC09-06 — Prevent Exceeding Limit Under Concurrency (Race Condition Check)

**Priority**: Medium  
**Preconditions**:

- Reviewer `R4` has workload 4 in the conference.
- Two papers `P6` and `P7` are ready for assignment.
- Two editor sessions (or parallel test threads) can attempt assignment simultaneously.

**Test Data**:

- Reviewer: `R4`
- Papers: `P6`, `P7`

**Steps**:

1. In Session A, assign `R4` to `P6` and submit.
2. At the same time in Session B, assign `R4` to `P7` and submit.

**Expected Results**:

- At most one of the two assignments succeeds (so `R4` does not exceed 5).
- The other attempt is rejected with a workload-limit message.
- Final workload for `R4` is 5, not 6.

**Pass/Fail Criteria**:

- PASS if limit is maintained under concurrency; FAIL otherwise.

---

## AT-UC09-07 — Authorization: Only Editors Can Trigger Workload Enforcement via Assignment UI

**Priority**: High  
**Preconditions**:

- Non-editor user (e.g., Author) is logged in.
- Paper `P8` exists.

**Test Data**:

- Paper: `P8`

**Steps**:

1. Attempt to access reviewer assignment functionality as non-editor (via menu or URL).

**Expected Results**:

- Access is denied (redirect/access denied/not found).
- No assignment attempt proceeds.

**Pass/Fail Criteria**:

- PASS if non-editors cannot reach assignment actions; FAIL otherwise.

---

## Traceability (UC-09 Steps → Tests)

- **Main Success Scenario (block at limit)** → AT-UC09-01
- **Extension 3a (allow under limit)** → AT-UC09-02, AT-UC09-03
- **Extension 4a (cannot retrieve workload → block)** → AT-UC09-04
- **Robustness & correctness** → AT-UC09-05, AT-UC09-06
- **Security/authorization** → AT-UC09-07
