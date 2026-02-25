# Research: Submit Completed Review Form

## Decision 1: Use vanilla HTML/CSS/JS with MVC separation
- **Decision**: Implement with vanilla HTML, CSS, and JavaScript using MVC boundaries.
- **Rationale**: Required by the Lab2 CMS Constitution (vanilla stack + MVC separation).
- **Alternatives considered**: Using a JS framework (rejected due to constitution constraints).

## Decision 2: Persist reviews in the existing CMS database
- **Decision**: Store submitted reviews in the existing CMS database with references to paper and reviewer.
- **Rationale**: Multiple use cases explicitly reference database persistence across the CMS; this aligns with system-wide storage expectations.
- **Alternatives considered**: File-based storage or in-memory only (rejected as inconsistent with CMS-wide persistence).

## Decision 3: Acceptance tests drive validation
- **Decision**: Validate behavior using `UC-13-AT.md` as the acceptance contract.
- **Rationale**: Constitution requires acceptance tests to be the source of truth; manual execution is the current testing approach.
- **Alternatives considered**: Automated test framework (deferred until project introduces a test runner).

## Decision 4: Review lifecycle rules
- **Decision**: One submission per reviewer per paper, no resubmission, and no edits after successful submission; editor visibility is immediate.
- **Rationale**: Clarifications captured in the feature spec define the lifecycle explicitly and align with UC-13 behavior.
- **Alternatives considered**: Resubmission allowed or delayed editor visibility (rejected per spec clarifications).
