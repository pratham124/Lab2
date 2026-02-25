# Phase 0 Research: Generate Conference Schedule

## Decisions

### Decision 1: Implementation Stack
- **Decision**: Use vanilla HTML, CSS, and JavaScript with MVC separation.
- **Rationale**: Required by the Lab2 CMS Constitution; aligns with existing project constraints.
- **Alternatives considered**: Framework-based UI or build tools (rejected by constitution).

### Decision 2: Storage Strategy
- **Decision**: Persist schedules using the existing CMS data store.
- **Rationale**: UC-16 requires schedule storage but does not specify storage technology; using the existing CMS storage is the least disruptive and consistent with current system behavior.
- **Alternatives considered**: File-based storage or new storage system (rejected due to added scope and lack of UC guidance).

### Decision 3: Verification Approach
- **Decision**: Validate behavior against `UC-16-AT.md` acceptance tests.
- **Rationale**: Acceptance tests are the contract per constitution; no additional test framework is mandated.
- **Alternatives considered**: Adding a new automated testing framework (deferred; not required for planning).

### Decision 4: API Contract Style
- **Decision**: Use REST-style endpoints for schedule generation and retrieval.
- **Rationale**: Consistent with typical CMS administration flows and provides clear separation of actions and resources.
- **Alternatives considered**: GraphQL (rejected due to added complexity without UC need).
