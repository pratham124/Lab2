# Acceptance Test Suite — UC-02 Log In to CMS

## Overview

**Use Case**: UC-02 Log In to CMS  
**Objective**: Verify that a registered user can authenticate securely using email and password and reach their dashboard; verify that invalid credentials and system failures are handled correctly.  
**In Scope**: Login form, credential verification, session creation, redirect to dashboard, error handling.  
**Out of Scope**: Password reset/change flow, MFA, CAPTCHA, account lockout/rate limiting (not specified).

---

## AT-UC02-01 — Successful Login (Main Success Scenario)

**Priority**: High  
**Preconditions**:

- User is not logged in.
- A registered account exists: `user1@example.com` with password `ValidPassw0rd!`.
- CMS and database are available.

**Test Data**:

- Email: `user1@example.com`
- Password: `ValidPassw0rd!`

**Steps**:

1. Navigate to the CMS login page.
2. Enter `user1@example.com` and `ValidPassw0rd!`.
3. Submit the login form.

**Expected Results**:

- System verifies the email exists.
- System verifies the password matches stored credentials.
- System authenticates the user and establishes a session.
- System redirects the user to their dashboard.
- No error message is displayed.

**Pass/Fail Criteria**:

- PASS if user lands on dashboard with an active session; FAIL otherwise.

---

## AT-UC02-02 — Reject Non-Existent Account (Extension 4a)

**Priority**: High  
**Preconditions**:

- User is not logged in.
- No account exists for `unknown@example.com`.

**Test Data**:

- Email: `unknown@example.com`
- Password: `ValidPassw0rd!`

**Steps**:

1. Navigate to the login page.
2. Enter `unknown@example.com` and `ValidPassw0rd!`.
3. Submit the form.

**Expected Results**:

- System does not authenticate the user.
- System displays an error indicating the account does not exist.
- User remains on (or is returned to) the login page.
- No session is created and no redirect to dashboard occurs.

**Pass/Fail Criteria**:

- PASS if access is denied and no session is created; FAIL otherwise.

---

## AT-UC02-03 — Reject Incorrect Password (Extension 4b)

**Priority**: High  
**Preconditions**:

- User is not logged in.
- Account exists for `user1@example.com`.

**Test Data**:

- Email: `user1@example.com`
- Password: `WrongPass!`

**Steps**:

1. Navigate to the login page.
2. Enter `user1@example.com` and `WrongPass!`.
3. Submit the form.

**Expected Results**:

- System detects password mismatch.
- System displays an error indicating invalid credentials.
- User remains on login page.
- No session is created and no redirect to dashboard occurs.

**Pass/Fail Criteria**:

- PASS if credentials are rejected and no session exists; FAIL otherwise.

---

## AT-UC02-04 — Required Fields Validation (Blank Email and/or Password)

**Priority**: Medium  
**Preconditions**:

- User is not logged in.

**Test Data**:

- Email: _(blank)_
- Password: _(blank)_

**Steps**:

1. Navigate to the login page.
2. Leave email and/or password empty.
3. Submit the form.

**Expected Results**:

- System displays validation errors for missing required fields.
- No authentication attempt succeeds.
- No session is created and no redirect occurs.

**Pass/Fail Criteria**:

- PASS if blanks are blocked with clear messages; FAIL otherwise.

---

## AT-UC02-05 — Handle System/Database Failure (Extension 4c)

**Priority**: High  
**Preconditions**:

- User is not logged in.
- Account exists for `user1@example.com`.
- Simulate DB outage or credential-check service failure.

**Test Data**:

- Email: `user1@example.com`
- Password: `ValidPassw0rd!`

**Steps**:

1. Navigate to the login page.
2. Enter valid credentials.
3. Submit the form while DB/service failure is active.

**Expected Results**:

- System does not authenticate the user.
- System shows a login failure message (non-technical).
- Error is logged (verifiable in test environment logs).
- User is not redirected to dashboard and no session is created.

**Pass/Fail Criteria**:

- PASS if failure is handled safely with no session created; FAIL otherwise.

---

## AT-UC02-06 — Prevent Session Creation on Failed Login

**Priority**: Medium  
**Preconditions**:

- User is not logged in.
- Account exists for `user1@example.com`.

**Test Data**:

- Email: `user1@example.com`
- Password: `WrongPass!`

**Steps**:

1. Attempt login with invalid password.
2. After rejection, try to access the dashboard URL directly.

**Expected Results**:

- Dashboard access is denied (redirect to login or access denied page).
- No authenticated session is present.

**Pass/Fail Criteria**:

- PASS if dashboard remains protected; FAIL otherwise.

---

## AT-UC02-07 — Redirect Authenticated User Away from Login Page

**Priority**: Low  
**Preconditions**:

- User is logged in with an active authenticated session.

**Test Data**:

- None

**Steps**:

1. While logged in, navigate to the login page.

**Expected Results**:

- System redirects the user to their dashboard (or another authenticated landing page).
- Login form is not shown for an already-authenticated session.

**Pass/Fail Criteria**:

- PASS if authenticated users are not prompted to log in again; FAIL otherwise.

---

## AT-UC02-08 — Whitespace Handling in Email Input

**Priority**: Low  
**Preconditions**:

- User is not logged in.
- Account exists for `user1@example.com`.

**Test Data**:

- Email: `  user1@example.com  `
- Password: `ValidPassw0rd!`

**Steps**:

1. Navigate to the login page.
2. Enter email with leading/trailing spaces and valid password.
3. Submit.

**Expected Results**:

- System trims whitespace (or rejects with a clear message).
- If trimmed email is valid, authentication succeeds and redirects to dashboard.
- No malformed email value is used internally.

**Pass/Fail Criteria**:

- PASS if behavior is consistent and user can log in securely; FAIL otherwise.

---

## Traceability (UC-02 Steps → Tests)

- **Main Success Scenario** → AT-UC02-01
- **Extension 4a (account not found)** → AT-UC02-02
- **Extension 4b (incorrect password)** → AT-UC02-03
- **Extension 4c (system/DB error)** → AT-UC02-05
- **General validation & security robustness** → AT-UC02-04, AT-UC02-06, AT-UC02-07, AT-UC02-08
