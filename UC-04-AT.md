# Acceptance Test Suite — UC-04 Submit Paper for Review

## Overview

**Use Case**: UC-04 Submit Paper for Review  
**Objective**: Verify that an authenticated author can submit a paper with required metadata and a valid manuscript file, and that validation and failures are handled correctly.  
**In Scope**: Metadata validation, manuscript upload constraints (format/size), submission persistence, confirmation/redirect, failure handling.  
**Out of Scope**: Review assignment and reviewing workflow, “Save submission” draft behavior (covered by a separate use case if needed).

### Required Metadata (as per UC-04 / SRS expectations)

- Title
- Affiliations
- Contact information
- Abstract
- Keywords

### Manuscript Constraints (as per SRS expectations)

- Accepted formats: PDF, DOCX, LaTeX ZIP
- Maximum size: 7MB

---

## AT-UC04-01 — Successful Paper Submission (Main Success Scenario)

**Priority**: High  
**Preconditions**:

- Author is registered and logged in.
- CMS submission service and database are available.

**Test Data**:

- Metadata: valid values for all required fields (authors, affiliations, contact info, abstract, keywords, main source)
- Manuscript: `paper.pdf`, size <= 7MB

**Steps**:

1. Navigate to the paper submission page.
2. Fill in all required metadata fields with valid values.
3. Upload `paper.pdf` (<= 7MB).
4. Click **Submit**.

**Expected Results**:

- System validates required metadata fields (no blanks/invalid values).
- System validates file format and size.
- System stores metadata and manuscript successfully.
- System shows a success confirmation message.
- System redirects to a submission confirmation page before returning to the author’s home page.
- The new submission is visible in the author’s account (e.g., “Submitted” status or equivalent).

**Pass/Fail Criteria**:

- PASS if the submission is stored once and confirmation + redirect occur; FAIL otherwise.

---

## AT-UC04-02 — Reject Missing Required Metadata (Extension 6a)

**Priority**: High  
**Preconditions**:

- Author is logged in.

**Test Data**:

- Leave at least one required field blank (e.g., Abstract blank)
- Manuscript: valid `paper.pdf` (<= 7MB)

**Steps**:

1. Open the submission form.
2. Fill all fields except one required metadata field.
3. Upload a valid manuscript file.
4. Click **Submit**.

**Expected Results**:

- System rejects submission.
- System highlights each invalid field and shows an inline error label indicating what must be corrected.
- No paper submission record is created.
- Author remains on the submission page (or is returned to it) without redirecting to home.

**Pass/Fail Criteria**:

- PASS if submission is blocked and no record is created; FAIL otherwise.

---

## AT-UC04-03 — Reject Invalid Manuscript Format (Extension 4a)

**Priority**: High  
**Preconditions**:

- Author is logged in.

**Test Data**:

- Metadata: all valid
- Manuscript: `paper.txt` (or `.png`, `.exe`, etc.), size <= 7MB

**Steps**:

1. Fill all required metadata fields with valid values.
2. Upload a file with an invalid extension/format (e.g., `paper.txt`).
3. Click **Submit**.

**Expected Results**:

- System rejects submission.
- System displays an error message stating acceptable formats (PDF/Word/LaTeX).
- No submission record is created.

**Pass/Fail Criteria**:

- PASS if invalid format is blocked; FAIL otherwise.

---

## AT-UC04-04 — Reject Oversized Manuscript (> 7MB) (Extension 4a)

**Priority**: High  
**Preconditions**:

- Author is logged in.

**Test Data**:

- Metadata: all valid
- Manuscript: `large_paper.pdf`, size > 7MB

**Steps**:

1. Fill all required metadata fields with valid values.
2. Upload `large_paper.pdf` (> 7MB).
3. Click **Submit**.

**Expected Results**:

- System rejects submission.
- System displays an error indicating the file exceeds the maximum size.
- No submission record is created.

**Pass/Fail Criteria**:

- PASS if oversized file is blocked; FAIL otherwise.

---

## AT-UC04-05 — Accept PDF Format (Positive Format Coverage)

**Priority**: Medium  
**Preconditions**:

- Author is logged in.

**Test Data**:

- Metadata: all valid
- Manuscript: `paper.pdf` (<= 7MB)

**Steps**:

1. Submit a paper using a PDF manuscript.

**Expected Results**:

- Submission succeeds (same expected outcomes as AT-UC04-01).

