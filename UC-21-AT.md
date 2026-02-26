# Acceptance Test Suite — UC-21 Pay Conference Registration Fee Online

## Overview

**Use Case**: UC-21 Pay Conference Registration Fee Online  
**Objective**: Verify that an attendee can pay the registration fee online by card, that successful payments are recorded and update registration status, and that invalid details, declined payments, gateway outages, duplicate confirmations, and delayed confirmations are handled safely and clearly.  
**In Scope**: Card payment initiation, redirect/hand-off to gateway, success callback/confirmation handling, payment persistence, registration status update, user messaging, failure handling/logging.  
**Out of Scope**: Refunds, chargebacks, receipt generation, tax/VAT calculation unless explicitly implemented.

---

## AT-UC21-01 — Successful Online Payment Updates Registration Status (Main Success Scenario)

**Priority**: High  
**Preconditions**:

- Attendee `T1` is registered and logged in.
- Registration pricing is defined and attendee has selected a category.
- Attendee’s registration status is `unpaid`.
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
3. Select the credit/debit card payment method.
4. Proceed to payment gateway and enter valid card payment details.
5. Confirm payment.

**Expected Results**:

- Gateway processes payment successfully.
- CMS receives success notification/callback from gateway.
- CMS records payment transaction (amount, timestamp, reference ID).
- Registration status is `pending_confirmation` immediately after initiation, then transitions to `paid_confirmed` after confirmation.
- Registration status changes to `paid_confirmed` and is displayed as “Paid/Confirmed.”
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
3. (Optional API) Call `GET /registrations/{registrationId}/payment-status` and `GET /registrations/{registrationId}/payment-records`.

**Expected Results**:

- Registration status remains `paid_confirmed` and is displayed as “Paid/Confirmed.”
- Payment record is visible with correct amount, date/time, and reference.
- API responses include the same status code and payment record details.

**Pass/Fail Criteria**:

- PASS if payment persists and is visible; FAIL otherwise.

---

## AT-UC21-03 — Invalid/Incomplete Payment Details Rejected (Extension 6a)

**Priority**: High  
**Preconditions**:

- Attendee `T2` logged in with `unpaid` status.
- Gateway operational.

**Test Data**:

- Invalid card number / missing required field

**Steps**:

1. Navigate to payment page.
2. Select online payment.
3. At gateway, enter invalid/incomplete card payment details.
4. Confirm payment.

**Expected Results**:

- Gateway rejects transaction due to invalid/incomplete details.
- Attendee sees clear error message indicating payment details issue.
- Registration remains `unpaid`.
- No successful payment record is created.
- API error code: `invalid_details`.

**Pass/Fail Criteria**:

- PASS if invalid details do not result in paid status and user is informed; FAIL otherwise.

---

## AT-UC21-04 — Payment Declined by Gateway (Extension 7a)

**Priority**: High  
**Preconditions**:

- Attendee `T3` logged in with `unpaid` status.
- Gateway operational and can simulate decline.

**Test Data**:

- Valid-looking payment details that trigger a decline (sandbox scenario)

**Steps**:

1. Initiate payment for `T3`.
2. Submit card payment details that result in a declined transaction.

**Expected Results**:

- Gateway returns “Declined.”
- CMS informs attendee that payment was declined.
- Registration remains `unpaid`.
- No `paid_confirmed` status is set.
- API error code: `declined`.

**Pass/Fail Criteria**:

- PASS if decline is handled with correct messaging and no paid status; FAIL otherwise.

---

## AT-UC21-05 — Payment Gateway Unavailable Before Payment (Extension 5a)

**Priority**: High  
**Preconditions**:

- Attendee `T4` logged in with `unpaid` status.
- Simulate gateway outage or CMS cannot reach gateway.

**Test Data**:

- Gateway unavailable

**Steps**:

1. From CMS payment page, attempt to proceed to online payment gateway.

**Expected Results**:

- System cannot redirect/connect to gateway.
- System displays message indicating online payment is temporarily unavailable.
- Registration remains `unpaid`.
- API error code: `service_unavailable`.

**Pass/Fail Criteria**:

- PASS if outage is handled safely with clear message; FAIL otherwise.

---

## AT-UC21-06 — Idempotency: Duplicate Callback Does Not Double-Charge/Double-Record

**Priority**: Medium  
**Preconditions**:

- A successful payment transaction occurs for attendee `T1`.
- Gateway/callback mechanism can replay the same success notification.

**Test Data**:

- Same payment reference ID (`gateway_reference`) sent twice.

**Steps**:

1. Simulate gateway sending the same success callback twice to CMS.
2. Check payment records and registration status.

**Expected Results**:

