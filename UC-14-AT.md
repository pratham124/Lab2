# Acceptance Test Suite — UC-14 View Completed Reviews for a Paper

## Overview

**Use Case**: UC-14 View Completed Reviews for a Paper  
**Objective**: Verify that an authenticated editor can view all completed reviews for a selected paper, that empty states are handled when none are completed, that unauthorized access is blocked, and that retrieval errors are handled safely.  
**In Scope**: Review list retrieval/display, completeness (all completed reviews), review content visibility, authorization checks, error handling/logging.  
**Out of Scope**: Making the final decision (separate use case), reviewer anonymity rules, review scoring semantics beyond being displayed.

---

## AT-UC14-01 — Editor Can View Completed Reviews (Main Success Scenario)

**Priority**: High  
**Preconditions**:

- Editor `E1` is registered and logged in.
- Paper `P1` exists and is managed by `E1`.
- At least one completed review exists for `P1` (e.g., from reviewer `R1`).
- CMS and database are available.

**Test Data**:

- Paper: `P1`
- Completed reviews: `R1` (and optionally `R2`, `R3`)

**Steps**:

1. Log in as editor `E1`.
2. Navigate to submitted papers list.
3. Select paper `P1`.
4. Choose “View completed reviews”.

**Expected Results**:

- System retrieves completed reviews for `P1`.
- System displays the completed review(s) content (scores/comments as stored).
- Editor can read the full text of each review.
- No errors are shown.

**Pass/Fail Criteria**:

- PASS if completed reviews display correctly for the paper; FAIL otherwise.

---

## AT-UC14-02 — All Completed Reviews Are Shown (Completeness Check)

**Priority**: High  
**Preconditions**:

- Editor `E1` logged in.
- Paper `P2` exists and is managed by `E1`.
- Exactly 3 reviews exist for `P2`, but only 2 are completed (submitted), 1 is pending.
  - `R1`: submitted
  - `R2`: submitted
  - `R3`: not submitted

**Test Data**:

- Paper: `P2`
- Completed reviews: `R1`, `R2`
- Pending review: `R3`

**Steps**:

1. Open `P2` as editor `E1`.
2. Select “View completed reviews”.

**Expected Results**:

- System displays only the completed reviews (`R1`, `R2`).
- System does not incorrectly display the pending review as completed.
- If the UI indicates counts/status, it reflects 2 completed reviews.

**Pass/Fail Criteria**:

- PASS if the set of completed reviews is correct; FAIL otherwise.

---

## AT-UC14-03 — No Completed Reviews Message (Extension 2a)

**Priority**: High  
**Preconditions**:

- Editor `E1` logged in.
- Paper `P3` exists and is managed by `E1`.
- No reviews have been submitted for `P3` (all pending or none exist).

**Test Data**:

- Paper: `P3` (completed reviews = 0)

**Steps**:

1. Select `P3` as editor `E1`.
2. Click “View completed reviews”.

**Expected Results**:

- System displays a clear message indicating no completed reviews are available yet.
- System does not show an error state.
- Editor remains able to navigate elsewhere.

**Pass/Fail Criteria**:

- PASS if empty state is handled clearly; FAIL otherwise.

---

## AT-UC14-04 — Handle Retrieval Error Gracefully (Extension 6a)

**Priority**: High  
**Preconditions**:

- Editor `E1` logged in.
- Paper `P1` exists and has at least one completed review.
- Simulate database read failure or review retrieval service outage.

**Test Data**:

- Paper: `P1`

**Steps**:

1. Navigate to `P1` and select “View completed reviews” while retrieval failure is active.

**Expected Results**:

- System displays an error message indicating reviews cannot be retrieved at this time.
- No technical stack trace or sensitive internal details are shown.
- Error is logged (verifiable in test environment logs).

**Pass/Fail Criteria**:

- PASS if system fails safely with clear messaging and logs the issue; FAIL otherwise.

---

## AT-UC14-05 — Authorization: Editor Cannot View Reviews for Unauthorized Paper (Extension 3a)

**Priority**: High  
**Preconditions**:

- Editor `E1` is logged in.
- Paper `P9` exists but is not managed/accessible by `E1` (belongs to another editor or restricted).
- Completed reviews exist for `P9`.

**Test Data**:

- Paper: `P9`

**Steps**:

1. As `E1`, attempt to access `P9` review page directly (URL) or via any navigation path.
2. Attempt to view completed reviews.

**Expected Results**:

- System denies access (access denied/403/not found/redirect as implemented).
- Reviews are not displayed.
- No review content leaks.

**Pass/Fail Criteria**:

- PASS if unauthorized access is blocked; FAIL otherwise.

---

## AT-UC14-06 — Review Content Matches What Reviewers Submitted

**Priority**: Medium  
**Preconditions**:

- Editor `E1` logged in.
- Paper `P4` exists with one completed review by `R1` containing known text/ratings.

**Test Data**:

- Paper: `P4`
- Known review content: “Strengths: …”, rating value, etc.

**Steps**:

1. Open `P4` and view completed reviews.
2. Compare displayed review content with stored/expected test data.

**Expected Results**:

- Displayed review content matches what was submitted (no truncation/mismatch beyond UI display limits).
- No fields are swapped or missing (where required by the form).

**Pass/Fail Criteria**:

- PASS if displayed content is correct; FAIL otherwise.

---

## AT-UC14-07 — Multiple Reviews Displayed Without Duplication

**Priority**: Low  
**Preconditions**:

- Editor `E1` logged in.
- Paper `P5` exists with 3 completed reviews.

**Test Data**:

- Paper: `P5`
- Completed reviews: `R1`, `R2`, `R3`

**Steps**:

1. View completed reviews for `P5`.
2. Scroll through list.

**Expected Results**:

- Exactly 3 reviews are shown (no duplicates).
- Each review is distinguishable (reviewer ID masked or shown depending on implementation, but entries are unique).

**Pass/Fail Criteria**:

- PASS if correct count and no duplicates; FAIL otherwise.

---

## Traceability (UC-14 Steps → Tests)

- **Main Success Scenario (retrieve and display)** → AT-UC14-01
- **Correct set of “completed” reviews** → AT-UC14-02
- **Extension 2a (none completed)** → AT-UC14-03
- **Extension 6a (retrieval error)** → AT-UC14-04
- **Extension 3a (unauthorized access)** → AT-UC14-05
- **Data correctness & robustness** → AT-UC14-06, AT-UC14-07
