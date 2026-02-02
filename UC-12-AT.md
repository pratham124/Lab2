# Acceptance Test Suite — UC-12 Access Assigned Papers for Review

## Overview

**Use Case**: UC-12 Access Assigned Papers for Review  
**Objective**: Verify that an authenticated reviewer who has accepted invitations can view their assigned papers and access paper content; verify behavior when no assignments exist, retrieval fails, or unauthorized access is attempted.  
**In Scope**: Assigned papers list retrieval/display, access to paper content, authorization checks, error handling.  
**Out of Scope**: Completing/submitting reviews (separate use case), invitation acceptance workflow, offline downloads (explicitly excluded).

---

## AT-UC12-01 — View Assigned Papers List (Main Success Scenario)

**Priority**: High  
**Preconditions**:

- Reviewer account `R1` exists and is registered.
- Reviewer `R1` is logged in.
- Reviewer `R1` has accepted at least one invitation.
- At least one paper is assigned to `R1` (e.g., `P1`).
- CMS and database are available.

**Test Data**:

- Reviewer: `R1`
- Assigned papers: `P1` (and optionally `P2`)

**Steps**:

1. Log in as reviewer `R1`.
2. Navigate to “Assigned Reviews” / “My Assigned Papers” page.

**Expected Results**:

- System retrieves the assigned papers for `R1`.
- System displays a list including `P1` (and any other assigned papers).
- Each item is clearly identifiable (paper title/ID).

**Pass/Fail Criteria**:

- PASS if assigned list is shown correctly; FAIL otherwise.

---

## AT-UC12-02 — Open an Assigned Paper and View Content (Main Success Scenario)

**Priority**: High  
**Preconditions**:

- Same as AT-UC12-01.
- Paper `P1` has an uploaded manuscript and is accessible.

**Test Data**:

- Reviewer: `R1`
- Paper: `P1`

**Steps**:

1. From the assigned papers list, select `P1`.
2. Open/view the manuscript.

**Expected Results**:

- System displays the paper content (manuscript) and relevant review information.
- Access is granted without authorization errors.
- No broken links or missing file errors occur (assuming manuscript exists).

**Pass/Fail Criteria**:

- PASS if paper content loads successfully for an assigned paper; FAIL otherwise.

---

## AT-UC12-03 — No Assigned Papers Message (Extension 3a)

**Priority**: High  
**Preconditions**:

- Reviewer account `R2` exists and is logged in.
- Reviewer `R2` has accepted no invitations OR has zero current assignments.

**Test Data**:

- Reviewer: `R2` (assigned papers = 0)

**Steps**:

1. Log in as reviewer `R2`.
2. Navigate to assigned papers page.

**Expected Results**:

- System displays a clear message indicating no papers are currently assigned.
- List is empty and no errors are shown.

**Pass/Fail Criteria**:

- PASS if empty-state is handled clearly; FAIL otherwise.

---

## AT-UC12-04 — Handle Retrieval Error for Assigned Papers List (Extension 4a)

**Priority**: High  
**Preconditions**:

- Reviewer `R1` exists and is logged in.
- Simulate database read failure or assignment retrieval service outage.

**Test Data**:

- Reviewer: `R1`

**Steps**:

1. Log in as `R1`.
2. Navigate to assigned papers page while retrieval failure is active.

**Expected Results**:

- System shows a clear error indicating assigned papers cannot be retrieved at this time.
- Error message includes a brief failure statement and a suggested next step (e.g., “Please try again later”).
- A visible link/button returns the reviewer to the assigned papers list.
- No stack traces or sensitive technical details are shown.
- Error is logged (verifiable in test environment logs).

**Pass/Fail Criteria**:

- PASS if error is handled safely and clearly; FAIL otherwise.

---

## AT-UC12-05 — Unauthorized Access Blocked for Unassigned Paper (Extension 6a)

**Priority**: High  
**Preconditions**:

- Reviewer `R1` is logged in.
- Paper `P9` exists but is **not** assigned to `R1`.