- CMS records the payment once (no duplicate records).
- Registration remains `paid_confirmed`.
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
- Registration remains `unpaid`.

**Pass/Fail Criteria**:

- PASS if authentication is enforced; FAIL otherwise.

---

## AT-UC21-08 — Already Paid: Block Additional Payment Attempts

**Priority**: Medium  
**Preconditions**:

- Attendee `T5` is logged in.
- Registration status is `paid_confirmed`.
- A prior payment record exists for `T5`.

**Test Data**:

- Attendee: `T5`

**Steps**:

1. Navigate to the registration/payment page for `T5`.
2. Attempt to initiate payment.

**Expected Results**:

- System blocks payment initiation.
- System displays `paid_confirmed` status with a “Paid/Confirmed” label.
- Existing payment record summary (amount, date/time, reference) is visible.

**Pass/Fail Criteria**:

- PASS if payment initiation is blocked and paid status/record is shown; FAIL otherwise.

---

## AT-UC21-09 — Pending Confirmation Exceeds 24 Hours

**Priority**: Medium  
**Preconditions**:

- Attendee `T6` is logged in with `unpaid` status.
- A payment attempt is initiated and marked `pending_confirmation` (“Pending Payment Confirmation”).
- The pending state has exceeded 24 hours without confirmation.

**Test Data**:

- Attendee: `T6`

**Steps**:

1. Evaluate the pending payment after 24 hours have elapsed without confirmation.

**Expected Results**:

- System marks the registration as `unpaid`.
- System notifies the attendee to retry payment.
- Evaluation uses the server clock in UTC for the 24-hour threshold.

**Pass/Fail Criteria**:

- PASS if pending is cleared to `unpaid` and attendee is notified; FAIL otherwise.

---

## AT-UC21-10 — Delayed Confirmation Shows Pending Status

**Priority**: Medium  
**Preconditions**:

- Attendee `T7` is logged in with `unpaid` status.
- A payment attempt is initiated but confirmation is delayed.

**Test Data**:

- Attendee: `T7`

**Steps**:

1. Initiate a payment for `T7`.
2. Simulate delayed gateway confirmation (no success callback yet).
3. Return to the CMS after the payment attempt.
4. Later, simulate a successful confirmation callback.

**Expected Results**:

- System shows a pending message.
- Registration status is `pending_confirmation` with a visible pending label/message.
- Registration is not marked `paid_confirmed` until confirmation arrives.
- After confirmation arrives, registration status changes to `paid_confirmed` with a visible confirmation message.

**Pass/Fail Criteria**:

- PASS if pending state and message are shown without marking paid; FAIL otherwise.

---

## AT-UC21-11 — Security: No Raw Card Data Stored or Logged

**Priority**: High  
**Preconditions**:

- Attendee completes a payment attempt (success or failure).
- Access to CMS datastore and logs is available in the test environment.

**Test Data**:

- Valid and invalid card inputs in gateway sandbox

**Steps**:

1. Perform a payment attempt.
2. Inspect CMS datastore records for the payment attempt.
3. Inspect CMS application logs related to the payment attempt.

**Expected Results**:

- No raw cardholder data (full card number or security code) is stored.
- Logs do not contain raw cardholder data.

**Pass/Fail Criteria**:

- PASS if raw card data is absent from storage/logs; FAIL otherwise.

---

## AT-UC21-12 — Security: Audit Events for Payment Attempts

**Priority**: Medium  
**Preconditions**:

- Attendee completes one successful and one failed payment attempt.
- Audit event viewing or export is available in the test environment.

**Test Data**:

- One successful payment
- One failed payment

**Steps**:

1. Complete a successful payment attempt.
2. Complete a failed payment attempt.
3. Review audit event records for both attempts.

**Expected Results**:

- Audit events exist for payment attempt initiation, confirmation (success), and failure.

**Pass/Fail Criteria**:

- PASS if audit events are recorded for attempt, confirmation, and failure; FAIL otherwise.

---

## Traceability (UC-21 Paths → Tests)

- **Main Success Scenario** → AT-UC21-01, AT-UC21-02
- **Extension 6a (invalid details)** → AT-UC21-03
- **Extension 7a (declined)** → AT-UC21-04
- **Extension 5a (gateway unavailable)** → AT-UC21-05
- **Robustness/idempotency** → AT-UC21-06
- **Security/authentication** → AT-UC21-07
- **Already paid block** → AT-UC21-08
- **Pending confirmation >24h** → AT-UC21-09
- **Confirmation delayed (pending)** → AT-UC21-10
- **Security (no raw card data)** → AT-UC21-11
- **Security (audit events)** → AT-UC21-12
