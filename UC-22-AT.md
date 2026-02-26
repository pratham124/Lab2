# Acceptance Test Suite — UC-22 Receive Payment Confirmation Ticket

## Overview

**Use Case**: UC-22 Receive Payment Confirmation Ticket  
**Objective**: Verify that after a successful payment, the system generates and stores a confirmation ticket, delivers it to the attendee via email, and allows the attendee to access it later; verify behavior under delivery failure, generation/storage failure, duplicate confirmations, and unauthorized access attempts.  
**In Scope**: Ticket generation, persistence, delivery attempt, display/availability to attendee, authorization, error handling/logging.  
**Out of Scope**: QR codes, PDFs, refunds/chargebacks.

---

## AT-UC22-01 — Ticket Generated and Accessible After Successful Payment (Main Success Scenario)

**Priority**: High  
**Preconditions**:

- Attendee `T1` is registered and logged in.
- Attendee completes a successful payment (UC-21 success path).
- Payment gateway confirms transaction to CMS.
- CMS and database are available.

**Test Data**:

- Attendee: `T1`
- Payment: Success, reference `PAY-001`, amount `$200`

**Steps**:

1. Complete online payment successfully for `T1`.
2. After returning to CMS, navigate to “My Registration” / “Tickets” / equivalent.

**Expected Results**:

- CMS generates a confirmation ticket for `T1` within 2 minutes of payment confirmation.
- Ticket is stored and visible in `T1`’s account.
- Ticket includes required proof elements (at minimum: attendee identity, payment reference/ID, invoice number, amount, registration status “Paid/Confirmed,” timestamp if stored).
- System displays a message that the ticket has been issued.

**Pass/Fail Criteria**:

- PASS if ticket exists and is accessible post-payment; FAIL otherwise.

---

## AT-UC22-02 — Ticket Delivered via Email (Delivery Success)

**Priority**: Medium  
**Preconditions**:

- Same as AT-UC22-01.
- Email service is operational.
- Test environment can observe delivery (email stub/inbox capture/log).

**Test Data**:

- Attendee: `T1`
- Ticket for payment `PAY-001`

**Steps**:

1. Trigger successful payment confirmation (as in AT-UC22-01).
2. Inspect attendee email inbox stub/log for ticket delivery.

**Expected Results**:

- System sends the confirmation ticket (or a message containing the ticket/link) to the attendee via email only (no alternate delivery channels).
- Delivered message references correct attendee and payment (no wrong recipient).

**Pass/Fail Criteria**:

- PASS if delivery occurs and content references the correct registration; FAIL otherwise.

---

## AT-UC22-03 — Email Delivery Failure Does Not Block Access in CMS (Extension 5a)

**Priority**: High  
**Preconditions**:

- Attendee `T2` completes successful payment.
- Simulate email service outage at delivery time.
- Database is available.

**Test Data**:

- Attendee: `T2`
- Payment reference: `PAY-002`

**Steps**:

1. Complete payment successfully for `T2`.
2. Ensure ticket generation occurs.
3. Attempt delivery while email service is down.
4. Log in as `T2` and navigate to ticket view.

**Expected Results**:

- Ticket is generated and stored successfully.
- System logs delivery failure (verifiable in test environment logs).
- Ticket remains accessible in `T2`’s CMS account despite delivery failure (email-only delivery still enforced).

**Pass/Fail Criteria**:

- PASS if ticket is available in CMS even when email fails; FAIL otherwise.

---

## AT-UC22-04 — Ticket Generation/Storage Failure After Payment Confirmation (Extension 3a)

**Priority**: High  
**Preconditions**:

- Attendee `T3` completes successful payment at gateway.
- Simulate CMS failure during ticket generation or DB write failure.

**Test Data**:

- Attendee: `T3`
- Payment reference: `PAY-003`

**Steps**:

1. Complete payment successfully for `T3`.
2. Trigger system failure during ticket generation/storage.
3. Return to CMS and attempt to view ticket.

**Expected Results**:

- System displays a generic error indicating the ticket could not be generated at this time and provides a support contact path.
- Error is logged (verifiable in test logs).
- No ticket is stored in account (or an incomplete ticket is not visible as valid proof).
- Registration status should remain consistent with system design:
  - Either remains “Paid” but “ticket pending,” or does not finalize until ticket is generated (record actual behavior).

