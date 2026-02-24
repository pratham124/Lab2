---

description: "Task list template for feature implementation"
---

# Tasks: Change Account Password

**Input**: Design documents from `/specs/001-change-password/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Acceptance tests in `UC-03-AT.md` are REQUIRED for any behavior change or new functionality. Update before implementation tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Confirm MVC folders exist in `src/models/`, `src/controllers/`, `src/views/`, `src/services/`
- [X] T002 Confirm acceptance test source is `UC-03-AT.md` and referenced in plan/spec

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [X] T003 Review existing account settings view and route entry points in `src/views/` and `src/controllers/`
- [X] T004 Review existing user account model/service access points in `src/models/` and `src/services/`
- [X] T005 Define shared validation utilities for password policy in `src/services/password_policy.js`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Change Password Successfully (Priority: P1) 🎯 MVP

**Goal**: Logged-in users can change their password with valid inputs and receive confirmation

**Independent Test**: A logged-in user submits correct current password and valid new password, sees success, and remains logged in

### Acceptance Tests for User Story 1 (REQUIRED) ⚠️

- [X] T006 [P] [US1] Update `UC-03.md` to reflect User Story 1 behavior changes
- [X] T007 [P] [US1] Update `UC-03-AT.md` with acceptance criteria for successful password change and continued session
- [X] T008 [P] [US1] Define manual validation approach for SC-001 in `UC-03-AT.md`

### Implementation for User Story 1

- [X] T009 [US1] Add change-password form view in `src/views/account_settings.html`
- [X] T010 [US1] Ensure no confirmation field is present in `src/views/account_settings.html`
- [X] T011 [US1] Add controller action for change-password submit in `src/controllers/account_controller.js`
- [X] T012 [US1] Implement password change service call in `src/services/account_service.js`
- [X] T013 [US1] Enforce policy validation using `src/services/password_policy.js`
- [X] T014 [US1] Ensure change applies to authenticated user context (no userId from request) in `src/controllers/account_controller.js`
- [X] T015 [US1] Ensure success does not alter sessions in `src/services/account_service.js`
- [X] T016 [US1] Add success confirmation message handling in `src/views/account_settings.html`

**Checkpoint**: User Story 1 functional and independently testable

---

## Phase 4: User Story 2 - Correct Invalid Password Inputs (Priority: P2)

**Goal**: Users receive inline errors for incorrect current password or policy failures and can retry without lockout

**Independent Test**: Invalid inputs show inline errors; no lockout is triggered; no password change occurs

### Acceptance Tests for User Story 2 (REQUIRED) ⚠️

- [X] T017 [P] [US2] Update `UC-03.md` to reflect User Story 2 behavior changes
- [X] T018 [P] [US2] Update `UC-03-AT.md` with acceptance criteria for invalid current password and policy failure
- [X] T019 [P] [US2] Define manual validation approach for SC-002 in `UC-03-AT.md`
- [X] T020 [P] [US2] Add acceptance criteria for “new password equals current password” in `UC-03-AT.md`

### Implementation for User Story 2

- [X] T021 [US2] Add incorrect-current-password error handling in `src/controllers/account_controller.js`
- [X] T022 [US2] Add policy failure error handling in `src/controllers/account_controller.js`
- [X] T023 [US2] Add “new password equals current password” handling in `src/controllers/account_controller.js`
- [X] T024 [US2] Render inline-only validation errors in `src/views/account_settings.html`
- [X] T025 [US2] Document no lockout behavior in `src/controllers/account_controller.js`

**Checkpoint**: User Story 2 functional and independently testable

---

## Phase 5: User Story 3 - Handle Update Failures Gracefully (Priority: P3)

**Goal**: Users see a failure message when a system error prevents password update

**Independent Test**: Simulated update failure returns a clear failure message and leaves password unchanged

### Acceptance Tests for User Story 3 (REQUIRED) ⚠️

- [X] T026 [P] [US3] Update `UC-03.md` to reflect User Story 3 behavior changes
- [X] T027 [P] [US3] Update `UC-03-AT.md` with acceptance criteria for system error during password update

### Implementation for User Story 3

- [X] T028 [US3] Handle update failure response in `src/controllers/account_controller.js`
- [X] T029 [US3] Render failure message in `src/views/account_settings.html`

**Checkpoint**: User Story 3 functional and independently testable

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T030 [P] Ensure quickstart steps match implementation in `/root/493-lab/Lab2/specs/001-change-password/quickstart.md`
- [X] T031 [P] Review consistency with spec requirements in `/root/493-lab/Lab2/specs/001-change-password/spec.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: Depend on Foundational phase completion
- **Polish (Phase 6)**: Depends on user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2)
- **User Story 2 (P2)**: Can start after Foundational (Phase 2)
- **User Story 3 (P3)**: Can start after Foundational (Phase 2)

### Parallel Opportunities

- T001 and T002 can run in parallel
- T003 and T004 can run in parallel
- T009 and T016 can run in parallel
- T021 and T022 can run in parallel

---

## Parallel Example: User Story 1

```bash
# Update acceptance tests for User Story 1 first:
Task: "Update UC-03-AT.md with acceptance criteria for successful password change"

# Parallel view-related tasks:
Task: "Add change-password form view in src/views/account_settings.html"
Task: "Add success confirmation message handling in src/views/account_settings.html"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently
3. Add User Story 2 → Test independently
4. Add User Story 3 → Test independently

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
