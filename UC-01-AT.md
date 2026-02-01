# Acceptance Test Suite — UC-01 Register User Account

## Overview

**Use Case**: UC-01 Register User Account  
**Objective**: Verify that a user can register with a unique, valid email and a compliant password, and that failures are handled correctly.  
**In Scope**: Email uniqueness/format validation, password validation, persistence, error handling, redirect behavior.  
**Out of Scope**: Email verification workflows (not specified), CAPTCHA, MFA.

---

## AT-UC01-01 — Successful Registration (Main Success Scenario)

**Priority**: High  
**Preconditions**:

- User is not logged in.
- No existing account uses `new.user@example.com`.
- CMS and database are available.

**Test Data**:

- Email: `new.user@example.com`
- Password: `ValidPassw0rd!` (assumed compliant)

**Steps**:

1. Navigate to the CMS registration page.
2. Enter `new.user@example.com` and `ValidPassw0rd!`.
3. Submit the registration form.

**Expected Results**:

- System validates email format and uniqueness successfully.
- System validates password successfully.
- A new user record is created in the database with the provided email.
- User is redirected to the login page.
- No validation error messages are shown.

**Pass/Fail Criteria**:

- PASS if account is created once and redirect occurs to login; FAIL otherwise.

---

## AT-UC01-02 — Reject Duplicate Email (Extension 4a)

**Priority**: High  
**Preconditions**:

- User is not logged in.
- An account already exists with `existing.user@example.com`.

**Test Data**:

- Email: `existing.user@example.com`
- Password: `ValidPassw0rd!`

**Steps**:

1. Navigate to the registration page.
2. Enter `existing.user@example.com` and `ValidPassw0rd!`.
3. Submit the form.

**Expected Results**:

- System detects email is already registered.
- System displays an error message indicating the email is already in use.
- No new account is created.
- User remains on registration page (or is returned to it) with inputs preserved or safely cleared.
- No redirect to login occurs.

**Pass/Fail Criteria**:

- PASS if duplicate is blocked and no new record is created; FAIL otherwise.

---

## AT-UC01-03 — Reject Invalid Email Format (Email Validation)

**Priority**: High  
**Preconditions**:

- User is not logged in.

**Test Data**:

- Email: `invalid-email-format`
- Password: `ValidPassw0rd!`

**Steps**:

1. Navigate to registration page.
2. Enter `invalid-email-format` and `ValidPassw0rd!`.
3. Submit the form.

**Expected Results**:

- System rejects email due to invalid format per RFC 5322.
- System displays an error message indicating email is invalid.
- No account is created.
- No redirect to login occurs.

**Pass/Fail Criteria**:

- PASS if invalid email is blocked; FAIL otherwise.

---

## AT-UC01-04 — Reject Non-Compliant Password (Extension 5a)

**Priority**: High  
**Preconditions**:

- User is not logged in.
- Email is unique and valid.

**Test Data**:

- Email: `new2.user@example.com`
- Password: `123` (assumed non-compliant)

**Steps**:

1. Navigate to registration page.
2. Enter `new2.user@example.com` and `123`.
3. Submit the form.

**Expected Results**:

- Email validation passes.
- Password validation fails.
- System displays an error describing password constraints.
- No account is created.
- No redirect to login occurs.

**Pass/Fail Criteria**:

- PASS if account is not created and user gets password guidance; FAIL otherwise.

---

## AT-UC01-05 — Handle Database/System Failure Gracefully (Extension 6a)

**Priority**: High  
**Preconditions**:

- User is not logged in.
- Email is unique and valid.
- Simulate database failure (e.g., DB down, write failure, transaction error).

**Test Data**:

- Email: `new3.user@example.com`
- Password: `ValidPassw0rd!`

**Steps**:

1. Navigate to registration page.
2. Enter `new3.user@example.com` and `ValidPassw0rd!`.
3. Submit the form while DB failure is active.

**Expected Results**:

- System does not create a partial/duplicate account.
- System displays a registration failure message (non-technical).
- Error is logged (verifiable via system logs in test environment).
- User is not redirected to login.

**Pass/Fail Criteria**:

- PASS if system fails safely with no account created and error logged; FAIL otherwise.

---

## AT-UC01-06 — Prevent Double-Submission Creating Duplicate Accounts

**Priority**: Medium  
**Preconditions**:

- User is not logged in.
- Email is unique and valid.

**Test Data**:

- Email: `new4.user@example.com`
- Password: `ValidPassw0rd!`

**Steps**:

1. Navigate to registration page.
2. Enter email and password.
3. Click submit twice quickly (or refresh/resubmit).

**Expected Results**:

- At most one account is created for `new4.user@example.com`.
- User ends on login page (or receives a safe message if duplicate submission is detected).
- No server error/stack trace is shown.

**Pass/Fail Criteria**:

- PASS if exactly one account exists; FAIL otherwise.

---

## AT-UC01-07 — Required Fields Validation

**Priority**: Medium  
**Preconditions**:

- User is not logged in.

**Test Data**:

- Email: _(blank)_
- Password: _(blank)_

**Steps**:

1. Navigate to registration page.
2. Leave email and/or password blank.
3. Submit the form.

**Expected Results**:

- System displays “Email is required” when email is blank.
- System displays “Password is required” when password is blank.
- No account is created.
- No redirect to login occurs.

**Pass/Fail Criteria**:

- PASS if blanks are blocked with clear errors; FAIL otherwise.

---

## AT-UC01-08 — Whitespace Handling in Email Input

**Priority**: Low  
**Preconditions**:

- User is not logged in.
- Email is unique once trimmed.

**Test Data**:

- Email: `  new5.user@example.com  `
- Password: `ValidPassw0rd!`

**Steps**:

1. Navigate to registration page.
2. Enter email with leading/trailing spaces and valid password.
3. Submit.

**Expected Results**:

- System trims whitespace (or rejects with a clear message).
- If trimmed email is valid and unique, account is created for `new5.user@example.com`.
- Redirect to login occurs on success.

**Pass/Fail Criteria**:

- PASS if behavior is consistent and does not create malformed emails; FAIL otherwise.

---

## Traceability (UC-01 Steps → Tests)

- **Main Success Scenario** → AT-UC01-01
- **Extension 4a (duplicate email)** → AT-UC01-02
- **Email invalid format** (implied by “valid email”) → AT-UC01-03
- **Extension 5a (bad password)** → AT-UC01-04
- **Extension 6a (system/DB error)** → AT-UC01-05
- **Robustness/edge cases** → AT-UC01-06, AT-UC01-07, AT-UC01-08
