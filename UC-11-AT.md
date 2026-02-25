# Acceptance Test Suite - UC-11 Receive Review Invitation

## Overview

**Use Case**: UC-11 Receive Review Invitation
**Objective**: Verify invitation creation, notification behavior, secure reviewer-only access, pending-first view, newest-first ordering, pagination, action handling, and retry-safe errors.

---

## AT-UC11-01 - Pending Invitations Visible by Default

**Preconditions**:
- Reviewer `R1` has invitations for papers `P1`, `P2`.
- At least one invitation in another status exists for `R1`.

**Steps**:
1. Log in as `R1`.
2. Open `/review-invitations.html`.

**Expected Results**:
- Only `pending` invitations are shown by default.
- Each row shows paper title, status, and due date.
- Accept and Reject buttons are visible for pending rows.

---

## AT-UC11-02 - Newest-First Ordering

**Preconditions**:
- Reviewer `R1` has at least 3 pending invitations with distinct `created_at` timestamps.

**Steps**:
1. Log in as `R1`.
2. Open the invitation list.

**Expected Results**:
- Invitations are sorted from newest to oldest by creation time.

---

## AT-UC11-03 - Pagination Beyond 20 Invitations

**Preconditions**:
- Reviewer `R1` has 25 pending invitations.

**Steps**:
1. Log in as `R1`.
2. Open invitation list page 1.
3. Move to next page.

**Expected Results**:
- Page 1 shows up to 20 items.
- Page 2 shows remaining items.
- Previous/Next controls are keyboard accessible.

---

## AT-UC11-04 - Accept and Reject Update Status

**Preconditions**:
- `R1` has a pending invitation for `P3`.

**Steps**:
1. Log in as `R1`.
2. Accept invitation for `P3`.
3. Reload list and filter by `accepted`.
4. Repeat with another pending invitation using Reject.

**Expected Results**:
- Accepted invitation status is `accepted`.
- Rejected invitation status is `rejected`.
- Buttons are disabled once status is no longer pending.

---

## AT-UC11-05 - Notification Delivery With Required Content

**Preconditions**:
- Notification/email sender stub can be observed.

**Steps**:
1. Create invitation by assigning reviewer.
2. Inspect notification output/log.

**Expected Results**:
- Notification send is attempted.
- Message includes paper title and response due date.
- Delivery result is recorded as sent or failed.

---

## AT-UC11-06 - Notification Failure Does Not Block Invitation Visibility

**Preconditions**:
- Simulate notification service failure.

**Steps**:
1. Assign reviewer to create invitation while notification fails.
2. Log in as invited reviewer.
3. Open invitation list.

**Expected Results**:
- Invitation still appears in the reviewer list.
- Failure is logged; no crash or blocked workflow.

---

## AT-UC11-07 - Authorization Restriction

**Preconditions**:
- Invitation exists for reviewer `R1`.
- Reviewer `R2` is different user.

**Steps**:
1. Log in as `R2`.
2. Attempt API detail or action for `R1` invitation.

**Expected Results**:
- Access is denied with 403.
- Unauthorized attempts are audit logged.

---

## AT-UC11-08 - Generic Retry Error Messaging

**Preconditions**:
- Simulate invitation list service failure.

**Steps**:
1. Log in as invited reviewer.
2. Load invitation page during failure.

**Expected Results**:
- UI shows a generic retryable message.
- No stack trace/internal details are exposed.
- Retry button attempts loading again.

---

## AT-UC11-09 - Expired Pending Invitations Auto-Decline

**Preconditions**:
- A pending invitation exists with due date in the past.

**Steps**:
1. Log in as invited reviewer.
2. Load invitation list.

**Expected Results**:
- Expired pending invitation status becomes `declined`.

---

## AT-UC11-10 - Invitation Visibility Within One Minute of Assignment

**Preconditions**:
- Reviewer is assigned to paper now.

**Steps**:
1. Assign reviewer.
2. Log in as reviewer and open list within one minute.

**Expected Results**:
- Invitation is visible within one minute of assignment.

