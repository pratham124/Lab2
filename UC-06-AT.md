# Acceptance Test Suite — UC-06 Save Paper Submission Progress

## Overview

**Use Case**: UC-06 Save Paper Submission Progress  
**Objective**: Verify draft save/resume/update behavior with owner-only access, idempotent repeat saves, and last-write-wins updates.  
**In Scope**: Save Draft endpoint/UI, validation of provided fields only, draft persistence, resume behavior, authorization, failure logging.  
**Out of Scope**: Final submission workflow and manuscript upload requirements.

---

## AT-UC06-01 — Save Draft Successfully (Main Success Scenario)

**Preconditions**:
- Authenticated author session exists.
- Submission form is open.

**Steps**:
1. Enter partial values (for example title + abstract).
2. Click **Save Draft**.

**Expected Results**:
- System validates only provided fields.
- System saves a draft for the submission.
- System shows visible success confirmation and last-saved timestamp.

---

## AT-UC06-02 — Resume Draft Later

**Preconditions**:
- Draft exists from AT-UC06-01.

**Steps**:
1. Sign out, then sign in again as the same author.
2. Open submission form with the draft identifier.

**Expected Results**:
- Draft loads for the same author.
- Saved values are pre-populated and editable.

---

## AT-UC06-03 — Save Draft With Minimal Information

**Preconditions**:
- Authenticated author session exists.

**Steps**:
1. Leave fields empty or enter only one field.
2. Click **Save Draft**.

**Expected Results**:
- Save succeeds (no required fields for drafts).
- System still validates any provided fields.

---

## AT-UC06-04 — Reject Invalid Provided Data

**Preconditions**:
- Authenticated author session exists.

**Steps**:
1. Enter invalid provided value (for example `contact_email = bad-email`).
2. Click **Save Draft**.

**Expected Results**:
- Save is rejected.
- Field-level warning is shown for invalid field(s).
- Existing draft is not overwritten by invalid save.

---

## AT-UC06-05 — Handle Save Failure Safely

**Preconditions**:
- Authenticated author session exists.
- Persistence failure is simulated.

**Steps**:
1. Enter valid partial data.
2. Click **Save Draft**.

**Expected Results**:
- System returns a safe failure message.
- Failure is logged.
- No partial/corrupt draft is stored.

---

## AT-UC06-06 — Update Existing Draft (No Duplicate)

**Preconditions**:
- Draft exists for submission.

**Steps**:
1. Save draft once.
2. Change one or more fields.
3. Save again.

**Expected Results**:
- Same draft record is updated.
- No duplicate draft for same submission is created.

---

## AT-UC06-07 — Rapid Double Save Is Idempotent

**Preconditions**:
- Authenticated author session exists.

**Steps**:
1. Trigger two rapid save actions with same payload.

**Expected Results**:
- Request handling is idempotent.
- At most one saved state exists for that submission.

---

## AT-UC06-08 — Draft Is Private to Owner

**Preconditions**:
- Draft exists for Author A.
- Separate account Author B exists.

**Steps**:
1. Authenticate as Author B.
2. Attempt to read/update Author A draft.

**Expected Results**:
- Access is denied.
- Unauthorized attempt is logged.

---

## AT-UC06-09 — Last-Write-Wins on Stale Save

**Preconditions**:
- Draft exists and is updated by one client.

**Steps**:
1. Save draft from Client A.
2. Save newer draft from Client B.
3. Save stale payload again from Client A (older expected timestamp).

**Expected Results**:
- System applies last-write-wins.
- Final draft reflects the most recent accepted save.
- Response indicates conflict was handled with overwrite policy.
