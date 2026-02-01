# Implementation Plan: Change Account Password

**Branch**: `001-change-password` | **Date**: 2026-02-01 | **Spec**: `/root/493-lab/Lab2/specs/001-change-password/spec.md`
**Input**: Feature specification from `/specs/001-change-password/spec.md`

## Summary

Enable logged-in users to change their password from account settings with clear inline validation errors, no lockout on repeated failures, and no session changes. Implement within the CMS MVC structure using vanilla HTML/CSS/JS, aligned to UC-03 and the canonical acceptance test document UC-03-AT.md. The password change request operates on the currently authenticated user and does not require a userId in the request body.

## Technical Context

**Language/Version**: HTML5, CSS3, JavaScript (ES6+)  
**Primary Dependencies**: None (vanilla web stack only)  
**Storage**: Existing CMS user account data store (implementation unchanged)  
**Testing**: Acceptance tests are defined exclusively in UC-03-AT.md (canonical); no alternative acceptance test naming or locations  
**Target Platform**: Web browser + CMS server  
**Project Type**: Web  
**Performance Goals**: 95% of successful changes complete within 2 minutes (SC-001)  
**Constraints**: MVC separation (views render presentation only; validation and business logic live in controllers/services); vanilla HTML/CSS/JS only; keep all sessions active after change; no lockout or rate-based blocking for repeated incorrect current-password attempts  
**Scale/Scope**: Single CMS instance; typical conference user volume (not explicitly specified)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Use-case traceability: feature maps to specific `UC-03.md`
- [x] Acceptance tests: canonical document is `UC-03-AT.md` (no alternative naming)
- [x] MVC separation: views render presentation only; validation/business logic in controllers/services
- [x] Vanilla stack: HTML/CSS/JS only; no frameworks or build-tool dependencies

## Project Structure

### Documentation (this feature)

```text
specs/001-change-password/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── models/
├── controllers/
├── views/
└── services/
```

**Structure Decision**: Web MVC layout with models/controllers/views in `src/`. Acceptance tests are defined only in `UC-03-AT.md` and referenced from documentation; no alternative acceptance test filenames or folders.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Phase 0: Outline & Research

### Research Tasks

No open research items. Technical decisions follow the CMS constitution (MVC + vanilla stack) and the feature spec clarifications.

### Output: `research.md`

- Documented the stack constraints, canonical acceptance test source, session behavior, and contract approach derived from the constitution and spec.

## Phase 1: Design & Contracts

### Data Model

- Extracted entities and validation rules into `data-model.md` with explicit session and request context.

### API Contracts

- Defined REST-style contract for password change in `/contracts/openapi.yaml` using the authenticated user context (no userId in request).

### Quickstart

- Added `quickstart.md` with manual validation steps tied to UC-03-AT.md.

### Agent Context Update

- Run `.specify/scripts/bash/update-agent-context.sh codex` to sync plan context.

## Constitution Check (Post-Design)

- [x] Use-case traceability: UC-03 referenced in spec and plan
- [x] Acceptance tests: canonical UC-03-AT.md referenced (no alternative names)
- [x] MVC separation: views render presentation only; validation/business logic in controllers/services
- [x] Vanilla stack: no frameworks or build tools introduced
