# Research: View Published Conference Schedule

## Decision 1: Use vanilla web stack (HTML/CSS/JS)

**Decision**: Implement with vanilla HTML, CSS, and JavaScript only.
**Rationale**: Required by the Lab2 CMS Constitution and keeps the schedule view lightweight and accessible.
**Alternatives considered**: UI frameworks or build tools (rejected due to constitution constraints).

## Decision 2: Read-only access to existing schedule data

**Decision**: Use the existing CMS schedule data store as the source of truth; no new storage introduced.
**Rationale**: The feature is view-only and depends on already published schedules.
**Alternatives considered**: Creating a separate view-specific cache or duplication (unnecessary for read-only scope).

## Decision 3: Public access without authentication

**Decision**: Published schedules are publicly viewable without login.
**Rationale**: Clarified in the feature spec; reduces friction for attendees.
**Alternatives considered**: Attendee login required (adds friction without stated benefit).

## Decision 4: Contracted error payload and retry behavior

**Decision**: Retrieval failures return an `ErrorMessage` with a user-facing message (short cause + next step) and `canRetry` flag; retry is a re-GET when `canRetry=true`.
**Rationale**: Keeps UI behavior consistent with the OpenAPI contract and clarifies error handling requirements.
**Alternatives considered**: Implicit retry without a flag (less clear for UI) or non-contractual error formats (inconsistent).
