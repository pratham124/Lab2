# Implementation Plan: Pay Conference Registration Fee Online

**Branch**: `001-uc-21` | **Date**: February 3, 2026 | **Spec**: `specs/001-uc-21/spec.md`
**Input**: Feature specification from `/specs/001-uc-21/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enable logged-in attendees to pay conference registration fees online by credit/debit card, record payments, update registration status, block re-payment when already paid, handle invalid/declined/unavailable flows, support pending confirmation with a 24-hour timeout, and ensure duplicate confirmations are idempotent. The approach aligns with UC-21 and its acceptance tests, using the existing CMS data model and vanilla web stack with MVC separation.

## Technical Context

**Language/Version**: HTML/CSS/JavaScript (vanilla)  
**Primary Dependencies**: None (vanilla stack only)  
**Storage**: Existing CMS datastore for registrations and payments (technology unspecified)  
**Testing**: Manual validation against `UC-21-AT.md` (no automated framework specified)  
**Target Platform**: Web browser for attendee-facing flows  
**Project Type**: Web  
**Performance Goals**: No explicit performance targets in spec; use existing CMS expectations  
**Constraints**: MVC separation; vanilla HTML/CSS/JS only; CMS must not store raw card data; payment gateway handles PCI responsibilities; mask/avoid logging sensitive payment details; audit events required for payment attempts/confirmations/failures; confirmation handling idempotent; payment references unique; registration status update + payment record persistence must be atomic or explicitly ordered with compensating behavior; define eventual consistency expectations if atomicity not available  
**Scale/Scope**: Conference registration flows for existing attendee base (scale unspecified)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Use-case traceability: feature maps to specific `UC-21.md`
- [x] Acceptance tests: relevant `UC-21-AT.md` identified/updated
- [x] MVC separation: model/view/controller boundaries planned
- [x] Vanilla stack: HTML/CSS/JS only; no frameworks or build-tool dependencies

**Post-Phase 1 Check**: PASS (no new violations introduced by design artifacts)

## Project Structure

### Documentation (this feature)

```text
specs/001-uc-21/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Single web app structure (MVC)
src/
├── models/
├── controllers/
├── views/
└── services/

tests/
├── integration/
└── unit/
```

**Structure Decision**: Single web app structure with explicit MVC separation for models, controllers, and views; services encapsulate payment gateway interactions.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
