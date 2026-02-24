<!--
Sync Impact Report:
- Version change: N/A (template) → 1.0.0
- Modified principles: N/A (template placeholders) → I. Use-Case Traceability (NON-NEGOTIABLE); II. Acceptance Tests as Contract; III. MVC Separation; IV. Vanilla Web Stack Only; V. Simplicity & Clarity
- Added sections: Project Constraints; Development Workflow & Quality Gates
- Removed sections: None (template placeholders replaced)
- Templates requiring updates:
  - ✅ updated: .specify/templates/plan-template.md
  - ✅ updated: .specify/templates/spec-template.md
  - ✅ updated: .specify/templates/tasks-template.md
  - ✅ updated: .specify/templates/checklist-template.md
  - ⚠ pending: .specify/templates/commands/*.md (directory not present)
- Follow-up TODOs: None
-->
# Lab2 CMS Constitution

## Core Principles

### I. Use-Case Traceability (NON-NEGOTIABLE)
Every feature or change MUST map to a specific use case file `UC-XX.md`. If a new
use case is introduced, a new `UC-XX.md` MUST be added and referenced in specs,
plans, and tasks. No implementation is accepted without explicit use-case linkage.

### II. Acceptance Tests as Contract
Acceptance tests are the source of truth and live in `UC-XX-AT.md` files paired
with their use cases. Updates to behavior MUST update the corresponding
acceptance test document before or alongside implementation, and a feature is
only complete when its acceptance criteria are demonstrably satisfied.

### III. MVC Separation
The CMS MUST follow MVC architecture. Models encapsulate data and domain rules,
controllers coordinate user interactions and application flow, and views render
presentation only. Business logic in views is prohibited.

### IV. Vanilla Web Stack Only
Implementation MUST use vanilla HTML, CSS, and JavaScript. Frameworks, UI
libraries, and build-tool-dependent abstractions are not allowed unless the
constitution is amended to permit them.

### V. Simplicity & Clarity
Prefer the simplest structure that satisfies the use case and acceptance tests.
Avoid unnecessary abstractions or premature generalization; clarity and
readability take precedence over cleverness.

## Project Constraints

- Use cases are stored in `UC-XX.md` and acceptance tests in `UC-XX-AT.md`.
- Any new use case MUST follow the next sequential `UC-XX` identifier and include
  a matching acceptance test file.
- All project documentation (specs, plans, tasks) MUST reference the relevant
  `UC-XX` identifiers for traceability.

## Development Workflow & Quality Gates

- Every plan and spec MUST include a constitution check validating: use-case
  traceability, acceptance test coverage, MVC separation, and vanilla stack
  compliance.
- Tasks MUST include explicit steps to update/add `UC-XX.md` and `UC-XX-AT.md`
  when behavior changes or new functionality is introduced.
- Reviews MUST verify that acceptance tests reflect the intended behavior and
  that implementation aligns with the mapped use cases.

## Governance

- This constitution supersedes all other project guidance.
- Amendments require documentation of the rationale, scope, and migration plan
  (if behavior changes or breaking constraints are introduced).
- Semantic versioning applies: MAJOR for breaking governance changes, MINOR for
  new/expanded principles or sections, PATCH for clarifications and wording.
- Compliance is reviewed during planning and before acceptance of changes.

**Version**: 1.0.0 | **Ratified**: 2026-01-31 | **Last Amended**: 2026-01-31
