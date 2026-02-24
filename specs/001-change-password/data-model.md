# Data Model: Change Account Password

**Date**: 2026-02-01
**Spec**: /root/493-lab/Lab2/specs/001-change-password/spec.md

## Entities

### User Account

- **Fields**:
  - userId (unique identifier)
  - passwordHash (current credential)
  - passwordUpdatedAt (timestamp)
  - status (active/inactive)
- **Rules**:
  - Current password must match before update.
  - New password must be different from the current password.
  - Successful change does not invalidate or modify existing sessions.

### Password Policy

- **Fields**:
  - minLength = 8
  - requiresLetter = true
  - requiresNumber = true
- **Rules**:
  - Enforced on all password change requests.

### Password Change Request

- **Fields**:
  - currentPassword (input)
  - newPassword (input)
  - requestedAt (timestamp)
- **Context**:
  - Applies to the currently authenticated user; userId is derived from session, not request body.
- **Lifecycle**:
  - Created on submit.
  - Validated (current password + policy).
  - Applied to User Account if valid; otherwise rejected with errors.

## Relationships

- User Account 1:1 Password Policy (applies globally)
- User Account 1:N Password Change Request (historical, if retained)

## Validation Summary

- Reject if currentPassword does not match stored credentials.
- Reject if newPassword fails policy or equals current password.
- No lockout or rate-based blocking for repeated incorrect attempts.
