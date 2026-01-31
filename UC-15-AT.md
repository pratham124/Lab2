# Acceptance Test Suite — UC-15 Send Acceptance or Rejection Decision to Author

## Overview

**Use Case**: UC-15 Send Acceptance or Rejection Decision to Author  
**Objective**: Verify that an editor can record and send a final decision (accept/reject) to the author(s), that the system blocks sending when reviews are incomplete, that notification failures are handled safely, and that decision storage/retrieval behaves correctly.  
**In Scope**: Decision selection, review-completeness gating, decision persistence, author notification attempt, editor confirmation, resilience to notification/storage failures, authorization.  
**Out of Scope**: Content of decision letters beyond “accept/reject,” camera-ready workflow, inclusion of reviewer comments/rationale (not specified).

---

## AT-UC15-01 — Send Acceptance Decision Successfully (Main Success Scenario)

**Priority**: High  
**Preconditions**:

- Editor `E1` is registered and logged in.
- Paper `P1` exists and is managed by `E1`.
- All required reviews for `P1` are completed.
- Author(s) for `P1` have valid email addresses in CMS.
- CMS and database are available.
- Notification/email service is operational (or delivery can be observed via stub/log).

**Test Data**:

- Paper: `P1`
- Decision: `Accepted`

**Steps**:

1. As `E1`, navigate to the submitted papers list.
2. Select `P1` and choose “Record/Send Final Decision.”
3. Select **Accept** and confirm send.

**Expected Results**:

- System stores decision “Accepted” for `P1` in database.
- System sends decision notification to all author(s) of `P1`.
- Editor receives a success confirmation that decision was sent.
- Paper status reflects decision sent/recorded (as implemented).

**Pass/Fail Criteria**:

- PASS if decision is stored and notification is sent with success confirmation; FAIL otherwise.

---

## AT-UC15-02 — Send Rejection Decision Successfully

**Priority**: High  
**Preconditions**: Same as AT-UC15-01

**Test Data**:

- Paper: `P2`
- Decision: `Rejected`

**Steps**:

1. As `E1`, select `P2`.
2. Choose “Record/Send Final Decision.”
3. Select **Reject** and confirm send.

**Expected Results**:

- Decision “Rejected” is stored.
- Notification is sent to author(s).
- Editor sees success confirmation.

**Pass/Fail Criteria**:

- PASS if rejection decision behaves correctly end-to-end; FAIL otherwise.

---

## AT-UC15-03 — Block Sending Decision When Reviews Are Incomplete (Extension 5a)

**Priority**: High  
**Preconditions**:

- Editor `E1` logged in.
- Paper `P3` exists and is managed by `E1`.
- At least one required review is still pending (not submitted).

**Test Data**:

- Paper: `P3`
- Attempted decision: `Accepted` (or `Rejected`)

**Steps**:

1. Open `P3` details as `E1`.
2. Attempt to record and send a final decision.

**Expected Results**:

- System detects incomplete reviews.
- System blocks the send action.
- System displays a message indicating decision cannot be sent until reviews are complete.
- No decision is stored and no notifications are sent.

**Pass/Fail Criteria**:

- PASS if blocked with clear message and no state change; FAIL otherwise.

---

## AT-UC15-04 — Notification Failure After Decision Stored (Extension 7a)

**Priority**: High  
**Preconditions**:

- Editor `E1` logged in.
- Paper `P4` exists with all required reviews completed.
- Simulate email/notification service outage at send time.
- Database is available.

**Test Data**:

- Paper: `P4`
- Decision: `Accepted`

**Steps**:

1. Attempt to send the decision for `P4` while notification service is down.

**Expected Results**:

- System stores the decision in database successfully.
- System fails to deliver notification.
- System informs editor that notification could not be sent.
- System logs the notification failure (verifiable in test environment logs).
- Decision remains viewable in CMS as recorded.

**Pass/Fail Criteria**:

