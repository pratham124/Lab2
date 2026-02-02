# Implementation Plan: Assign Reviewers to Papers

**Branch**: `001-uc-08-docs` | **Date**: February 2, 2026 | **Spec**: /root/493-lab/Lab2/specs/001-uc-08-docs/spec.md
**Input**: Feature specification from `/root/493-lab/Lab2/specs/001-uc-08-docs/spec.md`

## Summary

Implement reviewer assignment for submitted papers per UC-08, including reviewer selection, rule validation (exactly three reviewers, workload limits), persistence of assignments, and post-assignment invitation attempts that do not affect assignment success. The plan follows the CMS constitution (MVC separation, vanilla web stack) and acceptance tests in UC-08-AT as the contract.

## Technical Context

**Language/Version**: Vanilla HTML/CSS/JavaScript (no framework)  
**Primary Dependencies**: None (standard browser/runtime only)  
**Storage**: N/A (not specified; align with existing CMS data layer when implemented)  
**Testing**: Manual execution of UC-08-AT acceptance tests  
**Target Platform**: Web application (browser-based CMS)  
**Project Type**: Web  
**Performance Goals**: No explicit targets beyond standard responsiveness  
**Constraints**: MVC separation; vanilla web stack only; acceptance tests are the contract  
**Scale/Scope**: Single feature flow for reviewer assignment

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Use-case traceability: feature maps to UC-08
- [x] Acceptance tests: UC-08-AT identified
- [x] MVC separation: model/view/controller boundaries planned
- [x] Vanilla stack: HTML/CSS/JS only; no frameworks or build-tool dependencies

## Project Structure

### Documentation (this feature)

```text
specs/001-uc-08-docs/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Single project (MVC web app)
src/
├── models/
├── controllers/
├── views/
└── services/

tests/
├── acceptance/
└── integration/
```

**Structure Decision**: Single MVC web app layout. If the repo already contains a different structure, align with that structure instead of creating new roots.

## Phase 0: Outline & Research

No open technical unknowns remain after clarifications; research documents decisions and rationale for feature behavior and constraints.

### Output

- /root/493-lab/Lab2/specs/001-uc-08-docs/research.md

## Phase 1: Design & Contracts

### Data Model

- Entities: Paper, Reviewer, Assignment, Invitation
- Validation: exactly three reviewers per paper; reviewer workload <= 5
- State transitions: Paper assignment status; Invitation delivery state

### Contracts

- Define REST endpoints for listing eligible reviewers, assigning reviewers, and viewing assignments
- Include error responses for rule violations and notification failures (assignment remains valid)

### Quickstart

- Describe how to run the acceptance test scenarios from UC-08-AT manually

### Agent Context Update

- Run `/root/493-lab/Lab2/.specify/scripts/bash/update-agent-context.sh codex`

## Post-Design Constitution Check

- [x] Use-case traceability preserved (UC-08 mapped)
- [x] Acceptance tests remain contract (UC-08-AT)
- [x] MVC separation maintained in planned structure
- [x] Vanilla stack constraints preserved

## Phase 2: Planning Stop

Planning ends after Phase 1 outputs are generated. Use `/speckit.tasks` to produce tasks.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
