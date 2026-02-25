---

description: "Task list for Submit Completed Review Form"
---

# Tasks: Submit Completed Review Form

**Input**: Design documents from `/specs/001-uc-13-spec/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Acceptance tests in `UC-13-AT.md` are REQUIRED for any behavior change or new functionality. Include tasks to add/update those files before implementation tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create MVC and asset directories: `src/controllers/`, `src/models/`, `src/views/`, `public/css/`, `public/js/`, `tests/acceptance/`, `tests/manual/`
- [X] T002 [P] Add placeholder MVC entry files: `src/controllers/review_controller.js`, `src/models/review_model.js`, `src/views/review_form.html`, `src/views/editor_reviews.html`
- [X] T002a [P] Create JS stubs: `public/js/review_form.js`, `public/js/editor_reviews.js`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Confirm `UC-13.md` reflects current submission lifecycle rules (immutability, no resubmission)
- [X] T004 Update `UC-13-AT.md` to include the editor-visibility timing requirement (<= 1 minute)
- [X] T005 Review and update acceptance tests in `UC-13-AT.md` to confirm coverage for resubmission block and immutability
- [X] T006 Define review data access interface in `src/models/review_model.js` (create, read-by-paper, duplicate-check)
- [X] T007 [P] Define authorization/assignment check interface in `src/controllers/review_controller.js`
- [X] T008 [P] Add shared error message helpers in `public/js/review_form.js`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Submit a Completed Review (Priority: P1) 🎯 MVP

**Goal**: Reviewer submits a valid review; editor can immediately see it.

**Independent Test**: Reviewer submits valid form once and editor sees it immediately.

### Acceptance Tests for User Story 1 (REQUIRED) ⚠️

- [X] T009 [P] [US1] Confirm AT-UC13-01 and AT-UC13-02 still match requirements in `UC-13-AT.md`

### Implementation for User Story 1

- [X] T010 [US1] Implement review creation + persistence in `src/models/review_model.js`
- [X] T011 [P] [US1] Build review submission form UI in `src/views/review_form.html`
- [X] T012 [P] [US1] Wire review form submission client logic in `public/js/review_form.js`
- [X] T023 [US1] Enforce invitation-accepted and assignment checks in `src/controllers/review_controller.js`
- [X] T024 [US1] Implement duplicate submission blocking (one review per reviewer per paper) in `src/models/review_model.js`
- [X] T013 [US1] Implement submit handler and success response in `src/controllers/review_controller.js`
- [X] T014 [P] [US1] Define success confirmation text in `src/views/review_form.html`
- [X] T015 [P] [US1] Implement editor review list view in `src/views/editor_reviews.html`
- [X] T016 [P] [US1] Implement editor review list client logic in `public/js/editor_reviews.js`
- [X] T017 [US1] Implement editor review list handler in `src/controllers/review_controller.js`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Prevent Incomplete or Invalid Submissions (Priority: P2)

**Goal**: Incomplete or invalid reviews are blocked with clear guidance.

**Independent Test**: Missing/invalid required fields are rejected with field-specific messages.

### Acceptance Tests for User Story 2 (REQUIRED) ⚠️

- [X] T018 [P] [US2] Confirm AT-UC13-03 and AT-UC13-04 match validation behavior in `UC-13-AT.md`

### Implementation for User Story 2

- [X] T019 [US2] Add required-fields and invalid-value validation rules to `src/models/review_model.js`
- [X] T020 [US2] Enforce required-fields and invalid-value validation in submit handler in `src/controllers/review_controller.js`
- [X] T021 [P] [US2] Display required-field and invalid-value validation errors in `public/js/review_form.js`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Handle Unauthorized or Failed Submissions (Priority: P3)

**Goal**: Unauthorized submissions are blocked; failures return safe error messages with no partial save.

**Independent Test**: Unauthorized submission is rejected; simulated failure shows error and no saved review.

### Acceptance Tests for User Story 3 (REQUIRED) ⚠️

- [X] T022 [P] [US3] Confirm AT-UC13-05 and AT-UC13-06 match failure/authorization behavior in `UC-13-AT.md`

### Implementation for User Story 3
- [X] T025 [US3] Add immutability checks in `src/models/review_model.js` and disable post-submit edits in `public/js/review_form.js`
- [X] T026 [US3] Add failure handling to prevent partial save in `src/models/review_model.js`
- [X] T027 [P] [US3] Display authorization/failure messages in `public/js/review_form.js`

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T028 [P] Align success/error messaging in `src/views/review_form.html` with FR-005/FR-007
- [X] T029 [P] Run quickstart validation steps and record notes in `specs/001-uc-13-spec/quickstart.md`

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
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Extends validation behaviors in US1
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Extends auth/failure behaviors in US1

### Within Each User Story

- Acceptance test alignment before implementation
- Models before controllers
- Controllers before views integration
- Core implementation before polish

### Parallel Opportunities

- Phase 1 tasks marked [P] can run in parallel
- Phase 2 tasks marked [P] can run in parallel
- Once Phase 2 completes, user stories can proceed in parallel by file separation
- UI tasks within each story marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Acceptance test alignment first:
Task: "Confirm AT-UC13-01 and AT-UC13-02 match requirements in UC-13-AT.md"

# Parallel UI work:
Task: "Build review submission form UI in src/views/review_form.html"
Task: "Wire review form submission client logic in public/js/review_form.js"
Task: "Implement editor review list view in src/views/editor_reviews.html"
Task: "Implement editor review list client logic in public/js/editor_reviews.js"
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
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