**Pass/Fail Criteria**:

- PASS if failure is handled safely with clear messaging and no invalid ticket; FAIL otherwise.

---

## AT-UC22-05 — Authorization: Attendee Can Only Access Their Own Ticket (Extension 7a)

**Priority**: High  
**Preconditions**:

- Tickets exist for attendees `T1` and `T2`.
- `T1` is logged in.

**Test Data**:

- Ticket ID for `T2` (or direct URL)

**Steps**:

1. As `T1`, attempt to access `T2`’s ticket directly (URL guessing or ID).
2. Attempt to view ticket details.

**Expected Results**:

- System denies access (access denied/403/not found/redirect as implemented).
- Ticket content is not displayed and no sensitive details leak.

**Pass/Fail Criteria**:

- PASS if cross-user access is blocked; FAIL otherwise.

---

## AT-UC22-06 — Ticket Persists and Can Be Retrieved Later

**Priority**: Medium  
**Preconditions**:

- Ticket exists for `T1` (from AT-UC22-01).
- Attendee can start a new session.

**Test Data**:

- Ticket for `PAY-001`

**Steps**:

1. Log out.
2. Log in later as `T1`.
3. Navigate to ticket view.

**Expected Results**:

- Ticket is still present and accessible.
- Ticket details match the original payment/registration data.
- Ticket remains accessible through the conference end date plus 90 days.

**Pass/Fail Criteria**:

- PASS if ticket persists and remains correct; FAIL otherwise.

---

## AT-UC22-07 — Idempotency: Duplicate Payment Confirmation Does Not Create Duplicate Tickets

**Priority**: Low  
**Preconditions**:

- Payment gateway/callback can replay confirmation for the same payment reference.
- Ticket already exists for `PAY-001`.

**Test Data**:

- Payment reference: `PAY-001` (duplicate confirmation)

**Steps**:

1. Simulate receiving the same “payment success” confirmation twice.
2. Check ticket list for `T1`.

**Expected Results**:

- Only one valid ticket exists for the payment (no duplicates).
- System remains consistent and logs the duplicate confirmation event.

**Pass/Fail Criteria**:

- PASS if duplicates are prevented/handled; FAIL otherwise.

---

## AT-UC22-08 — Retention Boundary: Ticket Not Accessible After Retention Window

**Priority**: Low  
**Preconditions**:

- Ticket exists for `T1` (from AT-UC22-01).
- Current date is after conference end date + 90 days.

**Test Data**:

- Ticket for `PAY-001`

**Steps**:

1. Log in as `T1` after the retention window has ended.
2. Navigate to ticket view.

**Expected Results**:

- Ticket is not accessible after the retention window.
- System provides a clear message indicating the ticket is no longer available.

**Pass/Fail Criteria**:

- PASS if ticket access is blocked after retention window; FAIL otherwise.

---

## Traceability (UC-22 Paths → Tests)

- **Main Success Scenario (generate + store + access)** → AT-UC22-01, AT-UC22-06
- **Delivery success** → AT-UC22-02
- **Extension 5a (delivery failure)** → AT-UC22-03
- **Extension 3a (generation/storage failure)** → AT-UC22-04
- **Extension 7a (unauthorized access)** → AT-UC22-05
- **Robustness/idempotency** → AT-UC22-07
- **Retention window** → AT-UC22-08

---

## Requirements Coverage (FR → Tests)

- **FR-001** (ticket generated within 2 minutes) → AT-UC22-01
- **FR-002** (ticket stored and accessible) → AT-UC22-01, AT-UC22-06
- **FR-003** (ticket includes required fields) → AT-UC22-01
- **FR-004** (confirmation message displayed) → AT-UC22-01
- **FR-005** (email-only delivery) → AT-UC22-02
- **FR-006** (delivery failure logs and ticket still accessible) → AT-UC22-03
- **FR-007** (generic error + support contact on generation failure) → AT-UC22-04
- **FR-008** (protect ticket access) → AT-UC22-05
- **FR-009** (duplicate confirmation idempotent) → AT-UC22-07
- **FR-010** (ticket accessible in later sessions) → AT-UC22-06
- **FR-011** (retain through conference end + 90 days) → AT-UC22-06
- **FR-013** (no access after retention ends) → AT-UC22-08
