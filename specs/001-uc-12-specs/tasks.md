---

description: "Task list for feature implementation"
---

# Tasks: Access Assigned Papers for Review

**Input**: Design documents from `/specs/001-uc-12-specs/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Acceptance tests in `UC-12-AT.md` are REQUIRED for any behavior change or new functionality. Include tasks to add/update those files before implementation tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create MVC directories per plan in `src/models/`, `src/controllers/`, `src/views/`, `src/services/`
- [X] T002 [P] Create test folders in `tests/acceptance/` and `tests/integration/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Define shared error response builder in `src/services/error_response.js` with failure statement, suggested next step, and back-to-list link/button
- [X] T004 Define access-check helper for reviewer assignments in `src/services/authorization_service.js`
- [X] T005 Define data-access wrapper for assignments/papers in `src/services/assignment_service.js`
- [X] T006 Define base reviewer route/controller skeleton in `src/controllers/assigned_papers_controller.js`
- [X] T026 Update `UC-12-AT.md` for title-only list (FR-002), empty-state (FR-005), retrieval error message elements + back link (FR-006), access denied 403 (FR-004), manuscript unavailable message + back link (FR-007), and no-download behavior (FR-003a)
- [X] T027 Update `UC-12.md` to explicitly state view-only/no-download in main flow and extensions

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View assigned papers list (Priority: P1) 🎯 MVP

**Goal**: Allow a reviewer to see their assigned papers list with title-only entries and empty-state messaging.

**Independent Test**: Log in as a reviewer with and without assignments and confirm title-only list or empty-state message appears.

### Acceptance Tests for User Story 1 (REQUIRED) ⚠️

- [X] T007 [P] [US1] Review and align list/empty-state criteria in `UC-12-AT.md` for assigned list and empty-state coverage
- [X] T008 [P] [US1] Verify acceptance criteria alignment in `UC-12.md` for list/empty-state behavior

### Implementation for User Story 1

- [X] T009 [P] [US1] Implement assigned list retrieval in `src/services/assignment_service.js`
- [X] T010 [US1] Implement list action in `src/controllers/assigned_papers_controller.js` (depends on T009)
- [X] T011 [US1] Create assigned list view in `src/views/assigned_papers_list.html`
- [X] T012 [US1] Add empty-state message handling in `src/views/assigned_papers_list.html` (depends on T011)

**Checkpoint**: User Story 1 is functional and testable independently

---

## Phase 4: User Story 2 - Open an assigned paper (Priority: P2)

**Goal**: Allow a reviewer to open and view an assigned paper’s content with view-only access.

**Independent Test**: From the assigned list, open a paper and confirm content displays; attempt missing manuscript and see defined error with back link.

### Acceptance Tests for User Story 2 (REQUIRED) ⚠️

- [X] T013 [P] [US2] Review manuscript-unavailable criteria in `UC-12-AT.md` for required message elements and back link

### Implementation for User Story 2

- [X] T014 [P] [US2] Implement paper content retrieval in `src/services/assignment_service.js`
- [X] T015 [US2] Implement view action in `src/controllers/assigned_papers_controller.js` (depends on T014)
- [X] T016 [US2] Create paper view page in `src/views/assigned_paper_view.html`
- [X] T017 [US2] Render view-only content and no-download UI in `src/views/assigned_paper_view.html`
- [X] T018 [US2] Handle manuscript-unavailable error with message elements and back link in `src/views/assigned_paper_view.html`

**Checkpoint**: User Story 2 is functional and testable independently

---

## Phase 5: User Story 3 - Handle access issues safely (Priority: P3)

**Goal**: Provide clear access-denied and retrieval error handling while keeping reviewers within reviewer pages.

**Independent Test**: Attempt unassigned access (expect 403 “Access denied”), simulate retrieval error, and confirm back link is provided.

### Acceptance Tests for User Story 3 (REQUIRED) ⚠️

- [X] T019 [P] [US3] Review access-denied and retrieval-error criteria in `UC-12-AT.md` for required message elements and 403 handling

### Implementation for User Story 3

- [X] T020 [US3] Implement access-denied (403) handling in `src/controllers/assigned_papers_controller.js`
- [X] T021 [US3] Implement retrieval error response mapping in `src/controllers/assigned_papers_controller.js`
- [X] T022 [US3] Add shared error view component in `src/views/error_message.html`
- [X] T023 [US3] Wire error view with back link to assigned list in `src/views/error_message.html`

**Checkpoint**: User Story 3 is functional and testable independently

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T024 [P] Update quickstart verification steps in `specs/001-uc-12-specs/quickstart.md` to cover SC-003/SC-004 outcomes
- [X] T025 [P] Run manual acceptance checks against `UC-12-AT.md` and record findings in `tests/acceptance/uc12-results.md` for SC-002/SC-003/SC-004

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
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent of US1 but uses shared services
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Independent of US1/US2 but uses shared services

### Within Each User Story

- Acceptance tests UPDATED first (if needed), then services → controllers → views
- Story complete before moving to next priority

### Parallel Opportunities

- Setup task T002 can run in parallel with T001 if desired
- Foundational tasks T003–T006 can be split across files and run in parallel
- User story acceptance review tasks can run in parallel with each other
- View templates within a story can be split across team members

---

## Parallel Example: User Story 1

```bash
# Review acceptance criteria for US1 first:
Task: "Review and align list/empty-state criteria in UC-12-AT.md"

# Then implement list and view pieces in parallel:
Task: "Implement assigned list retrieval in src/services/assignment_service.js"
Task: "Create assigned list view in src/views/assigned_papers_list.html"
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
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
