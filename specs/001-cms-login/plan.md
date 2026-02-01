# Implementation Plan: CMS User Login

**Branch**: `001-cms-login` | **Date**: February 1, 2026 | **Spec**: /root/493-lab/Lab2/specs/001-cms-login/spec.md
**Input**: Feature specification from `/specs/001-cms-login/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enable registered users to log in with email/password, receive user-safe error feedback, and access the dashboard only when authenticated. Implement a vanilla HTML/CSS/JS MVC flow with a lightweight server-side authentication controller, file-backed user store, and session handling aligned to UC-02 and UC-02-AT, including missing-field validation, repeated-attempt recording (no lockout), and authentication-service outage handling.

## Technical Context

**Language/Version**: HTML5, CSS3, JavaScript (ES2022); Node.js LTS runtime (no frameworks)  
**Primary Dependencies**: None (built-in runtime modules only)  
**Storage**: File-based user store (`data/users.json`) and in-memory session store  
**Testing**: Manual acceptance tests per `UC-02-AT.md`  
**Target Platform**: Modern desktop browsers; local Node.js runtime  
**Project Type**: Web  
**Performance Goals**: 95% of valid logins reach dashboard within 30 seconds; validation feedback is immediate (<1s perceived)  
**Constraints**: Vanilla HTML/CSS/JS only; MVC separation; no external frameworks or build tools; no plaintext credential storage/transmission/logging  
**Scale/Scope**: Single CMS login flow and dashboard access gate for a small user set (<1k accounts)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Use-case traceability: feature maps to specific `UC-02.md`
- [x] Acceptance tests: relevant `UC-02-AT.md` identified/updated
- [x] MVC separation: model/view/controller boundaries planned
- [x] Vanilla stack: HTML/CSS/JS only; no frameworks or build-tool dependencies

## Project Structure

### Documentation (this feature)

```text
specs/001-cms-login/
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
├── controllers/
│   └── auth-controller.js
├── models/
│   ├── user-account.js
│   └── login-attempt.js
├── services/
│   ├── auth-service.js
│   ├── session-service.js
│   └── user-store.js
├── views/
│   ├── login-view.js
│   └── dashboard-view.js
└── server.js

data/
└── users.json

public/
├── login.html
├── dashboard.html
└── assets/

logs/
└── auth.log

tests/
└── acceptance/
    └── UC-02-AT.md
```

**Structure Decision**: Single web project with a lightweight server plus browser views. MVC separation is explicit via `models/`, `controllers/`, and `views/`, with `services/` for storage/session concerns. Acceptance tests are referenced at repository root as `UC-02-AT.md` per constitution; any copies in `tests/acceptance/` are optional documentation only.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|

## Phase 0: Outline & Research

- Confirmed constraints: vanilla HTML/CSS/JS only; MVC separation required; no plaintext credential handling.
- Resolved technical decisions in `research.md` (data store, sessions, password hashing/salting, logging, input normalization, user-safe error messaging, failed-attempt recording).

## Phase 1: Design & Contracts

- Defined data entities and validation rules in `data-model.md`.
- Auth and session endpoints documented in `contracts/login.yaml`.
- Quickstart instructions captured in `quickstart.md` (references UC-02-AT.md).
- Agent context updated via `.specify/scripts/bash/update-agent-context.sh codex`.

## Constitution Check (Post-Design)

- [x] Use-case traceability: UC-02 referenced throughout plan artifacts
- [x] Acceptance tests: UC-02-AT drives scenarios and contracts
- [x] MVC separation: data-model + controllers/views/services delineated
- [x] Vanilla stack: no frameworks or build tools introduced

## Phase 2: Implementation Plan (High-Level)

1. Add file-backed user store (`data/users.json`) and model for user accounts.
2. Implement authentication service (email normalization, password verification with salted hashing, user-safe error paths, no plaintext handling).
3. Implement session service (create, validate, destroy session) and guard dashboard access.
4. Build login view and controller flow (form validation, missing-field errors, error messages, redirect logic).
5. Add dashboard access gate and redirect logic for authenticated vs unauthenticated users.
6. Record login attempt outcomes and system errors to `logs/auth.log` without logging plaintext credentials.
7. Validate behavior against `UC-02-AT.md` scenarios, including missing fields, repeated failed attempts, and auth-service outage handling.
