# Phase 0 Research — Assign Reviewers to Papers

## Decision 1: Reviewer count rule
- **Decision**: Require exactly three reviewers per paper.
- **Rationale**: Explicit in UC-08-AT and the specification; ensures consistent evaluation.
- **Alternatives considered**: Allow variable reviewer counts (rejected because acceptance tests require exactly three).

## Decision 2: Workload limit enforcement
- **Decision**: Block assignments that would exceed five assigned papers per reviewer.
- **Rationale**: Explicit in UC-08-AT and the specification; prevents overload.
- **Alternatives considered**: Allow override with justification (rejected to align with acceptance tests).

## Decision 3: Insufficient eligible reviewers
- **Decision**: Block assignment and show a clear message when fewer than three eligible reviewers exist.
- **Rationale**: Ensures rule compliance and prevents partial assignments.
- **Alternatives considered**: Allow partial assignments (rejected due to rule integrity).

## Decision 4: Re-assignment behavior
- **Decision**: Block re-assignment if reviewers are already assigned and show a clear message.
- **Rationale**: Avoids overwriting existing assignments without explicit workflow.
- **Alternatives considered**: Allow overwrite or removal during assignment (rejected without explicit use case support).

## Decision 5: Invitation failure handling (non-blocking)
- **Decision**: Keep assignments, warn the editor, and retry invitations if notification fails.
- **Rationale**: Preserves assignment integrity while ensuring invitations are eventually sent.
- **Alternatives considered**: Roll back assignments or silently skip invitations (rejected for data integrity and transparency).

## Decision 6: Performance targets
- **Decision**: No explicit performance targets beyond standard responsiveness.
- **Rationale**: Clarified in specification; avoids artificial constraints.
- **Alternatives considered**: Hard latency targets (deferred unless needed later).
