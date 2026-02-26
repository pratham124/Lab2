# Implementation Plan: Edit Generated Conference Schedule

**Branch**: `001-edit-conference-schedule` | **Date**: February 3, 2026 | **Spec**: `specs/001-edit-conference-schedule/spec.md`
**Input**: Feature specification from `/specs/001-edit-conference-schedule/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enable editors to reassign existing schedule items with conflict validation, optimistic concurrency (stale-save rejection), editor-only access, standardized error payloads, atomic saves, idempotent double-submit handling, and measurable responsiveness aligned to p95 ≤ 5s for ~1,000 items.

## Technical Context

**Language/Version**: JavaScript (ES6) + HTML/CSS (vanilla)  
**Primary Dependencies**: None (vanilla stack only)  
**Storage**: Existing CMS schedule persistence (current schedule as source of truth)  
**Testing**: Manual acceptance testing per `UC-17-AT.md` plus timing instrumentation checks  
**Target Platform**: Web browsers (desktop-first, responsive)  
**Project Type**: Web  
**Performance Goals**: Validation + save p95 ≤ 5 seconds for schedules of ~1,000 items  
**Constraints**: MVC separation; no frameworks or build tools; optimistic concurrency via `lastUpdatedAt`; server-side editor enforcement; hide/disable edit UI for non-editors; standardized error payload fields (`CONFLICT`, `STALE_EDIT`, `SAVE_FAILED`); atomic save semantics; idempotent identical double-submits; immediate visibility means next GET reads latest persisted state  
**Scale/Scope**: Single-conference schedule; up to ~1,000 schedule items; low-frequency edits

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Use-case traceability: feature maps to specific `UC-17.md`
- [x] Acceptance tests: relevant `UC-17-AT.md` identified/updated
- [x] MVC separation: model/view/controller boundaries planned
- [x] Vanilla stack: HTML/CSS/JS only; no frameworks or build-tool dependencies

## Project Structure

### Documentation (this feature)

```text
specs/001-edit-conference-schedule/
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

tests/
├── contract/
├── integration/
└── unit/
```

**Structure Decision**: Single web project with MVC separation under `src/`, plus `tests/` for contract/integration/unit coverage.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |

## Phase 0: Outline & Research

### Research Tasks

- Confirm optimistic concurrency approach using `lastUpdatedAt` and how it is surfaced to the client.
- Define the standard error payload fields and ensure they map to spec-required message elements.
- Validate editor-only enforcement patterns: server-side authorization + UI disable/hide for non-editors.
- Define atomic save failure handling and required `SAVE_FAILED` error details.
- Define idempotent handling for identical rapid save submissions.
- Define basic timing instrumentation approach to measure validate+save p95 ≤ 5s for ~1,000 items.
- Clarify that immediate visibility means the next GET reads the latest persisted schedule state.

### Findings (see `research.md`)

- Concurrency: Capture `lastUpdatedAt` at load; reject save if the timestamp has changed and prompt refresh.
- Error payload: Standardize error responses with `errorCode`, `summary`, `affectedItemId`, optional `conflicts[]`, `recommendedAction`.
- Permissions: Enforce editor-only edits on the server; additionally hide/disable edit UI for non-editors.
- Atomicity: Treat save as all-or-nothing; on failure return `SAVE_FAILED` with a retry/refresh action.
- Idempotency: Treat identical rapid saves as idempotent and return the same final state without duplicates.
- Performance: Add lightweight timing instrumentation around validation+save flow to track p95 latency against the 5s target.
- Visibility: Immediate means the next GET `/schedule/current` reflects the latest persisted state without caching delay.

## Phase 1: Design & Contracts

### Data Model

- Defined in `specs/001-edit-conference-schedule/data-model.md` (includes `Schedule.version` and conflict rules).

### API Contracts

- Defined in `specs/001-edit-conference-schedule/contracts/openapi.yaml` (includes `scheduleVersion` in update payload and standardized error schema).

### Quickstart

- Defined in `specs/001-edit-conference-schedule/quickstart.md` (includes stale-edit and unauthorized scenarios).

### Agent Context Update

- Ran `/root/493-lab/Lab2/.specify/scripts/bash/update-agent-context.sh codex`.

## Constitution Check (Post-Design)

- [x] Use-case traceability preserved (UC-17).
- [x] Acceptance tests remain source of truth (UC-17-AT).
- [x] MVC separation enforced in planned structure.
- [x] Vanilla stack compliance maintained.
