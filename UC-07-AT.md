# Acceptance Test Suite — UC-07 Receive Final Paper Decision

## Overview

**Use Case**: UC-07 Receive Final Paper Decision  
**Objective**: Verify that a submitting author is informed of a final accept/reject decision and can view it in CMS only after official publication; verify resilience to notification failure, delayed viewing, and retrieval failures.  
**In Scope**: Decision persistence, publish-gated visibility, notification attempt to submitting author only, authorization, error handling, no reviewer comments in author-facing responses.  
**Out of Scope**: Creating decisions (editor workflow), multi-channel notification rules.

---

## AT-UC07-01 — Submitting Author Can View Final Decision Only After Publish

**Priority**: High  
**Preconditions**:

- Author account exists and is registered.
- Author has submitted Paper P1.
- All required reviews for P1 are completed.
- Editor has recorded a final decision for P1 (Accepted or Rejected).
- `published_at` is initially not set.
- CMS and database are available.

**Test Data**:

- Paper: `P1`
- Decision: `Accepted` (repeat test with `Rejected` if desired)

**Steps**:

1. Log in as the submitting author.
2. Navigate to “My Submissions” (or equivalent) before decision publication.
3. Confirm decision value for `P1` is not visible.
4. Publish the decision for `P1` by setting `published_at`.
5. Refresh “My Submissions” and open paper `P1`.

**Expected Results**:

- Before publish, decision value is not visible.
- After publish, the final decision is displayed clearly (Accepted/Rejected).
- The displayed decision matches the decision stored by the editor.
- Submitting author can access the decision without errors.

**Pass/Fail Criteria**:

- PASS if decision is hidden before publish and visible after publish for the submitting author; FAIL otherwise.

---

## AT-UC07-02 — Notification Sent to Submitting Author Only at Publish Time

**Priority**: Medium  
**Preconditions**:

- Same as AT-UC07-01.
- Notification/email service is operational.
- Test environment can observe notification events (email inbox stub/log).

**Test Data**:

- Paper: `P1`
- Decision: `Accepted` or `Rejected`

**Steps**:

1. Record the final decision for `P1` (performed by editor or test harness).
2. Publish the decision for `P1`.
3. Check notification delivery events (email inbox stub/log/event queue).

**Expected Results**:

- System attempts to send one notification email to the submitting author indicating a decision is available.
- No co-author/non-submitting user receives the decision notification.
- Notification is delivered successfully (in environments where delivery is verifiable).

**Pass/Fail Criteria**:

- PASS if exactly the submitting author is targeted and delivery succeeds when service is available; FAIL otherwise.

---

## AT-UC07-03 — Decision Available Even If Notification Fails (Extension 3a)

**Priority**: High  
**Preconditions**:

- Same as AT-UC07-01.
- Simulate email/notification service outage at decision time.

**Test Data**:

- Paper: `P1`
- Decision: `Accepted`

**Steps**:

1. Record and publish the final decision for `P1` while notification service is down.
2. Log in as the author.
3. Navigate to “My Submissions” and open `P1`.

**Expected Results**:

- System logs a notification failure (verifiable in test logs).
- Decision is still stored in database.
- Submitting author can still view the final decision in CMS.

**Pass/Fail Criteria**:

- PASS if notification failure does not prevent viewing decision; FAIL otherwise.

---

## AT-UC07-04 — Delayed Viewing: Decision Persists Over Time (Extension 4a)

**Priority**: Medium  
**Preconditions**:

- Same as AT-UC07-01.
- Decision was recorded at an earlier time (simulate time passage or simply wait in test setup).

**Test Data**:

- Paper: `P1`
- Decision: `Rejected`

**Steps**:

1. Ensure decision for `P1` is already stored.
2. Log in as the author at a later time (new session).
3. Navigate to “My Submissions” and open `P1`.

**Expected Results**:

- Decision is still available and unchanged.
- Author can view it without requiring any immediate notification action.

**Pass/Fail Criteria**:

- PASS if decision persists and remains accessible; FAIL otherwise.

---

## AT-UC07-05 — Authorization: Only the Submitting Author Can View Decision

**Priority**: High  
**Preconditions**:

- Author A submitted `P1` and a final decision exists for `P1`.
- Author B exists and did not submit `P1`.

**Test Data**:

- Paper: `P1`

**Steps**:

1. Log in as Author B.
2. Attempt to access `P1` decision (via URL guessing/direct link if possible).
3. Log in as Author A and access `P1`.

**Expected Results**:

- Author B is denied access (redirect to own submissions, access denied, or not found).
- Author A can view the decision normally.

**Pass/Fail Criteria**:

- PASS if access control is enforced; FAIL otherwise.

---

## AT-UC07-06 — Handle Retrieval Error Gracefully (Extension 7a)

**Priority**: High  
**Preconditions**:

- Final decision exists for `P1`.
- Simulate database read failure or decision-retrieval service error.

**Test Data**:

- Paper: `P1`

**Steps**:

1. Log in as the author.
2. Navigate to “My Submissions.”
3. Attempt to open `P1` while retrieval failure is active.

**Expected Results**:

- System displays exactly: "Decision temporarily unavailable. Please try again later."
- No sensitive technical details/stack traces are shown.
- Error is logged (verifiable in test environment logs).
- System does not show an incorrect/empty decision as if it were valid.

**Pass/Fail Criteria**:

- PASS if failure is handled safely with a user-friendly error; FAIL otherwise.

---

## AT-UC07-07 — Decision Correctness: Decision Matches Stored Value

**Priority**: High  
**Preconditions**:

- Paper `P1` has final decision stored as `Accepted`.
- CMS and DB available.

**Test Data**:

- Paper: `P1`
- Stored Decision: `Accepted`

**Steps**:

1. Log in as the author.
2. View decision for `P1`.

**Expected Results**:

- UI displays `Accepted` exactly as stored.
- No mismatch (e.g., showing “Pending” or “Rejected”).

**Pass/Fail Criteria**:

- PASS if displayed decision equals stored decision; FAIL otherwise.

---

## Traceability (UC-07 Steps → Tests)

- **Store decision + author views in CMS** → AT-UC07-01, AT-UC07-07
- **Notification attempt** → AT-UC07-02
- **Publish-gated visibility** → AT-UC07-01
- **Extension 4a (notification failure)** → AT-UC07-03
- **Extension 5a (author delays login)** → AT-UC07-04
- **Extension 7a (retrieval error)** → AT-UC07-06
- **Security/authorization** → AT-UC07-05