- PASS if decision persists despite notification failure and editor is informed; FAIL otherwise.

---

## AT-UC15-05 — Database/Storage Failure Prevents Saving and Sending (Extension 6a)

**Priority**: High  
**Preconditions**:

- Editor `E1` logged in.
- Paper `P5` exists with all reviews completed.
- Simulate database write failure/outage when saving decision.

**Test Data**:

- Paper: `P5`
- Decision: `Rejected`

**Steps**:

1. Attempt to send final decision for `P5` during DB failure.

**Expected Results**:

- System displays failure message indicating decision cannot be saved/sent now.
- Error is logged (verifiable in test environment logs).
- No decision is stored.
- No notification is sent.
- Paper remains undecided (as implemented).

**Pass/Fail Criteria**:

- PASS if system fails safely with no partial state; FAIL otherwise.

---

## AT-UC15-06 — Author Receives Decision Notification

**Priority**: Medium  
**Preconditions**:

- AT-UC15-01 or AT-UC15-02 completed successfully.
- Test environment can observe author email delivery (email stub/inbox capture).

**Test Data**:

- Paper: `P1` or `P2`

**Steps**:

1. Inspect author(s) notification inbox/log for the decision message.

**Expected Results**:

- Author(s) receive a message indicating acceptance or rejection.
- Message references the correct paper (title/ID) and correct decision.

**Pass/Fail Criteria**:

- PASS if correct decision reaches correct author(s); FAIL otherwise.

---

## AT-UC15-07 — Decision Visible to Author in CMS After Sending

**Priority**: High  
**Preconditions**:

- A final decision for paper `P6` has been recorded (send may or may not have succeeded).
- Author account for `P6` exists and can log in.

**Test Data**:

- Paper: `P6`
- Decision: `Accepted` or `Rejected`

**Steps**:

1. Log in as the author of `P6`.
2. Navigate to “My Submissions.”
3. Open `P6` details.

**Expected Results**:

- Final decision is visible in CMS for the author.
- Decision matches what editor recorded.

**Pass/Fail Criteria**:

- PASS if author can view correct decision; FAIL otherwise.

---

## AT-UC15-08 — Authorization: Non-Editor Cannot Send Decisions

**Priority**: High  
**Preconditions**:

- A non-editor user (e.g., author or reviewer) exists and is logged in.
- Paper `P1` exists.

**Test Data**:

- Paper: `P1`

**Steps**:

1. Attempt to access decision-sending function as a non-editor (UI or direct URL).

**Expected Results**:

- Access is denied (redirect/access denied/not found as implemented).
- No decision is recorded or sent.

**Pass/Fail Criteria**:

- PASS if non-editors cannot send decisions; FAIL otherwise.

---

## AT-UC15-09 — Prevent Duplicate Notifications on Double-Click Send

**Priority**: Low  
**Preconditions**:

- Editor `E1` logged in.
- Paper `P7` exists with reviews complete.
- Notification service operational or observable.

**Test Data**:

- Paper: `P7`
- Decision: `Accepted`

**Steps**:

1. Select decision and click **Send** twice rapidly (or trigger duplicate request).
2. Check notification log/inbox and decision record.

**Expected Results**:

- Decision is recorded once.
- Author(s) receive at most one notification (or duplicates are deduplicated safely).
- Editor sees a stable outcome (success or safe duplicate-handling message).

**Pass/Fail Criteria**:

- PASS if duplicates are prevented/handled cleanly; FAIL otherwise.

---

## Traceability (UC-15 Steps → Tests)

- **Main Success Scenario (store + notify + confirm)** → AT-UC15-01, AT-UC15-02
- **Extension 5a (reviews incomplete)** → AT-UC15-03
- **Extension 7a (notification failure)** → AT-UC15-04
- **Extension 6a (DB/storage failure)** → AT-UC15-05
- **Author informed** → AT-UC15-06, AT-UC15-07
- **Security & robustness** → AT-UC15-08, AT-UC15-09
