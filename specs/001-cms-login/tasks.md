---

description: "Task list for CMS User Login implementation"
---

# Tasks: CMS User Login

**Input**: Design documents from `/specs/001-cms-login/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Acceptance tests in `UC-02-AT.md` are REQUIRED for any behavior change or new functionality. Update those before implementation tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create project directories per plan in src/, public/, data/, logs/
- [ ] T002 [P] Add starter `data/users.json` with one sample account in data/users.json
- [ ] T003 [P] Add placeholder `logs/auth.log` and ensure logs/ exists in logs/auth.log

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [ ] T004 Define UserAccount model in src/models/user-account.js
- [ ] T005 [P] Define LoginAttempt model in src/models/login-attempt.js
- [ ] T006 Implement user store for file-backed accounts in src/services/user-store.js
- [ ] T007 Implement session service (create/validate/destroy) in src/services/session-service.js
- [ ] T008 Implement auth service (email normalization, salted hash verification, user-safe errors) in src/services/auth-service.js
- [ ] T009 Implement base server wiring and routing in src/server.js
- [ ] T010 Implement auth controller skeleton in src/controllers/auth-controller.js

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Access dashboard with valid credentials (Priority: P1) 🎯 MVP

**Goal**: Allow a registered user to log in and reach the dashboard with a valid session.

**Independent Test**: Log in with a valid account and confirm dashboard access and session persistence during navigation.

### Acceptance Tests for User Story 1 (REQUIRED) ⚠️

- [ ] T011 [P] [US1] Review and update UC-02.md to reflect login edge cases and failure handling in UC-02.md
- [ ] T012 [P] [US1] Update/confirm UC-02-AT scenarios for successful login and session persistence in UC-02-AT.md
- [ ] T013 [P] [US1] Verify acceptance criteria mapping for login success in UC-02-AT.md

### Implementation for User Story 1

- [ ] T014 [P] [US1] Implement login view behavior (render form, display messages) in src/views/login-view.js
- [ ] T015 [P] [US1] Implement dashboard view behavior in src/views/dashboard-view.js
- [ ] T016 [US1] Implement login POST handler and session creation in src/controllers/auth-controller.js
- [ ] T017 [US1] Implement authenticated session check for dashboard in src/controllers/auth-controller.js
- [ ] T018 [US1] Wire login form submission to /login in public/login.html
- [ ] T019 [US1] Wire dashboard access guard in public/dashboard.html
- [ ] T020 [US1] Redirect authenticated users away from login page in src/controllers/auth-controller.js

**Checkpoint**: User Story 1 fully functional and testable independently

---

## Phase 4: User Story 2 - See clear errors for invalid credentials (Priority: P2)

**Goal**: Show user-safe errors for unknown email and incorrect password and keep user on login page.

**Independent Test**: Attempt login with unknown email and wrong password; confirm user-safe errors and no session.

### Acceptance Tests for User Story 2 (REQUIRED) ⚠️

- [ ] T021 [P] [US2] Update/confirm UC-02-AT scenarios for generic invalid-credentials messaging in UC-02-AT.md
- [ ] T022 [P] [US2] Verify acceptance criteria mapping for invalid credentials in UC-02-AT.md

### Implementation for User Story 2

- [ ] T023 [US2] Define enumeration-safe generic invalid-credentials message and update UC-02-AT.md expectations in UC-02-AT.md
- [ ] T024 [US2] Map unknown-email and wrong-password outcomes to the same invalid-credentials response in src/services/auth-service.js
- [ ] T025 [US2] Render only the provided error message in src/views/login-view.js (no validation logic in view)
- [ ] T026 [US2] Ensure login controller determines response from service outcomes in src/controllers/auth-controller.js (views only render)
- [ ] T027 [US2] Implement missing-field validation messaging in src/views/login-view.js

**Checkpoint**: User Stories 1 and 2 both work independently

---

## Phase 5: User Story 3 - Graceful handling of verification failures (Priority: P3)

**Goal**: Handle system verification errors safely without authenticating users.

**Independent Test**: Simulate a verification failure and confirm safe error message with no session.

### Acceptance Tests for User Story 3 (REQUIRED) ⚠️

- [ ] T028 [P] [US3] Update/confirm UC-02-AT scenario for system error handling in UC-02-AT.md
- [ ] T029 [P] [US3] Verify acceptance criteria mapping for verification failure in UC-02-AT.md

### Implementation for User Story 3

- [ ] T030 [US3] Add system-error handling and logging in src/services/auth-service.js
- [ ] T031 [US3] Record login attempt outcomes in src/models/login-attempt.js and src/services/auth-service.js
- [ ] T032 [US3] Log system errors and failed attempts without plaintext credentials in logs/auth.log via src/services/auth-service.js
- [ ] T033 [US3] Detect auth-service outage and return user-safe failure response in src/services/auth-service.js

**Checkpoint**: All user stories independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T034 [P] Add email normalization and whitespace trimming in src/services/auth-service.js
- [ ] T035 [P] Add repeated-failed-attempt recording (no lockout) in src/services/auth-service.js
- [ ] T036 Update quickstart notes if needed in specs/001-cms-login/quickstart.md
- [ ] T037 Validate manual acceptance steps against UC-02-AT.md and record findings in specs/001-cms-login/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories
- **User Stories (Phase 3+)**: Depend on Foundational phase completion
- **Polish (Phase 6)**: Depends on completion of all desired user stories

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2); no dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2); uses auth service and login view
- **User Story 3 (P3)**: Can start after Foundational (Phase 2); uses auth service and logging

### Parallel Opportunities

- Phase 1 tasks T002 and T003 can run in parallel
- Phase 2 tasks T004 and T005 can run in parallel
- Phase 3 tasks T012 and T013 can run in parallel
- Phase 4 tasks T021 and T022 can run in parallel
- Phase 5 tasks T028 and T029 can run in parallel
- Phase 6 tasks T034 and T035 can run in parallel

---

## Parallel Example: User Story 1

```bash
# Acceptance tests can be reviewed in parallel:
Task: "Update/confirm UC-02-AT scenarios for successful login and session persistence in UC-02-AT.md"
Task: "Verify acceptance criteria mapping for login success in UC-02-AT.md"

# View work can be split:
Task: "Implement login view behavior (render form, display messages) in src/views/login-view.js"
Task: "Implement dashboard view behavior in src/views/dashboard-view.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Stop and validate UC-02-AT login success scenarios

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Validate independently (MVP)
3. Add User Story 2 → Validate independently
4. Add User Story 3 → Validate independently