**Test Data**:

- Reviewer: `R1`
- Unassigned paper: `P9`

**Steps**:

1. Attempt to open `P9` directly (via URL or direct link).
2. Observe system response.

**Expected Results**:

- System denies access with an “Access denied” message (treated as 403).
- Paper content is not displayed.
- Reviewer remains within reviewer pages and can return to the assigned list.

**Pass/Fail Criteria**:

- PASS if unassigned paper is inaccessible; FAIL otherwise.

---

## AT-UC12-06 — Authorization: Assigned Papers Are Private Per Reviewer

**Priority**: Medium  
**Preconditions**:

- Reviewer `R1` has `P1` assigned.
- Reviewer `R3` exists, logged in, and does not have `P1` assigned.

**Test Data**:

- Paper: `P1`

**Steps**:

1. Log in as `R3`.
2. Attempt to access `P1` via direct URL.

**Expected Results**:

- Access is denied for `R3` with an “Access denied” message (treated as 403).
- Only `R1` can access `P1` through assigned list.

**Pass/Fail Criteria**:

- PASS if access control is enforced; FAIL otherwise.

---

## AT-UC12-07 — Multiple Assigned Papers Listed Correctly

**Priority**: Medium  
**Preconditions**:

- Reviewer `R1` is logged in.
- Reviewer `R1` has multiple assigned papers: `P1`, `P2`, `P3`.

**Test Data**:

- Reviewer: `R1`
- Papers: `P1`, `P2`, `P3`

**Steps**:

1. Navigate to assigned papers list.
2. Verify all assigned papers appear.

**Expected Results**:

- All assigned papers are listed.
- No duplicates or missing items.
- Items are distinguishable (unique titles/IDs).

**Pass/Fail Criteria**:

- PASS if list is correct and complete; FAIL otherwise.

---

## AT-UC12-08 — Paper Exists but Manuscript Not Available (Robustness)

**Priority**: Low  
**Preconditions**:

- Reviewer `R1` is logged in.
- Paper `P10` is assigned to `R1`.
- Manuscript file for `P10` is missing/unavailable (simulate missing file or storage error).

**Test Data**:

- Reviewer: `R1`
- Paper: `P10`

**Steps**:

1. From assigned list, open `P10`.
2. Attempt to view manuscript.

**Expected Results**:

- System displays a clear error that the manuscript cannot be accessed.
- Error message includes a brief failure statement and a suggested next step.
- A visible link/button returns the reviewer to the assigned papers list.
- No unauthorized disclosure occurs.
- System does not crash and provides a way to return to the list.

**Pass/Fail Criteria**:

- PASS if missing file is handled gracefully; FAIL otherwise.

---

## AT-UC12-09 — Download Attempt Is Not Available (Extension 6b)

**Priority**: Medium  
**Preconditions**:

- Reviewer `R1` is logged in.
- Paper `P1` is assigned to `R1` and viewable.

**Test Data**:

- Reviewer: `R1`
- Paper: `P1`

**Steps**:

1. Navigate to `P1` from the assigned papers list.
2. Attempt to download the manuscript (e.g., look for download option or use a direct download link if present).

**Expected Results**:

- No download option is provided for the manuscript.
- If a direct download attempt is made, the system prevents the download and keeps view-only access.
- Reviewer can continue viewing the paper in the system.

**Pass/Fail Criteria**:

- PASS if downloads are unavailable and view-only access is maintained; FAIL otherwise.

---

## Traceability (UC-12 Steps → Tests)

- **Main Success Scenario (list + access paper)** → AT-UC12-01, AT-UC12-02
- **Extension 3a (no assignments)** → AT-UC12-03
- **Extension 4a (retrieval failure)** → AT-UC12-04
- **Extension 6a (unauthorized access)** → AT-UC12-05, AT-UC12-06
- **Robustness/coverage** → AT-UC12-07, AT-UC12-08
- **Extension 6b (download attempt)** → AT-UC12-09
