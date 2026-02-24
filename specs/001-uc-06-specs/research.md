# Phase 0 Research: Save Submission Draft

## Decision: Use existing CMS persistence for drafts
- **Rationale**: Drafts are an extension of submission state; reusing the current storage avoids introducing new systems while satisfying UC-06.
- **Alternatives considered**: Separate draft store; client-side storage only.

## Decision: Vanilla web stack only (no external dependencies)
- **Rationale**: Required by the project constitution; keeps implementation simple and consistent with existing CMS constraints.
- **Alternatives considered**: UI frameworks or build tools.

## Decision: Manual acceptance tests as primary validation
- **Rationale**: Acceptance tests are documented in UC-06-AT and can be executed end-to-end without adding a test framework.
- **Alternatives considered**: Introducing a test runner or UI automation.

## Decision: Concurrency policy deferred for this feature
- **Rationale**: The user explicitly deferred concurrent-save conflict handling to planning/implementation; core requirements do not depend on a specific policy.
- **Alternatives considered**: Last-write-wins; reject second save; auto-merge.
