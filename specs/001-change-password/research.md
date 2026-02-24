# Research: Change Account Password

**Date**: 2026-02-01
**Spec**: /root/493-lab/Lab2/specs/001-change-password/spec.md

## Decisions

### 1) Stack constraints
- **Decision**: Use MVC with vanilla HTML/CSS/JavaScript only.
- **Rationale**: Required by the Lab2 CMS constitution; keeps implementation simple and consistent.
- **Alternatives considered**: Framework-based UI or server frameworks (rejected by constitution).

### 2) Acceptance tests source
- **Decision**: UC-03-AT.md is the canonical acceptance test document; no alternative naming, locations, or folders.
- **Rationale**: Constitution requires UC-XX-AT.md as the source of truth.
- **Alternatives considered**: Additional acceptance test files under other names or folders (not allowed).

### 3) MVC responsibility split
- **Decision**: Views render presentation only; validation and business logic live in controllers/services.
- **Rationale**: Required by constitution and avoids business logic in views.
- **Alternatives considered**: Inline validation logic in views (not allowed).

### 4) Session behavior
- **Decision**: Keep all existing sessions active after a password change.
- **Rationale**: Clarified in spec; avoids unexpected sign-outs.
- **Alternatives considered**: Invalidate all or other sessions (not selected).

### 5) Retry/lockout behavior
- **Decision**: No lockout or rate-based blocking for repeated incorrect current-password attempts.
- **Rationale**: Clarified in spec (FR-010).
- **Alternatives considered**: Temporary cooldown or lockout after N attempts.

### 6) Request context
- **Decision**: Password change applies to the currently authenticated user; no userId in request body.
- **Rationale**: Clarifies session context and avoids user switching in this flow.
- **Alternatives considered**: Including userId in request body (not needed for self-service change).

### 7) Contract style
- **Decision**: Expose a REST-style password change endpoint.
- **Rationale**: Aligns with existing CMS patterns and keeps the contract straightforward.
- **Alternatives considered**: GraphQL mutation (not necessary for this single action).
