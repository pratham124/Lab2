# Research Notes: Edit Generated Conference Schedule

## Decision 1: Optimistic Concurrency on Schedule Edits

- **Decision**: Use `lastUpdatedAt` captured on load; reject save if it changed and prompt refresh/reload.
- **Rationale**: Prevents accidental overwrites when the schedule changes between load and save; aligns with the clarification to block saving and prompt refresh.
- **Alternatives considered**:
  - Last-write-wins: risks overwriting newer edits.
  - Auto-merge: adds complexity and ambiguous merge behavior for schedule conflicts.

## Decision 2: MVC Separation in Vanilla Web Stack

- **Decision**: Keep scheduling validation and persistence logic in models/services; controllers orchestrate edit/save flow; views render state and messages only.
- **Rationale**: Required by constitution and keeps logic testable without frameworks.
- **Alternatives considered**:
  - View-heavy logic: violates MVC and reduces testability.

## Decision 3: Standardized Error Payload

- **Decision**: Standardize error payload fields: `errorCode`, `summary`, `affectedItemId`, optional `conflicts[]`, `recommendedAction` with expected codes `CONFLICT`, `STALE_EDIT`, `SAVE_FAILED`.
- **Rationale**: Ensures clear, actionable messages with structured data for UI rendering.
- **Alternatives considered**:
  - Freeform messages only: unclear and inconsistent across errors.

## Decision 4: Atomic Save Failure Handling

- **Decision**: Treat save as atomic; on failure return `errorCode` `SAVE_FAILED` with `recommendedAction` to retry or refresh.
- **Rationale**: Prevents partial updates and clarifies next steps for editors.
- **Alternatives considered**:
  - Partial writes with compensating fixes: higher risk and complexity.

## Decision 5: Idempotent Double-Submit Handling

- **Decision**: Treat identical rapid save submissions as idempotent, returning the same final state without duplicates.
- **Rationale**: Simplifies behavior and avoids duplicate schedule entries.
- **Alternatives considered**:
  - `409 DUPLICATE_SUBMIT`: adds error handling without user value.

## Decision 6: Editor-Only Enforcement

- **Decision**: Enforce editor-only edits server-side; also hide/disable edit UI for non-editors.
- **Rationale**: Defense-in-depth for authorization and clearer UX.
- **Alternatives considered**:
  - UI-only controls: insufficient security.

## Decision 7: Immediate Visibility Semantics

- **Decision**: “Immediate visibility” means the next GET `/schedule/current` reflects the latest persisted state without caching delay.
- **Rationale**: Removes ambiguity and aligns with FR-006a wording.
- **Alternatives considered**:
  - Eventual consistency window: ambiguous and risks confusion.

## Decision 8: Storage Integration

- **Decision**: Treat existing CMS schedule persistence as the source of truth; schedule updates replace the current schedule state.
- **Rationale**: Matches spec assumptions and avoids introducing draft/publish workflows.
- **Alternatives considered**:
  - Draft/publish model: expands scope beyond UC-17.

## Decision 9: Performance Measurement

- **Decision**: Add lightweight timing instrumentation around validation+save to measure p95 ≤ 5s for ~1,000 items.
- **Rationale**: Aligns plan targets with measurable evidence.
- **Alternatives considered**:
  - No instrumentation: performance target not verifiable.
