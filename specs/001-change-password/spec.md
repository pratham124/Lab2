# Feature Specification: Change Account Password

**Feature Branch**: `001-change-password`  
**Created**: 2026-02-01  
**Status**: Draft  
**Input**: User description: "UC-03.md"

## User Scenarios & Testing *(mandatory)*

## Use Case Mapping *(mandatory)*

- **Primary Use Case(s)**: UC-03
- **Acceptance Tests**: UC-03-AT
- **Notes**: Update existing UC-03 behavior. Assumptions: user remains logged in after a successful change; password policy is minimum 8 characters, at least 1 letter and 1 number, and must differ from the current password. Session behavior: all existing sessions remain active after password change. Password history: new password must differ from the current password only.

### User Story 1 - Change Password Successfully (Priority: P1)

A logged-in user updates their account password from account settings and receives confirmation that the change succeeded.

**Why this priority**: This is the core security-maintenance task and primary user goal.

**Independent Test**: Can be fully tested by changing a password with valid inputs and verifying the user can continue using the system.

**Acceptance Scenarios**:

1. **Given** a logged-in registered user, **When** they submit the change-password form with the correct current password and a policy-compliant new password, **Then** the system updates the password and confirms success.
2. **Given** a successful password change, **When** the user continues their session, **Then** they remain logged in and can access account features.

---

### User Story 2 - Correct Invalid Password Inputs (Priority: P2)

A logged-in user receives clear guidance when the current password is incorrect or the new password does not meet policy, and can correct the input.

**Why this priority**: Clear errors prevent lockouts and reduce support load while maintaining security.

**Independent Test**: Can be tested by submitting invalid inputs and verifying the correct error messages appear without changing the password.

**Acceptance Scenarios**:

1. **Given** a logged-in user, **When** they enter an incorrect current password, **Then** the system rejects the change and displays an error explaining the current password is invalid.
2. **Given** a logged-in user, **When** they enter a new password that fails policy, **Then** the system rejects the change and displays the policy requirements.

---

### User Story 3 - Handle Update Failures Gracefully (Priority: P3)

A logged-in user is informed when a system error prevents a password change and their existing password remains active.

**Why this priority**: Users need clear feedback and safety when the system cannot complete the change.

**Independent Test**: Can be tested by simulating a backend failure and verifying the user sees a failure message and the password is unchanged.

**Acceptance Scenarios**:

1. **Given** a logged-in user with valid inputs, **When** a system error occurs during update, **Then** the system displays a failure message and the existing password remains in effect.

---

### Edge Cases

- What happens when the new password matches the current password?
- How does the system handle repeated incorrect current-password attempts in a short period? (No lockout; retries allowed.)

## Clarifications

### Session 2026-02-01

- Q: How should repeated incorrect current-password attempts be handled? → A: No lockout; unlimited retries with error messages.
- Q: What should happen to existing sessions after a password change? → A: Keep all sessions active (no session changes).
- Q: Should the new password differ from password history? → A: Must differ from only the current password.
- Q: Should users confirm the new password? → A: No confirmation field; new password entered once.
- Q: How should validation errors be presented? → A: Inline error only (no summary).

## Out of Scope

- Password reset or recovery for logged-out users
- Administrator-initiated password changes
- Changes to multi-factor authentication settings
- Handling cases where the password update succeeds but the confirmation message fails to display

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow logged-in registered users to access a change-password form from account settings.
- **FR-002**: System MUST require the current password and a new password to submit a change request.
- **FR-003**: System MUST verify the current password matches the stored credentials before changing it.
- **FR-004**: System MUST validate the new password against the CMS password policy: minimum 8 characters, at least 1 letter and 1 number, and different from the current password.
- **FR-005**: System MUST update the user’s password when validation succeeds and confirm success to the user.
- **FR-006**: System MUST reject changes with incorrect current passwords and show a clear error message.
- **FR-007**: System MUST reject changes with non-compliant new passwords and display the policy requirements.
- **FR-008**: System MUST preserve the user’s existing password if a system error occurs and display a failure message.
- **FR-009**: System MUST keep the user logged in after a successful password change.
- **FR-010**: System MUST allow repeated incorrect current-password attempts without a temporary lockout, while displaying the error message each time.
- **FR-011**: System MUST keep all existing user sessions active after a successful password change.
- **FR-012**: System MUST accept a single new-password entry without requiring a confirmation field.
- **FR-013**: System MUST display validation errors inline near the relevant field and MUST NOT show a separate summary.

### Key Entities *(include if feature involves data)*

- **User Account**: Registered user profile with authentication credentials and account settings access.
- **Password Policy**: The set of rules used to validate new passwords.
- **Password Change Request**: User-initiated request containing current password and proposed new password.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 95% of successful password changes are completed by users in under 2 minutes from opening account settings.
- **SC-002**: 100% of attempts with an incorrect current password are rejected and display an error message.
- **SC-003**: Post-release metric (external user survey): At least 90% of users who enter a non-compliant new password can correct it and succeed within two attempts.
- **SC-004**: Post-release metric (support analytics): Support tickets related to password change failures decrease by 30% within 60 days of release compared to the 60-day pre-release baseline from support ticketing reports.
