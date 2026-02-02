# Acceptance Test Suite — UC-13 Submit Completed Review Form

## Overview

**Use Case**: UC-13 Submit Completed Review Form  
**Objective**: Verify that an authenticated reviewer can complete and submit a review form for an assigned paper, that validation prevents incomplete/invalid submissions, that unauthorized submissions are blocked, and that failures are handled safely.  
**In Scope**: Review form display, required-field validation, successful persistence of review, confirmation to reviewer, visibility to editor, authorization checks, error handling.  
**Out of Scope**: Editing a submitted review (not specified), scoring scale semantics, editor decision workflow.

---

## AT-UC13-01 — Successful Review Submission (Main Success Scenario)

**Priority**: High  
**Preconditions**:

- Reviewer `R1` is registered and logged in.
- Reviewer `R1` has accepted an invitation for paper `P1`.
- Paper `P1` is assigned to `R1` and accessible.
- Review form exists for `P1`.
- CMS and database are available.

**Test Data**:

- Paper: `P1`
- Review form inputs: valid values in all required fields (e.g., overall rating, confidence, comments)

**Steps**:

1. Log in as reviewer `R1`.
2. Navigate to assigned papers list.
3. Open paper `P1` and open its review form.
4. Fill all required fields with valid data.
5. Click **Submit Review**.

**Expected Results**:

- System validates completeness/correctness of required fields.
- System stores the review in the database.
- System shows a submission success confirmation to the reviewer.
- Review status for `P1` changes to “Submitted” (or equivalent).
- The review becomes available to the editor.

**Pass/Fail Criteria**:

- PASS if review is saved once, confirmed, and available to editor; FAIL otherwise.

---

## AT-UC13-02 — Editor Can View Submitted Review (Availability to Editor)

**Priority**: High  
**Preconditions**:

- AT-UC13-01 completed successfully (review exists).
- Editor account `E1` exists and is logged in.
- Paper `P1` is within editor’s scope.

**Test Data**:

- Paper: `P1`
- Review by: `R1`

**Steps**:

1. Log in as editor `E1`.
2. Navigate to paper `P1` review management page (or equivalent).
3. View the list of reviews for `P1`.

**Expected Results**:

- The review submitted by `R1` is visible to the editor.
- The displayed content matches what `R1` submitted (ratings/comments).

**Pass/Fail Criteria**:

- PASS if editor can view the submitted review; FAIL otherwise.

---

## AT-UC13-03 — Reject Submission With Missing Required Fields (Extension 5a)

**Priority**: High  
**Preconditions**:

- Reviewer `R1` logged in.
- `P1` assigned and review form accessible.

**Test Data**:

- Leave at least one required field empty (e.g., overall rating missing).

**Steps**:

1. Open review form for `P1`.
2. Fill some fields but leave at least one required field blank.
3. Click **Submit Review**.

**Expected Results**:

- System blocks submission.
- System displays an error indicating which fields are missing/invalid.
- Review is not stored.
- Reviewer remains on the review form page with an opportunity to correct fields.

**Pass/Fail Criteria**:

- PASS if incomplete form cannot be submitted and error is shown; FAIL otherwise.

---

## AT-UC13-03b — Block Resubmission After Successful Submission (Extension 6b)

**Priority**: High  
**Preconditions**:

- AT-UC13-01 completed successfully (review exists).
- Reviewer `R1` is logged in and assigned to `P1`.

**Test Data**:

- Paper: `P1`
- Review form inputs: any values (valid or invalid)

**Steps**:

1. Attempt to submit a review for `P1` again.

**Expected Results**:

- System blocks the submission.
- System displays a message that only one submission is allowed.
- No new or updated review is stored.

**Pass/Fail Criteria**:

- PASS if resubmission is blocked with the correct message and no new review is stored; FAIL otherwise.

---

## AT-UC13-04 — Reject Submission With Invalid Field Values (Extension 5a)

