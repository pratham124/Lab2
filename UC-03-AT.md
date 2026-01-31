# Acceptance Test Suite — UC-03 Change Account Password

## Overview

**Use Case**: UC-03 Change Account Password  
**Objective**: Verify that an authenticated registered user can change their password, that the system enforces password rules, and that failures are handled safely.  
**In Scope**: Current password verification, new password validation, database update, confirmation messaging, login behavior after change (where verifiable).  
**Out of Scope**: Password reset (forgot password), MFA, account lockout/rate limiting, detailed password policy specifics beyond “security standards” (not specified).

---

## AT-UC03-01 — Successful Password Change (Main Success Scenario)

**Priority**: High  
**Preconditions**:

- User is logged in with an active authenticated session.
- Account exists: `user1@example.com`
- Current password is `OldPassw0rd!`
- CMS and database are available.

**Test Data**:

- Current Password: `OldPassw0rd!`
- New Password: `NewPassw0rd!` (assumed compliant)

**Steps**:

1. Navigate to Account Settings.
2. Open the Change Password page/form.
3. Enter current password `OldPassw0rd!` and new password `NewPassw0rd!`.
4. Submit the form.

**Expected Results**:

- System verifies the current password is correct.
- System validates the new password against security standards.
- System updates the stored password in the database.
- System displays a success confirmation message.
- User remains authenticated (or is prompted to re-authenticate, if that is the implemented behavior—record actual behavior).

**Pass/Fail Criteria**:

- PASS if password is updated and a success confirmation is shown; FAIL otherwise.

---

## AT-UC03-02 — Reject Incorrect Current Password (Extension 4a)

**Priority**: High  
**Preconditions**:

- User is logged in.
- Current password is `OldPassw0rd!`

**Test Data**:

- Current Password: `WrongOldPass!`
- New Password: `NewPassw0rd!`

**Steps**:

1. Navigate to Change Password form.
2. Enter `WrongOldPass!` as current password and `NewPassw0rd!` as new password.
3. Submit the form.

**Expected Results**:

- System rejects the request because current password verification fails.
- System displays an error indicating the current password is invalid.
- Password in database remains unchanged.
- User is not logged out solely due to this error.

**Pass/Fail Criteria**:

- PASS if password remains unchanged and correct error is shown; FAIL otherwise.

---

## AT-UC03-03 — Reject Non-Compliant New Password (Extension 5a)

**Priority**: High  
**Preconditions**:

- User is logged in.
- Current password is correct.

**Test Data**:

- Current Password: `OldPassw0rd!`
- New Password: `123` (assumed non-compliant)

**Steps**:

1. Navigate to Change Password form.
2. Enter current password `OldPassw0rd!` and new password `123`.
3. Submit the form.

**Expected Results**:

- System accepts current password but rejects new password due to policy.
- System displays an error describing password constraints.
- Password in database remains unchanged.

**Pass/Fail Criteria**:

- PASS if new password is rejected and old password remains active; FAIL otherwise.

---

## AT-UC03-04 — Handle System/Database Failure During Update (Extension 6a)

**Priority**: High  
**Preconditions**:

- User is logged in.
- Current password is correct.
- Simulate DB outage or write failure.

**Test Data**:

- Current Password: `OldPassw0rd!`
- New Password: `NewPassw0rd!`

**Steps**:

1. Navigate to Change Password form.
2. Enter valid current and new password.
3. Submit while DB/write failure is active.

**Expected Results**:

- System does not partially update the password.
- System displays a failure message (non-technical).
- Error is logged (verifiable in test environment logs).
- Password remains unchanged.

**Pass/Fail Criteria**:

- PASS if system fails safely and password is unchanged; FAIL otherwise.

---

## AT-UC03-05 — New Password Equals Current Password (Policy/Usability Check)

**Priority**: Medium  
**Preconditions**:

- User is logged in.
- Current password: `OldPassw0rd!`

**Test Data**:

- Current Password: `OldPassw0rd!`
- New Password: `OldPassw0rd!`

**Steps**:

1. Navigate to Change Password form.
2. Enter `OldPassw0rd!` for both current and new password.
3. Submit.

**Expected Results**:

- System either:
  - Rejects with a clear message that the new password must be different, **or**
  - Accepts (if not restricted). Record observed behavior.
- No silent failure.

**Pass/Fail Criteria**:

- PASS if behavior is consistent and user receives clear outcome; FAIL if ambiguous or inconsistent.

---

## AT-UC03-06 — Verify Login Works With New Password After Change

**Priority**: High  
**Preconditions**:

- AT-UC03-01 completed successfully (password updated to `NewPassw0rd!`).
- User can log out (or session can be invalidated manually).

**Test Data**:

- Email: `user1@example.com`
- Old Password: `OldPassw0rd!`
- New Password: `NewPassw0rd!`

**Steps**:

1. Log out (or end session).
2. Attempt login using old password `OldPassw0rd!`.
3. Attempt login using new password `NewPassw0rd!`.

**Expected Results**:

- Login with old password fails.
- Login with new password succeeds and redirects to dashboard.

**Pass/Fail Criteria**:

- PASS if old password no longer works and new password works; FAIL otherwise.

---

## AT-UC03-07 — Required Fields Validation (Blank Inputs)

**Priority**: Medium  
**Preconditions**:

- User is logged in.

**Test Data**:

- Current Password: _(blank)_
- New Password: _(blank)_

**Steps**:

1. Navigate to Change Password form.
2. Leave one or both fields blank.
3. Submit.

**Expected Results**:

- System displays validation errors for missing required fields.
- No password update occurs.

**Pass/Fail Criteria**:

- PASS if blanks are blocked and password unchanged; FAIL otherwise.

---

## AT-UC03-08 — Prevent Double-Submission Updating Password Twice

**Priority**: Low  
**Preconditions**:

- User is logged in.
- Current password valid.

**Test Data**:

- Current Password: `OldPassw0rd!`
- New Password: `NewPassw0rd!`

**Steps**:

1. Enter valid current/new password.
2. Click submit twice quickly (or refresh/resubmit).

**Expected Results**:

- Password change is processed at most once.
- System shows success once (or safely handles the second attempt with a clear message).
- No error/stack trace is shown.

**Pass/Fail Criteria**:

- PASS if system remains stable and password ends in the expected state; FAIL otherwise.

---

## Traceability (UC-03 Steps → Tests)

- **Main Success Scenario** → AT-UC03-01, AT-UC03-06
- **Extension 4a (incorrect current password)** → AT-UC03-02
- **Extension 5a (new password invalid)** → AT-UC03-03
- **Extension 6a (system/DB error)** → AT-UC03-04
- **Validation/robustness checks** → AT-UC03-05, AT-UC03-07, AT-UC03-08
