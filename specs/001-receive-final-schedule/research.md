# Research Notes: Receive Final Conference Schedule

## Decision 1: Web Stack

**Decision**: Use vanilla HTML/CSS/JavaScript (ES2020) with MVC separation.
**Rationale**: Constitution requires a vanilla web stack and explicit MVC separation; this is the simplest compliant approach.
**Alternatives considered**: UI frameworks or build-tool-based stacks (rejected by constitution).

## Decision 2: Storage Strategy

**Decision**: Reuse existing CMS persistence for submissions, schedules, and notifications; no new storage system introduced.
**Rationale**: The feature extends existing CMS behavior and does not require new persistence primitives beyond existing data.
**Alternatives considered**: New schedule/notification store (unnecessary for current scope).

## Decision 3: Notification Delivery

**Decision**: Send both in-app and email notifications immediately upon final schedule publication to authors with accepted papers, using best-effort delivery with retries and logging for failures.
**Rationale**: Matches clarified requirements, improves reach, and provides resilience without expanding scope.
**Alternatives considered**: In-app only; email only; scheduled batch delivery.

## Decision 4: Timezone Display

**Decision**: Display schedule times in the conference’s official timezone only.
**Rationale**: Prevents ambiguity and matches the clarified requirement for final schedule presentation.
**Alternatives considered**: Author-local timezone; dual timezone display.

## Decision 5: Error UX Content

**Decision**: Use a user-friendly error message that includes a short cause category and a next-step action (retry, check connection, or contact support/admin), with optional “Report issue,” and no internal details.
**Rationale**: Aligns with requirements for clear, safe error messaging and supports self-service recovery.
**Alternatives considered**: Generic error without guidance (insufficient clarity).

## Decision 6: Publication Trigger

**Decision**: “Publish Final Schedule” is an explicit admin/editor action that changes schedule state to published, enabling access and notifications.
**Rationale**: Clarifies the trigger and removes ambiguity about when access and notifications begin.
**Alternatives considered**: Implicit publication on schedule generation (not aligned with spec).
