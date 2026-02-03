---

description: "Task list for UC-14 View Completed Reviews for a Paper"
---

# Tasks: View Completed Reviews for a Paper

**Input**: Design documents from `/specs/001-uc-14/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Acceptance tests in `UC-14-AT.md` are REQUIRED for any behavior change
or new functionality. Include tasks to add/update those files before
implementation tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create MVC folders per plan in `src/models/`, `src/controllers/`, `src/views/`, `src/assets/`
- [ ] T002 [P] Add placeholder README for feature wiring notes in `src/README.md`
- [ ] T002a [P] Create routing file in `src/controllers/routes.js`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Define shared error response shape in `src/controllers/error_response.js`
- [ ] T004 [P] Add access-control helper for assigned editor checks in `src/controllers/authz.js`
- [ ] T005 [P] Add review retrieval service stub in `src/controllers/review_service.js`
- [ ] T006 [P] Add failure recording helper for admin review in `src/controllers/error_log.js`
- [ ] T006a [P] Define access to active review form schema in `src/models/review_form_schema.js`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View completed reviews for a paper (Priority: P1) 🎯 MVP

**Goal**: Allow the assigned editor to view all completed reviews for a selected paper with reviewer identities visible.

**Independent Test**: Selecting a managed paper shows all submitted reviews once, with reviewer identities, and excludes pending reviews.

### Acceptance Tests for User Story 1 (REQUIRED) ⚠️

- [ ] T007 [P] [US1] Review and, if needed, update `UC-14-AT.md` to cover completed-review visibility rules
- [ ] T008 [P] [US1] Review and, if needed, update `UC-14.md` for clarified behavior in `UC-14.md`
- [ ] T009 [P] [US1] Verify UC-14-AT scenarios map to FR-001 through FR-003 in `specs/001-uc-14/spec.md`

### Implementation for User Story 1

- [ ] T010 [P] [US1] Add Paper model accessor for assigned editor id in `src/models/paper.js`
- [ ] T011 [P] [US1] Add Review model accessor for submitted reviews in `src/models/review.js`
- [ ] T012 [US1] Implement controller to fetch completed reviews in `src/controllers/completed_reviews_controller.js`
- [ ] T013 [US1] Render completed reviews list view in `src/views/completed_reviews_view.js`
- [ ] T014 [US1] Render reviewer identity fields in `src/views/completed_reviews_view.js`
- [ ] T015 [US1] Reference active review form schema when rendering review content in `src/views/completed_reviews_view.js`
- [ ] T016 [US1] Wire route for viewing completed reviews in `src/controllers/routes.js`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - See an empty state when no completed reviews exist (Priority: P2)

**Goal**: Provide a clear empty-state message when no completed reviews are available.

**Independent Test**: Selecting a managed paper with zero submitted reviews shows a clear empty-state message.

### Acceptance Tests for User Story 2 (REQUIRED) ⚠️

- [ ] T017 [P] [US2] Review and, if needed, update `UC-14-AT.md` for zero completed reviews messaging
- [ ] T018 [P] [US2] Verify UC-14-AT scenarios map to FR-004 in `specs/001-uc-14/spec.md`

### Implementation for User Story 2

- [ ] T019 [US2] Add empty-state rendering branch in `src/views/completed_reviews_view.js`
- [ ] T020 [US2] Add controller handling for zero completed reviews in `src/controllers/completed_reviews_controller.js`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Handle access and retrieval failures safely (Priority: P3)

**Goal**: Enforce assigned-editor access control and provide safe, user-friendly error handling with no partial content.

**Independent Test**: Unauthorized access is blocked; retrieval errors show required error message and no review content.

### Acceptance Tests for User Story 3 (REQUIRED) ⚠️

- [ ] T021 [P] [US3] Review and, if needed, update `UC-14-AT.md` for access denial and retrieval error handling
- [ ] T022 [P] [US3] Verify UC-14-AT scenarios map to FR-005 through FR-011 in `specs/001-uc-14/spec.md`
- [ ] T023 [P] [US3] Add acceptance criteria note for SC-001 load time in `UC-14-AT.md`

### Implementation for User Story 3

- [ ] T024 [US3] Enforce assigned-editor check in `src/controllers/completed_reviews_controller.js`
- [ ] T025 [US3] Return ErrorResponse on access denial in `src/controllers/completed_reviews_controller.js`
- [ ] T026 [US3] Return ErrorResponse on retrieval failure without partial content in `src/controllers/completed_reviews_controller.js`
- [ ] T027 [US3] Record retrieval failure for admin review in `src/controllers/completed_reviews_controller.js`
- [ ] T028 [US3] Render user-friendly error message with next step and return link in `src/views/completed_reviews_view.js`

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T029 [P] Update feature documentation links in `specs/001-uc-14/quickstart.md`
- [ ] T030 Run quickstart validation steps in `specs/001-uc-14/quickstart.md`

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
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Depends on US1 view wiring
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Depends on US1 controller routing

### Within Each User Story

- Acceptance tests review/update before implementation
- Models before controllers
- Controllers before views
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T002, T004, T005, T006, T007, T008, T009, T017, T018, T021, T022, T023 can run in parallel
- T010 and T011 can run in parallel
- User Story 2 and User Story 3 can start in parallel after User Story 1 controller and view wiring are in place

---

## Parallel Example: User Story 1

```bash
# Review acceptance tests for User Story 1 first:
Task: "Review and, if needed, update UC-14-AT.md for completed review visibility"

# Launch model accessors together:
Task: "Add Paper model accessor for assigned editor id in src/models/paper.js"
Task: "Add Review model accessor for submitted reviews in src/models/review.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently using UC-14-AT
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify acceptance criteria are defined before implementing
- Stop at any checkpoint to validate story independently
