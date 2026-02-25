# Research Log: View Completed Reviews for a Paper

## Decision 1: Stack and architecture
- **Decision**: Use vanilla HTML/CSS/JavaScript with explicit MVC separation.
- **Rationale**: Required by the project constitution; keeps implementation minimal and consistent.
- **Alternatives considered**: Using a frontend framework (rejected by constitution).

## Decision 2: Access control scope
- **Decision**: Only the assigned editor can view completed reviews for a paper.
- **Rationale**: Matches clarified requirement and prevents cross-editor data exposure.
- **Alternatives considered**: Any editor access (rejected due to confidentiality risk).

## Decision 3: Reviewer identity visibility
- **Decision**: Reviewer identities are visible to the assigned editor.
- **Rationale**: Clarified by user; supports editorial decision-making.
- **Alternatives considered**: Anonymous to editor; configurable policy.

## Decision 4: Review visibility timing
- **Decision**: Completed reviews are visible immediately after submission, even if others are pending.
- **Rationale**: Clarified by user; enables earlier evaluation without waiting for all reviews.
- **Alternatives considered**: Only show after all assigned reviews are complete.

## Decision 5: Error handling
- **Decision**: On retrieval failure, show a user-friendly error message and record the failure for administrators.
- **Rationale**: Matches UC-14 extensions and acceptance tests; avoids information leakage.
- **Alternatives considered**: Silent failure; retry-only.
