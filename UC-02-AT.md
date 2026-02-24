# Acceptance Test Suite: UC-02 Log In to CMS

## Overview

**Use Case**: UC-02 Log In to CMS  
**Objective**: Validate secure login, dashboard session gating, and safe failure handling.

## AT-UC02-01 Successful Login and Session Persistence

**Priority**: High  
**Preconditions**:

- User is logged out.
- Registered account exists: `user1@example.com` / `ValidPassw0rd!`.

**Steps**:

1. Open login page.
2. Submit valid credentials.
3. Navigate to dashboard and other authorized pages.

**Expected Results**:

- Authentication succeeds.
- Session is created.
- User is redirected to dashboard.
- Authorized navigation works during same session.

## AT-UC02-02 Generic Error for Unknown Email

**Priority**: High

**Steps**:

1. Submit `unknown@example.com` with any password.

**Expected Results**:

- Login fails.
- Message is generic and user-safe: `Invalid email or password.`
- User remains on login page.
- No session is created.

## AT-UC02-03 Generic Error for Incorrect Password

**Priority**: High

**Steps**:

1. Submit `user1@example.com` with wrong password.

**Expected Results**:

- Login fails.
- Message is the same generic user-safe message: `Invalid email or password.`
- User remains on login page.
- No session is created.

## AT-UC02-04 Required Field Validation

**Priority**: Medium

**Steps**:

1. Submit form with blank email and/or blank password.

**Expected Results**:

- System shows required-field messaging.
- Authentication is not attempted.
- No session is created.

## AT-UC02-05 Verification Failure/System Outage

**Priority**: High

**Steps**:

1. Simulate auth verification outage.
2. Submit otherwise valid credentials.

**Expected Results**:

- Login fails.
- User sees user-safe failure message.
- Internal error event is recorded.
- No session is created.

## AT-UC02-06 Prevent Dashboard Access After Failed Login

**Priority**: Medium

**Steps**:

1. Submit invalid credentials.
2. Attempt direct access to dashboard URL.

**Expected Results**:

- Dashboard access is denied.
- User is redirected to login or receives unauthorized response.

## AT-UC02-07 Redirect Authenticated Users Away from Login

**Priority**: Medium

**Steps**:

1. Log in successfully.
2. Request login page again.

**Expected Results**:

- User is redirected to dashboard.
- Login form is not re-shown for active session.

## AT-UC02-08 Email Normalization/Whitespace Handling

**Priority**: Medium

**Steps**:

1. Submit email with leading/trailing whitespace and valid password.

**Expected Results**:

- Email is normalized before lookup.
- Login succeeds for matching account.

## AT-UC02-09 Repeated Failed Attempts Recorded (No Lockout)

**Priority**: Medium

**Steps**:

1. Submit several invalid login attempts in sequence.

**Expected Results**:

- Each failed attempt is recorded.
- No lockout behavior is applied within this feature scope.

## Traceability

- Main success scenario (UC-02 steps 1-6): AT-UC02-01
- Extension 4a (unknown email): AT-UC02-02
- Extension 4b (incorrect password): AT-UC02-03
- Extension 3a (missing fields): AT-UC02-04
- Extension 4c (system/outage failure): AT-UC02-05
- Dashboard protection/session safety: AT-UC02-06, AT-UC02-07
- Edge cases (normalization and repeated failures): AT-UC02-08, AT-UC02-09
