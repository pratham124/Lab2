# Quickstart: Change Account Password

**Date**: 2026-02-01
**Spec**: /root/493-lab/Lab2/specs/001-change-password/spec.md
**Acceptance Tests (Canonical)**: /root/493-lab/Lab2/UC-03-AT.md

## Purpose

Validate the password change flow manually against UC-03 and the feature spec.

## Manual Validation Steps

1. Log in as a registered user.
2. Navigate to `/account/settings.html` from the dashboard account settings link.
3. Submit a correct current password and a policy-compliant new password.
   - Expect success confirmation and continued access to account features.
   - Existing sessions remain active (no session changes).
4. Submit an incorrect current password.
   - Expect inline error message; no password change.
   - No lockout or rate-based blocking is applied.
5. Submit a new password that violates policy (less than 8 characters or missing a letter/number).
   - Expect inline error message with policy requirements.
6. Trigger or simulate an update failure.
   - Expect a failure message and existing password to remain active.

## Notes

- The change applies to the currently authenticated user; no userId is provided in the request.
- No password confirmation field is required.
- No lockout or cooldown is applied for repeated incorrect attempts.
- All existing sessions remain active after a successful change.