**Priority**: Medium  
**Preconditions**:

- Reviewer `R1` logged in.
- `P1` assigned and review form accessible.

**Test Data**:

- Enter an invalid value (e.g., non-numeric in numeric rating field, out-of-range rating).

**Steps**:

1. Open review form for `P1`.
2. Enter invalid value in a constrained field.
3. Click **Submit Review**.

**Expected Results**:

- System blocks submission.
- System displays a clear validation message for invalid field(s).
- Review is not stored.

**Pass/Fail Criteria**:

- PASS if invalid values are rejected; FAIL otherwise.

---

## AT-UC13-05 — Handle System/Database Failure During Save (Extension 6a)

**Priority**: High  
**Preconditions**:

- Reviewer `R1` logged in.
- `P1` assigned and form filled validly.
- Simulate DB outage or write failure at submission time.

**Test Data**:

- Valid completed review form inputs.

**Steps**:

1. Fill review form for `P1` with valid inputs.
2. Click **Submit Review** while DB failure is active.

**Expected Results**:

- System displays a submission failure message (non-technical).
- Error is logged (verifiable in test environment logs).
- Review is not partially saved (no corrupt/partial record).
- Reviewer is not shown a success state.

**Pass/Fail Criteria**:

- PASS if failure is handled safely with no partial save; FAIL otherwise.

---

## AT-UC13-06 — Unauthorized Submission Blocked for Unassigned Paper (Extension 3a)

**Priority**: High  
**Preconditions**:

- Reviewer `R1` logged in.
- Paper `P9` exists but is not assigned to `R1`.
- A review form endpoint exists for `P9` (accessible only with authorization).

**Test Data**:

- Paper: `P9`

**Steps**:

1. Attempt to access the review form for `P9` directly (via URL or crafted request).
2. Attempt to submit any review data.

**Expected Results**:

- System denies access and/or submission.
- System shows an authorization error message.
- No review is stored for `P9` from `R1`.

**Pass/Fail Criteria**:

- PASS if unauthorized review cannot be submitted; FAIL otherwise.

---

## AT-UC13-07 — Prevent Duplicate Reviews on Double-Submit

**Priority**: Medium  
**Preconditions**:

- Reviewer `R1` logged in.
- `P1` assigned and form valid.

**Test Data**:

- Valid completed review form inputs.

**Steps**:

1. Fill review form for `P1`.
2. Click **Submit Review** twice quickly (double-click) or resend request.

**Expected Results**:

- System creates at most one review submission record for `R1` on `P1`.
- Reviewer sees one success confirmation (or deduplicated safe messaging).
- No duplicate entries appear for editor.

**Pass/Fail Criteria**:

- PASS if duplicates are prevented/handled cleanly; FAIL otherwise.

---

## AT-UC13-08 — Post-Submission State: Review Marked Submitted and Not Editable (If Implemented)

**Priority**: Low  
**Preconditions**:

- AT-UC13-01 completed successfully.

**Test Data**:

- Paper: `P1`

**Steps**:

1. As reviewer `R1`, revisit the review form for `P1` after submission.

**Expected Results**:

- System indicates the review is submitted.
- If editing is not supported, inputs are read-only or submission is blocked with a clear message.
- If editing is supported, behavior is consistent and clearly indicated (record actual behavior).

**Pass/Fail Criteria**:

- PASS if post-submission behavior is clear and consistent; FAIL otherwise.

---

## Traceability (UC-13 Steps → Tests)

- **Main Success Scenario** → AT-UC13-01
- **Review available to editor** → AT-UC13-02
- **Extension 5a (incomplete/invalid form)** → AT-UC13-03, AT-UC13-04
- **Extension 6a (system/DB error)** → AT-UC13-05
- **Extension 3a (unauthorized submission)** → AT-UC13-06
- **Robustness** → AT-UC13-07, AT-UC13-08
