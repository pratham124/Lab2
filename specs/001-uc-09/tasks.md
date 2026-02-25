---

description: "Task list for enforcing reviewer workload limit"
---

# Tasks: Enforce Reviewer Workload Limit

**Input**: Design documents from `/specs/001-uc-09/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Acceptance tests in `UC-09-AT.md` are REQUIRED for any behavior change or new functionality. Update those files before implementation tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Review requirements in `specs/001-uc-09/spec.md` and map FRs to UC-09/UC-09-AT
- [X] T002 Update contract alignment in `specs/001-uc-09/contracts/reviewer-assignment.yaml`
- [X] T003 Create MVC folders per plan in `src/models/`, `src/controllers/`, `src/views/`
- [X] T004 Align file naming conventions with existing codebase (rename files + update references) in `src/` and `specs/001-uc-09/contracts/reviewer-assignment.yaml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [X] T005 Define shared workload counting helper in `src/models/workload_count.js`
- [X] T006 Define assignment data access helpers in `src/models/assignment.js`
- [X] T007 Define reviewer data access helpers in `src/models/reviewer.js`
- [X] T008 Define paper data access helpers in `src/models/paper.js`
- [X] T009 Define error/logging utility for workload verification failures in `src/controllers/logging.js`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Block assignment at workload limit (Priority: P1) 🎯 MVP

**Goal**: Prevent assignments that would exceed five assigned papers per reviewer per conference. Concurrency enforcement is validated in US3 (T030); US1 covers single-attempt limit enforcement.

**Independent Test**: Attempt assignment for a reviewer with five assigned papers and verify the assignment is blocked with a clear message and no record created (UC-09-AT).

### Acceptance Tests for User Story 1 (REQUIRED) ⚠️

- [X] T010 [P] [US1] Update UC-09 scenarios in `UC-09.md` for workload-limit behavior
- [X] T011 [P] [US1] Update acceptance criteria in `UC-09-AT.md` for workload-limit block

### Implementation for User Story 1

- [X] T012 [US1] Implement workload limit check in `src/models/workload_count.js`
- [X] T013 [US1] Compute workload count per conference in `src/models/workload_count.js`
- [X] T014 [US1] Enforce limit before assignment creation in `src/models/assignment.js`
- [X] T015 [US1] Prevent persistence on blocked assignments (no model write) in `src/controllers/reviewer_assignment_controller.js`
- [X] T016 [US1] Block assignment and return limit error in `src/controllers/reviewer_assignment_controller.js`
- [X] T017 [US1] Enforce editor-only access (deny non-editors; no assignment attempt) in `src/controllers/reviewer_assignment_controller.js`
- [X] T018 [US1] Display workload-limit message in `src/views/reviewer_assignment_view.js`
- [X] T019 [US1] Add reviewer selection filtering (hide reviewers at limit) in `src/controllers/reviewer_selection_controller.js`
- [X] T020 [P] [US1] Render selectable reviewer list (depends on T019 selectable list output) in `src/views/reviewer_selection_view.js`

**Checkpoint**: User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Allow assignment under the limit (Priority: P2)

**Goal**: Allow valid assignments when reviewers have fewer than five assigned papers.

**Independent Test**: Assign a reviewer with fewer than five assigned papers and verify the assignment is saved and the workload count increments (UC-09-AT).

### Acceptance Tests for User Story 2 (REQUIRED) ⚠️

- [X] T021 [P] [US2] Update acceptance criteria in `UC-09-AT.md` for under-limit assignments

### Implementation for User Story 2

- [X] T022 [US2] Allow assignment creation path in `src/models/assignment.js`
- [X] T023 [US2] Return success response on valid assignment in `src/controllers/reviewer_assignment_controller.js`
- [X] T024 [US2] Show assignment success feedback in `src/views/reviewer_assignment_view.js`

**Checkpoint**: User Story 2 should be fully functional and testable independently

---

## Phase 5: User Story 3 - Fail safe when workload cannot be verified (Priority: P3)

**Goal**: Block assignment when workload verification fails, show an error, and log the failure for admin review.

**Independent Test**: Simulate workload lookup failure and verify assignment is blocked, error is shown, and failure is logged (UC-09-AT).

### Acceptance Tests for User Story 3 (REQUIRED) ⚠️

- [X] T025 [P] [US3] Update acceptance criteria in `UC-09-AT.md` for verification failure handling

### Implementation for User Story 3

- [X] T026 [US3] Handle workload verification failure in `src/models/workload_count.js`
- [X] T027 [US3] Block assignment with verification error in `src/controllers/reviewer_assignment_controller.js`
- [X] T028 [US3] Log verification failure in `src/controllers/logging.js`
- [X] T029 [US3] Display verification failure message in `src/views/reviewer_assignment_view.js`
- [X] T030 [US3] Ensure concurrency guard before commit in `src/models/assignment.js`

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T031 Update quickstart validation notes in `specs/001-uc-09/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Depends on shared assignment model from US1
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Depends on shared workload model from US1

### Parallel Opportunities

- T005–T009 can run in parallel (distinct model/controller files)
- T010–T011 can run in parallel (separate docs)
- T012–T020 are sequential within US1
- T019 depends on T012–T013 (uses per-conference workload count)
- T024 can run in parallel with other US2 work

---

## Parallel Example: User Story 1

```bash
# Docs verification in parallel
Task: "Update UC-09 scenarios in UC-09.md"
Task: "Update acceptance criteria in UC-09-AT.md for the workload limit block"

# Core implementation sequence (includes selection list after workload count is available)
Task: "Implement workload limit check in src/models/workload_count.js"
Task: "Compute workload count per conference in src/models/workload_count.js"
Task: "Enforce limit before assignment creation in src/models/assignment.js"
Task: "Block assignment and return limit error in src/controllers/reviewer_assignment_controller.js"
Task: "Display workload-limit message in src/views/reviewer_assignment_view.js"
Task: "Add reviewer selection filtering (hide reviewers at limit) in src/controllers/reviewer_selection_controller.js"
Task: "Render selectable reviewer list in src/views/reviewer_selection_view.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. Validate UC-09-AT scenarios for workload limit block

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Validate independently
3. Add User Story 2 → Validate independently
4. Add User Story 3 → Validate independently
5. Polish & cross-cutting concerns

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. Polish tasks run after user stories stabilize

## Notes

- [P] tasks = different files, no dependencies
- [US1]/[US2]/[US3] labels map to user stories for traceability
- Each user story should be independently completable and testable
- Acceptance test verification required before and after changes