**Pass/Fail Criteria**:

- PASS if PDF upload works end-to-end; FAIL otherwise.

---

## AT-UC04-06 — Accept Word Format (Positive Format Coverage)

**Priority**: Medium  
**Preconditions**:

- Author is logged in.

**Test Data**:

- Metadata: all valid
- Manuscript: `paper.docx` (<= 7MB)

**Steps**:

1. Submit a paper using a Word manuscript.

**Expected Results**:

- Submission succeeds (same expected outcomes as AT-UC04-01).

**Pass/Fail Criteria**:

- PASS if Word upload works end-to-end; FAIL otherwise.

---

## AT-UC04-07 — Accept LaTeX Format (Positive Format Coverage)

**Priority**: Medium  
**Preconditions**:

- Author is logged in.

**Test Data**:

- Metadata: all valid
- Manuscript: LaTeX source ZIP package (<= 7MB)

**Steps**:

1. Submit a paper using a LaTeX manuscript.

**Expected Results**:

- Submission succeeds (same expected outcomes as AT-UC04-01).

**Pass/Fail Criteria**:

- PASS if LaTeX upload works end-to-end; FAIL otherwise.

---

## AT-UC04-08 — Handle System/Database Failure During Submission (Extension 7a)

**Priority**: High  
**Preconditions**:

- Author is logged in.
- Simulate DB outage or write failure during save.

**Test Data**:

- Metadata: all valid
- Manuscript: valid `paper.pdf` (<= 7MB)

**Steps**:

1. Fill in valid metadata.
2. Upload valid manuscript.
3. Click **Submit** while DB failure is active.

**Expected Results**:

- System displays a user-safe, non-technical message stating the submission was not saved and advising retry later or contact support.
- Error is logged (verifiable in test environment logs).
- No partial submission is created (no orphan record / broken status).
- Author is not redirected to home as “successful.”

**Pass/Fail Criteria**:

- PASS if system fails safely and no submission is created; FAIL otherwise.

---

## AT-UC04-09 — Prevent Duplicate Submissions on Double-Click

**Priority**: Medium  
**Preconditions**:

- Author is logged in.
- System available.

**Test Data**:

- Metadata: all valid
- Manuscript: valid `paper.pdf` (<= 7MB)

**Steps**:

1. Fill valid metadata and upload manuscript.
2. Click **Submit** twice quickly (or refresh/resubmit).

**Expected Results**:

- System creates at most one submission record for that action.
- User sees a single success confirmation (or a safe duplicate-detection message).
- No server error/stack trace is shown.

**Pass/Fail Criteria**:

- PASS if exactly one submission is created; FAIL otherwise.

---

## AT-UC04-10 — Block Duplicate Submission Within Submission Window (Extension 6b)

**Priority**: High  
**Preconditions**:

- Author is logged in.
- A submission already exists for the same paper within the current submission window.

**Test Data**:

- Metadata: same author and same title as existing submission
- Manuscript: same file content as existing submission (<= 7MB)

**Steps**:

1. Attempt to submit the duplicate paper within the submission window.

**Expected Results**:

- System blocks the submission.
- System informs the author that a submission already exists.
- No new submission record is created.

**Pass/Fail Criteria**:

- PASS if duplicate is blocked and no new record is created; FAIL otherwise.

---

## AT-UC04-11 — Authorization: Block Submission When Not Logged In

**Priority**: High  
**Preconditions**:

- User is not logged in.

**Test Data**:

- None

**Steps**:

1. Attempt to access the submission page directly (via menu or URL).
2. Attempt to submit a paper (if the form is accessible).

**Expected Results**:

- System prevents access to submission features (redirect to login or show access denied).
- No submission is created.

**Pass/Fail Criteria**:

- PASS if unauthenticated submission is blocked; FAIL otherwise.

---

## Traceability (UC-04 Steps → Tests)

- **Main Success Scenario** → AT-UC04-01
- **Extension 4a (invalid/oversized file)** → AT-UC04-03, AT-UC04-04
- **Extension 6a (missing/invalid metadata)** → AT-UC04-02
- **Extension 6b (duplicate submission)** → AT-UC04-10
- **Extension 7a (system/DB error)** → AT-UC04-08
- **Format coverage** → AT-UC04-05, AT-UC04-06, AT-UC04-07
- **Robustness & security** → AT-UC04-09, AT-UC04-11
