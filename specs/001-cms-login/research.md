# Research: CMS User Login

## Decision 1: User account storage

- **Decision**: Use a file-backed JSON store at `data/users.json` for registered accounts.
- **Rationale**: No external dependencies; aligns with vanilla stack and keeps storage deterministic for acceptance tests.
- **Alternatives considered**: In-memory only (non-persistent), external database (adds dependencies and setup).

## Decision 2: Session handling

- **Decision**: Use server-side session records with a random session ID stored in an HttpOnly cookie.
- **Rationale**: Supports dashboard access gating and prevents client-side session tampering without adding frameworks.
- **Alternatives considered**: LocalStorage token (less secure), URL-based session (leaks via history).

## Decision 3: Password hashing and verification

- **Decision**: Verify passwords against a salted hash using built-in runtime crypto functions; never store or log plaintext credentials.
- **Rationale**: Meets security requirements without adding dependencies and avoids plaintext exposure.
- **Alternatives considered**: Plaintext comparison (rejected for security), third-party hash library (disallowed by constraints).

## Decision 4: Error logging

- **Decision**: Log system verification failures and repeated failed attempts to `logs/auth.log` with timestamp and error code.
- **Rationale**: Meets UC-02 error logging and repeated-attempt recording without external services.
- **Alternatives considered**: Console-only logging (insufficient auditability).

## Decision 5: Input normalization

- **Decision**: Trim whitespace and normalize email case before lookup.
- **Rationale**: Addresses whitespace handling and reduces false login failures.
- **Alternatives considered**: Strict exact match with whitespace rejection (worse UX).

## Decision 6: User-safe error messaging

- **Decision**: Use non-technical, user-safe error messages that do not echo credentials or policy internals, and avoid account enumeration.
- **Rationale**: Aligns with security/privacy requirements while keeping messages actionable.
- **Alternatives considered**: Technical error details (rejected for safety and clarity).
