---

description: "Task list for Assign Reviewers to Papers"
---

# Tasks: Assign Reviewers to Papers

**Input**: Design documents from `/root/493-lab/Lab2/specs/001-uc-08-docs/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Acceptance tests in `UC-08-AT.md` are REQUIRED for any behavior change or new functionality. Update them before implementation if needed.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic MVC structure

- [ ] T001 Create MVC directories per plan in `src/models/`, `src/controllers/`, `src/views/`, `src/services/`
- [ ] T002 [P] Create acceptance test workspace in `tests/acceptance/README.md`
- [ ] T003 [P] Create integration test workspace in `tests/integration/README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [ ] T004 Define shared error messaging conventions in `src/services/validation_errors.js`
- [ ] T005 [P] Add base data access stubs for papers/reviewers/assignments in `src/services/data_access.js`
- [ ] T006 [P] Add notification service stub in `src/services/notification_service.js`
- [ ] T007 Add shared controller helpers in `src/controllers/controller_utils.js`
- [ ] T032 Update use case and acceptance tests when behavior changes in `UC-08.md` and `UC-08-AT.md`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Assign Required Reviewers (Priority: P1) 🎯 MVP

**Goal**: Enable editors to assign exactly three reviewers and persist assignments successfully.

**Independent Test**: Execute AT-UC08-01 in `UC-08-AT.md` and confirm assignments are saved and success is shown.

### Acceptance Tests for User Story 1 (REQUIRED) ⚠️

- [ ] T008 [P] [US1] Review and update AT-UC08-01 in `UC-08-AT.md` to reflect current requirements
- [ ] T009 [P] [US1] Cross-check AT-UC08-01 against spec in `specs/001-uc-08-docs/spec.md`

### Implementation for User Story 1

- [ ] T010 [P] [US1] Create Paper model in `src/models/paper.js`
- [ ] T011 [P] [US1] Create Reviewer model in `src/models/reviewer.js`
- [ ] T012 [P] [US1] Create Assignment model in `src/models/assignment.js`
- [ ] T013 [US1] Implement assignment validation in `src/services/assignment_service.js`
- [ ] T014 [US1] Implement assignment persistence in `src/services/assignment_service.js` (depends on T013)
- [ ] T015 [US1] Implement controller action for assignment submission in `src/controllers/assignment_controller.js` (depends on T013–T014)
- [ ] T016 [US1] Add assignment view for reviewer selection in `src/views/assign_reviewers.html`
- [ ] T017 [US1] Wire controller to view in `src/controllers/assignment_controller.js` (depends on T016)

**Checkpoint**: User Story 1 functional and independently testable

---

## Phase 4: User Story 2 - Enforce Reviewer Count Rules (Priority: P2)

**Goal**: Prevent assignments with fewer or more than three reviewers with clear errors.

**Independent Test**: Execute AT-UC08-02 and AT-UC08-03 in `UC-08-AT.md` and confirm invalid counts are blocked.

### Acceptance Tests for User Story 2 (REQUIRED) ⚠️

- [ ] T018 [P] [US2] Review and update AT-UC08-02/AT-UC08-03 in `UC-08-AT.md`
- [ ] T019 [P] [US2] Cross-check count-rule error wording against `specs/001-uc-08-docs/spec.md`

### Implementation for User Story 2

- [ ] T020 [US2] Enforce reviewer count validation in `src/services/assignment_service.js`
- [ ] T021 [US2] Surface count-rule errors in `src/controllers/assignment_controller.js`
- [ ] T022 [US2] Display count-rule error messaging in `src/views/assign_reviewers.html`

**Checkpoint**: User Story 2 functional and independently testable

---

## Phase 5: User Story 3 - Enforce Reviewer Workload Limits (Priority: P3)

**Goal**: Block assignments that exceed reviewer workload limits with clear errors.

**Independent Test**: Execute AT-UC08-04 and AT-UC08-05 in `UC-08-AT.md` and confirm workload rules are enforced.

### Acceptance Tests for User Story 3 (REQUIRED) ⚠️

- [ ] T023 [P] [US3] Review and update AT-UC08-04/AT-UC08-05 in `UC-08-AT.md`
- [ ] T024 [P] [US3] Cross-check workload rule text against `specs/001-uc-08-docs/spec.md`

### Implementation for User Story 3

- [ ] T025 [US3] Enforce workload limit validation in `src/services/assignment_service.js`
- [ ] T026 [US3] Surface workload errors in `src/controllers/assignment_controller.js`
- [ ] T027 [US3] Display workload error messaging in `src/views/assign_reviewers.html`

**Checkpoint**: User Story 3 functional and independently testable

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cross-cutting requirements and documentation validation

- [ ] T028 [P] Align notification failure behavior with spec in `src/services/notification_service.js`
- [ ] T029 Update controller to keep assignments on notification failure in `src/controllers/assignment_controller.js`
- [ ] T030 [P] Update quickstart references if needed in `specs/001-uc-08-docs/quickstart.md`
- [ ] T031 [P] Verify contracts align with requirements in `specs/001-uc-08-docs/contracts/reviewer-assignment.openapi.yaml`
- [ ] T033 Implement and document invitation failure logging and editor warning (FR-006a) in `src/services/notification_service.js` and `specs/001-uc-08-docs/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - no dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational - depends on shared assignment flow from US1
- **User Story 3 (P3)**: Can start after Foundational - depends on shared assignment flow from US1

### Parallel Opportunities

- T002 and T003 can run in parallel during Setup
- T005 and T006 can run in parallel during Foundational
- T010, T011, and T012 can run in parallel during US1
- Acceptance test review tasks (T008, T018, T023) can run in parallel per story

---

## Parallel Example: User Story 1

```bash
Task: "Create Paper model in src/models/paper.js"
Task: "Create Reviewer model in src/models/reviewer.js"
Task: "Create Assignment model in src/models/assignment.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate AT-UC08-01 against expected outcomes

### Incremental Delivery

1. Setup + Foundational
2. User Story 1 → validate AT-UC08-01
3. User Story 2 → validate AT-UC08-02/AT-UC08-03
4. User Story 3 → validate AT-UC08-04/AT-UC08-05
5. Polish and cross-cutting alignment
