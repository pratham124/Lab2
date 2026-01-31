# Acceptance Test Suite — UC-10 Receive Assignment Rule Violation Notification

## Overview

**Use Case**: UC-10 Receive Assignment Rule Violation Notification  
**Objective**: Verify that when an editor attempts to save an invalid reviewer assignment, the system detects the violation(s), blocks saving, and notifies the editor with clear, actionable messages; verify behavior for multiple violations and validation failures.  
**In Scope**: Rule validation at save time, notification content/visibility, blocking invalid saves, multiple-violation handling, safe failure when validation cannot run.  
**Out of Scope**: Full reviewer assignment workflow success (covered by UC-08), reviewer workload limit mechanics (covered by UC-09) beyond confirming violations are surfaced.

### Rules That May Generate Violations (examples consistent with CMS requirements)

- Exactly 3 reviewers required per paper.
- A reviewer cannot be assigned more than 5 papers.

---

## AT-UC10-01 — Notify on Invalid Reviewer Count (Too Few)

**Priority**: High  
**Preconditions**:

- Editor is logged in.
- Paper `P1` requires reviewer assignment.
- Eligible reviewers exist.

**Test Data**:

- Paper: `P1`
- Selected reviewers: `R1`, `R2` (2 reviewers)

**Steps**:

1. Open reviewer assignment for `P1`.
2. Select reviewers `R1` and `R2`.
3. Click **Save/Confirm**.

**Expected Results**:

- System validates assignment rules.
- System blocks saving the assignment.
- System displays a notification/error indicating the required number of reviewers (3).
- No assignments are saved.

**Pass/Fail Criteria**:

- PASS if save is blocked and notification is shown; FAIL otherwise.

---

## AT-UC10-02 — Notify on Invalid Reviewer Count (Too Many)

**Priority**: High  
**Preconditions**: Same as AT-UC10-01

**Test Data**:

- Paper: `P1`
- Selected reviewers: `R1`, `R2`, `R3`, `R4` (4 reviewers)

**Steps**:

1. Select 4 reviewers for `P1`.
2. Click **Save/Confirm**.

**Expected Results**:

- Save is blocked.
- Notification clearly states exactly 3 reviewers are required.
- No assignments are saved.

**Pass/Fail Criteria**:

- PASS if blocked with clear notification; FAIL otherwise.

---

## AT-UC10-03 — Notify on Reviewer Workload Violation

**Priority**: High  
**Preconditions**:

- Editor is logged in.
- Paper `P2` requires assignment.
- Reviewer `R5` already has 5 assigned papers.
- Other eligible reviewers exist.

**Test Data**:

- Paper: `P2`
- Selected reviewers: `R1`, `R2`, `R5`

**Steps**:

1. Open assignment for `P2`.
2. Select `R1`, `R2`, `R5`.
3. Click **Save/Confirm**.

**Expected Results**:

- System blocks save.
- System notifies editor that `R5` has reached maximum workload (5) and cannot be assigned.
- No assignments are saved (no partial save).

**Pass/Fail Criteria**:

- PASS if save blocked and workload violation message shown; FAIL otherwise.

---

## AT-UC10-04 — Multiple Violations: Notify All Detected Issues (Extension 4a)

**Priority**: High  
**Preconditions**:

- Editor logged in.
- Paper `P3` requires assignment.
- Reviewer `R5` has 5 assigned papers.

**Test Data**:

- Paper: `P3`
- Selected reviewers: `R5`, `R1` (2 reviewers AND one exceeds workload)

**Steps**:

1. Open assignment for `P3`.
2. Select `R5` and `R1` only.
3. Click **Save/Confirm**.

**Expected Results**:

- Save is blocked.
- System displays notifications for each violation:
  - Wrong reviewer count (needs 3)
  - Reviewer workload exceeded for `R5`
- No assignments are saved.

**Pass/Fail Criteria**:

- PASS if multiple violations are all shown clearly; FAIL otherwise.

---

## AT-UC10-05 — Correction Loop: Violations Clear After Fixing and Re-Saving

**Priority**: High  
**Preconditions**:

- Same setup as AT-UC10-03 (workload violation scenario).
- Reviewers `R1`, `R2`, `R3` each have <= 4 assigned papers.

**Test Data**:

- Paper: `P2`
- Initial selection: `R1`, `R2`, `R5` (invalid)
- Corrected selection: `R1`, `R2`, `R3` (valid)

**Steps**:

1. Attempt save with invalid selection `R1`, `R2`, `R5` and observe violation notification.
2. Replace `R5` with `R3`.
3. Click **Save/Confirm** again.

**Expected Results**:

- First attempt: save blocked with workload violation notification.
- Second attempt: validation passes, save succeeds, and success confirmation appears.
- Violation notifications no longer appear after correction.
- Exactly 3 assignments are saved.

**Pass/Fail Criteria**:

- PASS if user can correct issues and proceed; FAIL otherwise.

---

## AT-UC10-06 — Validation Failure: Notify Editor and Block Save (Extension 3a)

**Priority**: High  
**Preconditions**:

- Editor logged in.
- Paper `P4` requires assignment.
- Simulate validation dependency failure (e.g., DB read error for reviewer workloads, rule engine down).

**Test Data**:

- Paper: `P4`
- Selected reviewers: any set

**Steps**:

1. Open assignment for `P4`.
2. Select reviewers.
3. Click **Save/Confirm** while validation failure is active.

**Expected Results**:

- System blocks saving because it cannot validate rules reliably.
- System displays an error message indicating validation cannot be completed at this time.
- Error is logged (verifiable in test environment logs).
- No assignments are saved.

**Pass/Fail Criteria**:

- PASS if save is blocked and editor is informed; FAIL otherwise.

---

## AT-UC10-07 — Notification Quality: Message Is Clear and Actionable

**Priority**: Medium  
**Preconditions**:

- Editor logged in.
- Trigger any known violation (e.g., AT-UC10-01).

**Test Data**:

- Use AT-UC10-01 setup

**Steps**:

1. Trigger a rule violation.
2. Inspect the notification text and presentation.

**Expected Results**:

- Notification identifies:
  - What rule was violated (e.g., “3 reviewers required”)
  - What needs to change (e.g., “add 1 more reviewer” or “choose a different reviewer”)
- No technical stack traces or internal error codes shown to the editor.

**Pass/Fail Criteria**:

- PASS if message supports correction; FAIL otherwise.

---

## AT-UC10-08 — No Silent Failure: Save Cannot Proceed Without Feedback

**Priority**: Medium  
**Preconditions**:

- Editor logged in.
- Create any violation scenario.

**Test Data**:

- Any invalid selection

**Steps**:

1. Click **Save/Confirm** with an invalid assignment.

**Expected Results**:

- Either a violation notification or a validation error is displayed.
- The system never fails silently (no “nothing happens” state).
- Invalid data is not saved.

**Pass/Fail Criteria**:

- PASS if editor always receives feedback and invalid save is blocked; FAIL otherwise.

---

## Traceability (UC-10 Steps → Tests)

- **Detect violation + block save + notify editor** → AT-UC10-01, AT-UC10-02, AT-UC10-03
- **Extension 4a (multiple violations)** → AT-UC10-04
- **Correction after notification** → AT-UC10-05
- **Extension 3a (validation error)** → AT-UC10-06
- **Notification quality/robustness** → AT-UC10-07, AT-UC10-08
