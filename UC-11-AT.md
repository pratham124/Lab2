# Acceptance Test Suite — UC-11 Receive Review Invitation

## Overview

**Use Case**: UC-11 Receive Review Invitation  
**Objective**: Verify that a reviewer receives review invitations created by editor assignment, can view them in the CMS, and has clear options to accept or reject; verify resilience to notification failure, delayed login, and retrieval failures.  
**In Scope**: Invitation creation visibility for the reviewer, notification attempt, invitation listing/display in CMS, authorization, error handling.  
**Out of Scope**: Accepting/rejecting invitations (separate use case), reviewer workload rules (UC-09), assignment creation workflow (UC-08) beyond triggering invitations.

---

## AT-UC11-01 — Reviewer Can See Pending Invitation in CMS (Main Success Scenario)

**Priority**: High  
**Preconditions**:

- Reviewer account exists and is registered.
- Reviewer has a valid email associated with their account.
- Editor has assigned the reviewer `R1` to paper `P1` (invitation created).
- CMS and database are available.

**Test Data**:

- Reviewer: `R1`
- Paper: `P1`

**Steps**:

1. Log in as reviewer `R1`.
2. Navigate to “Review Invitations” / “Assigned Reviews” / equivalent page.
3. Locate invitation for `P1`.

**Expected Results**:

- The invitation for `P1` appears with status “Pending” (or equivalent).
- The invitation shows enough identifying information to distinguish the paper (e.g., title/ID).
- Options to **Accept** or **Reject** are visible.

**Pass/Fail Criteria**:

- PASS if invitation is visible and actionable; FAIL otherwise.

---

## AT-UC11-02 — Notification Sent When Invitation Is Created

**Priority**: Medium  
**Preconditions**:

- Reviewer `R1` exists and has a valid email.
- Notification/email service is operational.
- Test environment can observe notification delivery (email stub/log/event queue).

**Test Data**:

- Reviewer: `R1`
- Paper: `P1`

**Steps**:

1. Trigger creation of an invitation by assigning `R1` to `P1` (via editor action or test harness).
2. Inspect notification delivery to `R1` (email stub/log/event queue).

**Expected Results**:

- System attempts to send a review invitation notification to `R1`.
- Notification is delivered successfully when service is available.

**Pass/Fail Criteria**:

- PASS if notification is sent/delivered in a verifiable way; FAIL otherwise.

---

## AT-UC11-03 — Invitation Remains Available When Notification Fails (Extension 3a)

**Priority**: High  
**Preconditions**:

- Reviewer `R1` exists.
- Simulate notification service outage at the time the invitation is created.
- CMS database remains available.

**Test Data**:

- Reviewer: `R1`
- Paper: `P2`

**Steps**:

1. Assign `R1` to `P2` while notification service is down.
2. Log in as `R1`.
3. Navigate to invitations list.

**Expected Results**:

- System logs notification failure (verifiable in test logs).
- Invitation for `P2` exists and is visible in CMS.
- Reviewer still sees **Accept**/**Reject** options.

**Pass/Fail Criteria**:

- PASS if notification failure does not prevent invitation visibility; FAIL otherwise.

---

## AT-UC11-04 — Delayed Login: Invitation Still Pending Later (Extension 5a)

**Priority**: Medium  
**Preconditions**:

- Invitation exists for reviewer `R1` to paper `P3`.
- Reviewer does not log in immediately (simulate time passage / new session).

**Test Data**:

- Reviewer: `R1`
- Paper: `P3`

**Steps**:

1. Ensure invitation for `P3` has been created.
2. After a delay (or a new session), log in as `R1`.
3. Navigate to invitations list.

**Expected Results**:

- Invitation is still present and pending.
- Invitation can still be acted upon (Accept/Reject visible).

**Pass/Fail Criteria**:

- PASS if invitation persists and is accessible later; FAIL otherwise.

---

## AT-UC11-05 — Authorization: Only Invited Reviewer Can See the Invitation

**Priority**: High  
**Preconditions**:

- Invitation exists for reviewer `R1` to paper `P4`.
- Another reviewer `R2` exists and is not invited to `P4`.

**Test Data**:

- Paper: `P4`

**Steps**:

1. Log in as reviewer `R2`.
2. Attempt to access invitation for `P4` (via URL guessing/direct link if possible).
3. Log in as reviewer `R1`.
4. Access invitation list and locate `P4`.

**Expected Results**:

- `R2` cannot view `P4` invitation (access denied/not found/redirect).
- `R1` can view `P4` invitation normally.

**Pass/Fail Criteria**:

- PASS if access control prevents non-invited reviewer access; FAIL otherwise.

---

## AT-UC11-06 — Handle Retrieval Error Gracefully (Extension 7a)

**Priority**: High  
**Preconditions**:

- Invitation exists for reviewer `R1` to paper `P5`.
- Simulate database read failure or invitation retrieval service error.

**Test Data**:

- Reviewer: `R1`
- Paper: `P5`

**Steps**:

1. Log in as `R1`.
2. Navigate to invitations list while retrieval failure is active.

**Expected Results**:

- System displays an error message indicating invitations cannot be displayed at this time.
- No stack traces or sensitive internal details are shown.
- Error is logged (verifiable in test environment logs).

**Pass/Fail Criteria**:

- PASS if failure is handled safely with clear messaging; FAIL otherwise.

---

## AT-UC11-07 — Correct Invitation Content: Shows the Right Paper

**Priority**: Medium  
**Preconditions**:

- Reviewer `R1` has invitations for two different papers `P6` and `P7`.
- Both invitations exist and are pending.

**Test Data**:

- Invitations: `P6`, `P7`

**Steps**:

1. Log in as `R1`.
2. View the invitations list.

**Expected Results**:

- Both invitations appear.
- Each invitation correctly identifies its corresponding paper (no mixing/mislabeling).
- Accept/Reject options are present for each invitation.

**Pass/Fail Criteria**:

- PASS if invitations are correctly listed and distinguishable; FAIL otherwise.

---

## Traceability (UC-11 Steps → Tests)

- **Main Success Scenario (invitation visible & actionable)** → AT-UC11-01, AT-UC11-07
- **Notification attempt** → AT-UC11-02
- **Extension 3a (notification failure)** → AT-UC11-03
- **Extension 5a (reviewer delays login)** → AT-UC11-04
- **Extension 7a (retrieval error)** → AT-UC11-06
- **Security/authorization** → AT-UC11-05
