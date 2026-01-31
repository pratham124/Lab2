# Acceptance Test Suite — UC-21 Pay Conference Registration Fee Online

## Overview

**Use Case**: UC-21 Pay Conference Registration Fee Online  
**Objective**: Verify that an attendee can pay the registration fee online, that successful payments are recorded and update registration status, and that invalid details, declined payments, gateway outages, and uncertain confirmation are handled safely and clearly.  
**In Scope**: Payment initiation, redirect/hand-off to gateway, success callback/confirmation handling, payment persistence, registration status update, user messaging, failure handling/logging.  
**Out of Scope**: Refunds, chargebacks, receipt generation, tax/VAT calculation unless explicitly implemented.

---

## AT-UC21-01 — Successful Online Payment Updates Registration Status (Main Success Scenario)

**Priority**: High  
**Preconditions**:

- Attendee `T1` is registered and logged in.
- Registration pricing is defined and attendee has selected a category.
- Attendee’s registration status is “Unpaid” (or equivalent).
- Payment gateway sandbox is configured and operational.
- CMS and database available.

**Test Data**:

- Attendee: `T1`
- Category: Regular
- Fee: $200
- Gateway response: Approved/Success

**Steps**:

1. Log in as `T1`.
2. Navigate to registration/payment page.
3. Select an online payment method.
4. Proceed to payment gateway and enter valid payment details.
5. Confirm payment.

**Expected Results**:

- Gateway processes payment successfully.
- CMS receives success notification/callback from gateway.
- CMS records payment transaction (amount, timestamp, reference ID).
- Registration status changes to “Paid”/“Confirmed.”
- Attendee sees a payment success confirmation screen.

**Pass/Fail Criteria**:

- PASS if payment is recorded and status updated with confirmation shown; FAIL otherwise.

---

## AT-UC21-02 — Payment Record Visible in Attendee Account (Post-Condition Verification)

**Priority**: Medium  
**Preconditions**:

- AT-UC21-01 completed successfully (payment exists).

**Test Data**:

- Payment transaction from AT-UC21-01

**Steps**:

1. Log out and log back in as `T1`.
2. Navigate to registration status/payment history.

**Expected Results**:

- Registration status remains “Paid/Confirmed.”
- Payment record is visible with correct amount and reference (as implemented).

**Pass/Fail Criteria**:

- PASS if payment persists and is visible; FAIL otherwise.

---

## AT-UC21-03 — Invalid/Incomplete Payment Details Rejected (Extension 6a)

**Priority**: High  
**Preconditions**:

- Attendee `T2` logged in with “Unpaid” status.
- Gateway operational.

**Test Data**:

- Invalid card number / missing required field

**Steps**:

1. Navigate to payment page.
2. Select online payment.
3. At gateway, enter invalid/incomplete payment details.
4. Confirm payment.

**Expected Results**:

- Gateway rejects transaction due to invalid/incomplete details.
- Attendee sees clear error message indicating payment details issue.
- CMS does not mark registration as paid.
- No successful payment record is created (failed attempts may be logged if implemented).

**Pass/Fail Criteria**:

- PASS if invalid details do not result in paid status and user is informed; FAIL otherwise.

---

## AT-UC21-04 — Payment Declined by Gateway (Extension 7a)

**Priority**: High  
**Preconditions**:

- Attendee `T3` logged in with “Unpaid” status.
- Gateway operational and can simulate decline.

**Test Data**:

- Valid-looking payment details that trigger a decline (sandbox scenario)

**Steps**:

1. Initiate payment for `T3`.
2. Submit payment details that result in a declined transaction.

**Expected Results**:

- Gateway returns “Declined.”
- CMS informs attendee that payment was declined.
- Registration remains “Unpaid.”
- No “Paid/Confirmed” state is set.
- Declined attempt may be recorded as failed transaction (if implemented).

**Pass/Fail Criteria**:

- PASS if decline is handled with correct messaging and no paid status; FAIL otherwise.

---

## AT-UC21-05 — Payment Gateway Unavailable Before Payment (Extension 5a)

**Priority**: High  
**Preconditions**:

- Attendee `T4` logged in with “Unpaid” status.
- Simulate gateway outage or CMS cannot reach gateway.

**Test Data**:

- Gateway unavailable

**Steps**:

1. From CMS payment page, attempt to proceed to online payment gateway.

**Expected Results**:

- System cannot redirect/connect to gateway.
- System displays message indicating online payment is temporarily unavailable.
- Registration remains “Unpaid.”
- Error is logged (verifiable in test environment logs).

**Pass/Fail Criteria**:

- PASS if outage is handled safely with clear message; FAIL otherwise.

---

## AT-UC21-06 — Idempotency: Duplicate Callback Does Not Double-Charge/Double-Record

**Priority**: Medium  
**Preconditions**:

- A successful payment transaction occurs for attendee `T1`.
- Gateway/callback mechanism can replay the same success notification.

**Test Data**:

- Same payment reference ID sent twice.

**Steps**:

1. Simulate gateway sending the same success callback twice to CMS.
2. Check payment records and registration status.

**Expected Results**:

- CMS records the payment once (no duplicate records).
- Registration remains “Paid/Confirmed.”
- No double-processing side effects occur.

**Pass/Fail Criteria**:

- PASS if duplicate callback is handled safely; FAIL otherwise.

---

## AT-UC21-07 — Security: Only Logged-In Attendee Can Initiate Payment

**Priority**: High  
**Preconditions**:

- User is not authenticated (logged out).

**Test Data**:

- None

**Steps**:

1. Attempt to access payment initiation page directly (URL) while logged out.
2. Attempt to start payment.

**Expected Results**:

- System requires login (redirect to login or access denied).
- No payment session is created for anonymous user.

**Pass/Fail Criteria**:

- PASS if authentication is enforced; FAIL otherwise.

---

## Traceability (UC-21 Paths → Tests)

- **Main Success Scenario** → AT-UC21-01, AT-UC21-02
- **Extension 6a (invalid details)** → AT-UC21-03
- **Extension 7a (declined)** → AT-UC21-04
- **Extension 5a (gateway unavailable)** → AT-UC21-05
- **Robustness/idempotency** → AT-UC21-06
- **Security/authentication** → AT-UC21-07
