# Tasks: Generate Conference Schedule

**Input**: Design documents from `/root/493-lab/Lab2/specs/001-generate-conference-schedule/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Acceptance tests in `UC-16-AT.md` are REQUIRED for any behavior change or new functionality. Include tasks to update those files before implementation tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

 - [X] T001 Create MVC directory structure in `src/models/`, `src/controllers/`, `src/views/`, `src/services/`, `src/public/`
 - [X] T002 Create testing directories in `tests/integration/` and `tests/unit/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented, including admin guard + access-denied responses

 - [X] T003 Update `UC-16-AT.md` with confirmReplace behavior cases (schedule exists vs. not)
 - [X] T004 Update `UC-16-AT.md` with admin auth/403 access control cases for both schedule endpoints
 - [X] T005 Update `UC-16-AT.md` with failure cases (missing parameters, constraints, save failure)
 - [X] T006 Update OpenAPI contract in `specs/001-generate-conference-schedule/contracts/openapi.yaml` to add adminAuth security + 403 for both endpoints, confirmReplace request flag/flow for POST generate, and status code mapping (400 missing params, 409 unsatisfiable constraints, 500 save failure)
 - [X] T007 [P] Create storage adapter interface in `src/services/storage_adapter.js`
 - [X] T029 [US3] Apply admin authorization guard to schedule endpoints in `src/controllers/schedule_controller.js`
 - [X] T008 [P] Create admin authorization helper in `src/services/auth_service.js`
 - [X] T009 Create schedule controller scaffold in `src/controllers/schedule_controller.js`
 - [X] T031 [US3] Add access denied response handling in `src/services/response_service.js`
 - [X] T010 Create shared error/response helpers in `src/services/response_service.js`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Generate Schedule (Priority: P1) 🎯 MVP

**Goal**: Generate, store, and display a complete schedule for accepted papers.

**Independent Test**: Generate a schedule with valid parameters and confirm it is stored and displayed with each accepted paper exactly once.

### Implementation for User Story 1

 - [X] T011 [P] [US1] Create `ConferenceSchedule` model in `src/models/conference_schedule.js`
 - [X] T012 [P] [US1] Create `Session` model in `src/models/session.js`
 - [X] T013 [P] [US1] Create `TimeSlot` model in `src/models/time_slot.js`
 - [X] T014 [P] [US1] Create `AcceptedPaper` model in `src/models/accepted_paper.js`
 - [X] T015 [P] [US1] Create `SchedulingParameters` model in `src/models/scheduling_parameters.js`
 - [X] T016 [P] [US1] Create `Room` model in `src/models/room.js`
 - [X] T017 [US1] Implement schedule generation service in `src/services/schedule_generator.js`
 - [X] T018 [US1] Implement deterministic assignment ordering in `src/services/schedule_generator.js`
 - [X] T019 [US1] Implement schedule persistence in `src/services/schedule_service.js`
 - [X] T020 [US1] Implement POST handler for schedule generation in `src/controllers/schedule_controller.js`
 - [X] T021 [US1] Add schedule display view for generation result in `src/views/schedule_result.html`
 - [X] T022 [US1] Add validation for required scheduling parameters in `src/services/schedule_generator.js`
 - [X] T023 [US1] Add schedule existence check (or getSchedule) method in `src/services/schedule_service.js` to support confirmReplace
 - [X] T024 [US1] Add confirmReplace handling in `src/controllers/schedule_controller.js`
 - [X] T025 [US1] Add failure handling for unsatisfiable constraints and save errors in `src/controllers/schedule_controller.js`

**Checkpoint**: User Story 1 functional and testable independently

---

## Phase 4: User Story 2 - Re-View Stored Schedule (Priority: P2)

**Goal**: Allow administrators to view the previously generated schedule.

**Independent Test**: Load schedule view after generation and confirm stored schedule matches previously generated content.

### Implementation for User Story 2

 - [X] T026 [US2] Add schedule retrieval method in `src/services/schedule_service.js`
 - [X] T027 [US2] Implement GET handler for schedule view in `src/controllers/schedule_controller.js`
 - [X] T028 [US2] Add schedule view page in `src/views/schedule_view.html`

**Checkpoint**: User Story 2 functional and testable independently

---

## Phase 5: User Story 3 - Access Control for Generation (Priority: P3)

**Goal**: Prevent non-admin users from generating schedules.

**Independent Test**: Attempt schedule generation as non-admin and confirm access is denied without changes.

### Implementation for User Story 3

 - [X] T030 [US3] Align auth guard behavior with `adminAuth` scheme in `specs/001-generate-conference-schedule/contracts/openapi.yaml`

**Checkpoint**: User Story 3 functional and testable independently

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

 - [X] T032 [P] Define availability monitoring approach for schedule generation in `/root/493-lab/Lab2/specs/001-generate-conference-schedule/plan.md`
 - [X] T033 [P] Add performance validation steps (record measured times vs. SC-001/SC-004 thresholds) in `/root/493-lab/Lab2/specs/001-generate-conference-schedule/quickstart.md`
 - [X] T034 [P] Validate quickstart steps in `/root/493-lab/Lab2/specs/001-generate-conference-schedule/quickstart.md`
 - [X] T035 [P] Update documentation links in `/root/493-lab/Lab2/specs/001-generate-conference-schedule/plan.md` if paths changed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational; no dependencies on other stories
- **User Story 2 (P2)**: Depends on Foundational; relies on schedule storage from US1
- **User Story 3 (P3)**: Depends on Foundational; applies guards to US1/US2 endpoints

### Parallel Opportunities

- Models in US1 (T011–T016) can be done in parallel
- Foundational tasks T007 and T008 can be done in parallel
- Polish tasks T032 and T033 can be done in parallel

---

## Parallel Example: User Story 1

```bash
Task: "Create ConferenceSchedule model in src/models/conference_schedule.js"
Task: "Create Session model in src/models/session.js"
Task: "Create TimeSlot model in src/models/time_slot.js"
Task: "Create AcceptedPaper model in src/models/accepted_paper.js"
Task: "Create SchedulingParameters model in src/models/scheduling_parameters.js"
Task: "Create Room model in src/models/room.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate acceptance criteria using `UC-16-AT.md`

### Incremental Delivery

1. Setup + Foundational
2. User Story 1 → validate independently
3. User Story 2 → validate independently
4. User Story 3 → validate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify acceptance criteria are defined before implementing
