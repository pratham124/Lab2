# Acceptance Test Suite — UC-06 Save Paper Submission Progress

## Overview

**Use Case**: UC-06 Save Paper Submission Progress  
**Objective**: Verify that an authenticated author can save an in-progress submission as a draft and resume it later, and that invalid data and system failures are handled correctly.  
**In Scope**: Draft save action, basic validation on save, draft persistence, confirmation messaging, resume behavior.  
**Out of Scope**: Final submission behavior (UC-04), manuscript upload specifics (UC-05), editorial review workflow.

---

## AT-UC06-01 — Save Draft Successfully (Main Success Scenario)

**Priority**: High  
**Preconditions**:

- Author is registered and logged in.
- Author has started a new paper submission (submission form accessible).
- CMS and database are available.

**Test Data**:

- Partial metadata entered (e.g., Title/Authors/Abstract filled, Keywords empty).
- Manuscript upload optional for this test (none uploaded).

**Steps**:

1. Navigate to the paper submission form.
2. Enter some (not necessarily all) submission information.
3. Click **Save**.

**Expected Results**:

- System performs basic validation on entered fields.
- System stores the submission as a draft associated with the author.
- System displays a “saved successfully” confirmation.
- Draft is visible in author’s account (e.g., list of submissions) with status “Draft” (or equivalent).

**Pass/Fail Criteria**:

- PASS if draft is created and confirmation shown; FAIL otherwise.

---

## AT-UC06-02 — Resume Draft Later

**Priority**: High  
**Preconditions**:

- AT-UC06-01 completed successfully (a draft exists).
- Author can log out / end session.

**Test Data**:

- Existing draft created in AT-UC06-01.

**Steps**:

1. Log out (or end session).
2. Log in again as the same author.
3. Navigate to “My Submissions” (or equivalent).
4. Open the draft submission.

**Expected Results**:

- Draft is accessible to the same author.
- Previously saved data is pre-populated in the form exactly as saved.
- Author can continue editing from the saved state.

**Pass/Fail Criteria**:

- PASS if draft loads with saved content; FAIL otherwise.

---

## AT-UC06-03 — Save Draft With Minimal Information

**Priority**: Medium  
**Preconditions**:

- Author is logged in and on submission form.

**Test Data**:

- Only one or two fields filled (e.g., Title only), others blank.

**Steps**:

1. Enter minimal information.
2. Click **Save**.

**Expected Results**:

- System either saves successfully (if minimal drafts are allowed) **or** blocks save with a clear validation message.
- Behavior is consistent and communicated clearly to the user.

**Pass/Fail Criteria**:

- PASS if system behaves consistently with clear feedback; FAIL if ambiguous or inconsistent.

---

## AT-UC06-04 — Reject Save When Entered Data Is Invalid (Extension 3a)

**Priority**: High  
**Preconditions**:

- Author is logged in and on submission form.

**Test Data**:

- Enter invalid data in at least one field (e.g., malformed email in contact info, invalid characters, etc.).

**Steps**:

1. Enter some fields, including at least one invalid field value.
2. Click **Save**.

**Expected Results**:

- System detects invalid/inconsistent information during validation.
- System does not save the draft.
- System displays a warning/error indicating which fields must be corrected.

**Pass/Fail Criteria**:

- PASS if no draft is saved and user receives field-specific guidance; FAIL otherwise.

---

## AT-UC06-05 — Handle System/Database Failure During Save (Extension 4a)

**Priority**: High  
**Preconditions**:

- Author is logged in and on submission form.
- Simulate database outage or write failure.

**Test Data**:

- Partial valid submission data.

**Steps**:

1. Enter valid partial submission information.
2. Click **Save** while DB failure is active.

**Expected Results**:

- System displays a save failure message (non-technical).
- Error is logged (verifiable in test environment logs).
- No draft is created or updated (no partial/corrupt record).

**Pass/Fail Criteria**:

- PASS if system fails safely with no draft saved/updated; FAIL otherwise.

---

## AT-UC06-06 — Update Existing Draft (Overwrite/Update Behavior)

**Priority**: Medium  
**Preconditions**:

- A draft exists for the author (from AT-UC06-01).
- Author is logged in and has opened the draft.

**Test Data**:

- Modify one or more fields (e.g., add keywords, change abstract).

**Steps**:

1. Open existing draft.
2. Modify draft fields.
3. Click **Save** again.

**Expected Results**:

- System updates the existing draft (does not create an unintended duplicate unless versioning is intended).
- System confirms save success.
- Reopening the draft shows the updated values.

**Pass/Fail Criteria**:

- PASS if draft updates persist correctly; FAIL otherwise.

---

## AT-UC06-07 — Prevent Duplicate Draft Records on Rapid Save Clicks

**Priority**: Low  
**Preconditions**:

- Author is logged in and on submission form.

**Test Data**:

- Partial valid submission data.

**Steps**:

1. Click **Save** twice rapidly (double-click).
2. Check the author’s draft list.

**Expected Results**:

- System creates/updates at most one draft record for that submission.
- No duplicate drafts appear due to double submission.
- No server error/stack trace is shown.

**Pass/Fail Criteria**:

- PASS if duplication is prevented/handled cleanly; FAIL otherwise.

---

## AT-UC06-08 — Authorization: Draft Is Private to the Author

**Priority**: Medium  
**Preconditions**:

- A draft exists for Author A.
- A separate account exists for Author B.

**Test Data**:

- Draft created by Author A.

**Steps**:

1. Log in as Author B.
2. Attempt to access Author A’s draft (via URL guessing or navigation if possible).

**Expected Results**:

- System denies access (redirect to login/403/not found as appropriate).
- Author B cannot view or modify Author A’s draft.

**Pass/Fail Criteria**:

- PASS if drafts are access-controlled correctly; FAIL otherwise.

---

## Traceability (UC-06 Steps → Tests)

- **Main Success Scenario** → AT-UC06-01, AT-UC06-02
- **Extension 3a (invalid/inconsistent info)** → AT-UC06-04
- **Extension 4a (system/DB error)** → AT-UC06-05
- **Draft lifecycle robustness** → AT-UC06-03, AT-UC06-06, AT-UC06-07, AT-UC06-08
