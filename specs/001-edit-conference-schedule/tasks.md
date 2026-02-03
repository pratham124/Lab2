# Tasks: Edit Generated Conference Schedule

**Input**: Design documents from `/specs/001-edit-conference-schedule/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Acceptance tests in `UC-17-AT.md` are REQUIRED for any behavior change or new functionality. Update as needed before implementation tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create project folders per plan in `src/models/`, `src/controllers/`, `src/views/`, `src/services/`, `tests/`
- [ ] T002 Add baseline schedule edit view stub in `src/views/schedule_edit_view.js` (depends on T001)
- [ ] T003 Add baseline schedule edit controller stub in `src/controllers/schedule_edit_controller.js` (depends on T001)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 [P] Define Schedule and ScheduleItem models in `src/models/schedule.js`
- [ ] T005 [P] Define domain validation helpers in `src/services/schedule_validation.js`
- [ ] T006 [P] Define schedule persistence interface in `src/services/schedule_service.js`
- [ ] T007 [P] Choose `lastUpdatedAt` as the concurrency token and document its use in `src/services/concurrency.js`
- [ ] T008 [P] Define standardized error payload builder in `src/services/error_payload.js`
- [ ] T009 [P] Define authorization helpers (editor check) in `src/services/authz.js`
- [ ] T010 [P] Define timing instrumentation helper for validate+save in `src/services/perf_metrics.js`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Edit a Schedule Item (Priority: P1) 🎯 MVP

**Goal**: Editors can reassign an existing schedule item to a valid slot and save successfully with conflict and stale-edit validation.

**Independent Test**: An editor edits a schedule item, saves successfully, and sees the updated placement reflected immediately.

### Acceptance Tests for User Story 1 (REQUIRED) ⚠️

- [ ] T011 [P] [US1] Update UC-17 acceptance tests first in `UC-17-AT.md` to cover successful edit, conflict block, and stale-edit block

### Implementation for User Story 1

- [ ] T012 [US1] Implement schedule load and display flow in `src/controllers/schedule_edit_controller.js` (define controller↔view function signatures to enable parallel T013/T014)
- [ ] T013 [US1] Render editable schedule items in `src/views/schedule_edit_view.js`
- [ ] T014 [US1] Wire edit selection and reassignment UI interactions in `src/views/schedule_edit_view.js`
- [ ] T015 [US1] Validate conflicts and stale-edit prior to save in `src/services/schedule_validation.js`
- [ ] T016 [US1] Execute save with concurrency token in `src/services/schedule_service.js`
- [ ] T017 [US1] Show success message and refresh current schedule in `src/controllers/schedule_edit_controller.js`
- [ ] T018 [US1] Enforce reassign-only scope (no add/remove sessions or papers) in `src/services/schedule_validation.js`

**Checkpoint**: User Story 1 is functional and independently testable

---

## Phase 4: User Story 2 - Changes Persist Across Sessions (Priority: P2)

**Goal**: Saved edits remain visible after leaving and returning, and the next GET reflects latest state without caching delay.

**Independent Test**: After saving, a new load of `/schedule/current` shows the updated placement.

### Acceptance Tests for User Story 2 (REQUIRED) ⚠️

- [ ] T019 [P] [US2] Update persistence and immediate-visibility coverage first in `UC-17-AT.md`

### Implementation for User Story 2

- [ ] T020 [US2] Ensure post-save reload uses latest persisted state in `src/controllers/schedule_edit_controller.js`
- [ ] T021 [US2] Implement no-cache schedule fetch and reflect latest state in `src/services/schedule_service.js`
- [ ] T022 [US2] Verify persistence across sessions by reloading schedule after logout/login in `src/controllers/schedule_edit_controller.js`

**Checkpoint**: User Story 2 is independently testable and stable across sessions

---

## Phase 5: User Story 3 - Safe Handling of Errors and Invalid Targets (Priority: P3)

**Goal**: Save failures, missing items, unauthorized users, and double-submit behavior are handled safely with clear messages.

**Independent Test**: Simulate save failure, missing item, unauthorized user, and rapid double-submit; observe correct blocking and messaging with no partial updates.

### Acceptance Tests for User Story 3 (REQUIRED) ⚠️

- [ ] T023 [P] [US3] Update error handling and authorization coverage first in `UC-17-AT.md`

### Implementation for User Story 3

- [ ] T024 [US3] Enforce editor-only access in `src/controllers/schedule_edit_controller.js`
- [ ] T025 [US3] Hide/disable edit controls for non-editors in `src/views/schedule_edit_view.js`
- [ ] T026 [US3] Handle save failure atomically with `SAVE_FAILED` payload in `src/services/schedule_service.js`
- [ ] T027 [US3] Handle missing-item edit attempts in `src/controllers/schedule_edit_controller.js`
- [ ] T028 [US3] Implement idempotent double-submit handling in `src/services/schedule_service.js` (depends on T007 and save semantics in T016/T026)
- [ ] T029 [US3] Render standardized error payload fields in `src/views/schedule_edit_view.js` (align error behavior with spec; no DUPLICATE_SUBMIT)

**Checkpoint**: User Story 3 is independently testable and complete

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T030 [P] Update quickstart verification steps in `specs/001-edit-conference-schedule/quickstart.md`
- [ ] T031 Measure and report p95 validate+save timing for ~1,000 items in `specs/001-edit-conference-schedule/quickstart.md`
- [ ] T032 Verify acceptance criteria against implementation in `UC-17-AT.md`
- [ ] T033 Run quickstart validation steps and capture findings in `specs/001-edit-conference-schedule/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Depends on US1 data flow
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Independent but validates error paths across US1/US2

### Within Each User Story

- Acceptance tests updated before implementation
- Models before services
- Services before controllers/views
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- Acceptance test updates for a user story marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Update acceptance tests for User Story 1 first:
Task: "Review/update UC-17 acceptance tests"

# Launch view/controller work in parallel:
Task: "Render editable schedule items in src/views/schedule_edit_view.js"
Task: "Implement schedule load and display flow in src/controllers/schedule_edit_controller.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify acceptance criteria are defined before implementing
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
