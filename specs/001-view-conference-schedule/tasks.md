---

description: "Task list for View Published Conference Schedule"
---

# Tasks: View Published Conference Schedule

**Input**: Design documents from `/specs/001-view-conference-schedule/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Acceptance tests in `UC-19-AT.md` are REQUIRED for any behavior change or new functionality. Update/confirm those files before implementation tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Update use case text to reflect current spec in `UC-19.md`
- [X] T002 Update acceptance tests to reflect current spec in `UC-19-AT.md`
- [X] T003 Create MVC directories per plan in `src/` and `tests/` (src/models, src/controllers, src/views, src/services, tests/unit, tests/integration)
- [X] T004 Add placeholder README for feature usage in `src/views/README.md` (depends on T003)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [X] T005 Create schedule entity models in `src/models/schedule.js` (PublishedSchedule, ScheduleEntry, TimeSlot, Location)
- [X] T006 [P] Define shared error model in `src/models/error_message.js` (message, canRetry)
- [X] T007 Add shared fetch helper in `src/services/http_client.js`
- [X] T008 Implement schedule retrieval service wrapper in `src/services/schedule_service.js` for `GET /schedule/published` (depends on T007)
- [X] T009 Create base schedule view shell in `src/views/schedule_view.html`
- [X] T010 [P] Add schedule view styles in `src/views/schedule_view.css`
- [X] T011 Create controller wiring for schedule view in `src/controllers/schedule_controller.js`
- [X] T012 Wire view script entry in `src/views/schedule_view.js` to controller (depends on T009 and T011)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Published Schedule (Priority: P1) 🎯 MVP

**Goal**: Attendee can view the published schedule with only complete entries, and handle retrieval failure with retry.

**Independent Test**: Open schedule view as unauthenticated user, see published entries with time/location; simulate retrieval failure to see error and retry; retry succeeds or repeats error based on response.

### Implementation for User Story 1

- [X] T013 [US1] Implement controller logic to request published schedule and handle 200/503 responses in `src/controllers/schedule_controller.js` (depends on Phase 2 artifacts)
- [X] T014 [US1] Handle empty entries list response and surface “no results” state trigger in `src/controllers/schedule_controller.js` (depends on Phase 2 artifacts)
- [X] T015 [US1] Render entries with time/location only (hide incomplete) in `src/views/schedule_view.js` (depends on Phase 2 artifacts)
- [X] T016 [US1] Render ErrorMessage with message and show retry action when `canRetry=true` in `src/views/schedule_view.js` (depends on Phase 2 artifacts)
- [X] T017 [US1] Wire retry action to re-GET `/schedule/published` in `src/controllers/schedule_controller.js` (depends on Phase 2 artifacts)

**Checkpoint**: User Story 1 is functional and testable independently

---

## Phase 4: User Story 2 - See Unpublished Schedule Message (Priority: P2)

**Goal**: Attendee sees a clear message when the schedule is unpublished or absent.

**Independent Test**: Force `/schedule/published` to return 404 and confirm the unpublished message is displayed with no schedule entries.

### Implementation for User Story 2

- [X] T018 [US2] Handle 404 “not published” response in `src/controllers/schedule_controller.js` (depends on Phase 2 artifacts)
- [X] T019 [US2] Display unpublished message state in `src/views/schedule_view.js` (depends on Phase 2 artifacts)

**Checkpoint**: User Story 2 works independently with no reliance on filters

---

## Phase 5: User Story 3 - Filter Schedule Views (Priority: P3)

**Goal**: If day/session filters exist, attendee can filter schedule and see “no results” with reset for empty matches.

**Independent Test**: Use filters to request day/session; if no matches, see 200 with entries=[] and “no results” + reset.

### Implementation for User Story 3

- [X] T020 [US3] Wire existing filter controls (only if already present) in `src/views/schedule_view.html`
- [X] T021 [US3] Apply day/session query parameters in `src/controllers/schedule_controller.js` (only if filters exist)
- [X] T022 [US3] Render “no results” state and reset option for empty entries list in `src/views/schedule_view.js` (only if filters exist)

**Checkpoint**: User Story 3 works independently when filters exist

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T023 [P] Verify UC-19 acceptance tests align with behavior in `UC-19-AT.md`
- [ ] T024 [P] Run quickstart validation steps in `/root/493-lab/Lab2/specs/001-view-conference-schedule/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Depends on controller/view foundation
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Depends on controller/view foundation

### Parallel Opportunities

- T006 and T010 can run in parallel
- Within US1, view rendering and retry wiring can be split across controller/view tasks
- US2 and US3 can be done in parallel after US1 foundation if staffing allows

---

## Parallel Example: User Story 1

```bash
# In parallel after foundational tasks complete:
Task: "Implement controller logic in src/controllers/schedule_controller.js"
Task: "Render entries and error states in src/views/schedule_view.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate independently using quickstart

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Validate
3. Add User Story 2 → Validate
4. Add User Story 3 → Validate

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
