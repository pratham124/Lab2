---

description: "Task list for Save Submission Draft"
---

# Tasks: Save Submission Draft

**Input**: Design documents from `/specs/001-uc-06-specs/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Acceptance tests in `UC-06-AT.md` are REQUIRED for any behavior change or new functionality. Update tests before implementation tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create MVC folder structure in `src/models/`, `src/controllers/`, `src/views/`, `src/services/`, and static assets in `public/css/`, `public/js/`
- [ ] T002 [P] Create baseline draft routes file in `src/controllers/draft_controller.js`
- [ ] T003 [P] Create draft service scaffold in `src/services/draft_service.js`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

 - [ ] T004 Review/update `UC-06.md` and `UC-06-AT.md` to align with clarified draft behaviors
- [ ] T005 [P] Add Draft Submission model stub in `src/models/draft_submission.js`
- [ ] T006 [P] Add Submission model adapter or stub in `src/models/submission.js`
- [ ] T007 [P] Add Author model adapter or stub in `src/models/author.js`
- [ ] T008 Implement draft persistence interface in `src/services/draft_service.js` (create/read/update by submission_id)
- [ ] T009 Add centralized validation helpers in `src/services/validation_service.js`
- [ ] T010 Add logging helper for failures and unauthorized access in `src/services/logging_service.js`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Save Draft Progress (Priority: P1) 🎯 MVP

**Goal**: Allow authors to save a draft with partial or empty data and receive clear success/error feedback.

**Independent Test**: Start a submission, save with partial/empty data, verify draft saved; attempt invalid data and verify validation failure message.

### Acceptance Tests for User Story 1 (REQUIRED) ⚠️

- [ ] T011 [P] [US1] Update `UC-06-AT.md` to reflect "no required fields" save rule and validation-on-provided-fields behavior
- [ ] T012 [P] [US1] Update `UC-06-AT.md` to cover idempotent double-click saves and last-write-wins conflicts
- [ ] T013 [P] [US1] Update `UC-06.md` if draft save behavior details changed
- [ ] T014 [P] [US1] Verify UC-06-AT scenarios for save success, validation failure, storage failure, and double-save are testable

### Implementation for User Story 1

- [ ] T015 [P] [US1] Define Draft Submission fields in `src/models/draft_submission.js`
- [ ] T016 [US1] Implement minimal validation rules (trim whitespace, validate provided fields only) in `src/services/validation_service.js`
- [ ] T017 [US1] Render field-level validation warnings in `src/views/submission_form.html`
- [ ] T018 [US1] Implement save draft operation in `src/services/draft_service.js`
- [ ] T019 [US1] Ensure no auto-expiration/TTL is applied in `src/services/draft_service.js`
- [ ] T020 [US1] Apply last-write-wins policy in `src/services/draft_service.js`
- [ ] T021 [US1] Wire save endpoint/controller in `src/controllers/draft_controller.js`
- [ ] T022 [US1] Handle last-write-wins conflicts in `src/controllers/draft_controller.js`
- [ ] T023 [US1] Add idempotent double-click handling in `src/controllers/draft_controller.js`
- [ ] T024 [US1] Add UI in-flight guard on save action in `src/views/submission_form.html`
- [ ] T025 [US1] Add success confirmation message placement and “last saved” timestamp in `src/views/submission_form.html`
- [ ] T026 [US1] Add save failure logging in `src/services/logging_service.js`

**Checkpoint**: User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Resume Draft Later (Priority: P2)

**Goal**: Allow authors to reopen their draft and see pre-populated data; enforce access control.

**Independent Test**: Save a draft, log out/in, reopen and verify data; attempt access as another author and confirm denial.

### Acceptance Tests for User Story 2 (REQUIRED) ⚠️

- [ ] T027 [P] [US2] Update `UC-06-AT.md` to confirm resume flow and access control expectations are explicit
- [ ] T028 [P] [US2] Update `UC-06.md` if resume/access behavior details changed
- [ ] T029 [P] [US2] Verify UC-06-AT resume and authorization scenarios are testable

### Implementation for User Story 2

- [ ] T030 [US2] Implement draft retrieval in `src/services/draft_service.js`
- [ ] T031 [US2] Enforce owner-only access checks in `src/controllers/draft_controller.js`
- [ ] T032 [US2] Populate saved values in `src/views/submission_form.html`
- [ ] T033 [US2] Log unauthorized access attempts in `src/services/logging_service.js`

**Checkpoint**: User Story 2 should be fully functional and testable independently

---

## Phase 5: User Story 3 - Update Existing Draft (Priority: P3)

**Goal**: Allow authors to update an existing draft without creating duplicates (one draft per submission).

**Independent Test**: Edit an existing draft, save again, verify the same draft is updated and no duplicate is created.

### Acceptance Tests for User Story 3 (REQUIRED) ⚠️

- [ ] T034 [P] [US3] Update `UC-06-AT.md` to explicitly cover update-without-duplicate behavior
- [ ] T035 [P] [US3] Update `UC-06.md` if update/duplicate behavior details changed
- [ ] T036 [P] [US3] Verify UC-06-AT update draft scenario is testable

### Implementation for User Story 3

- [ ] T037 [US3] Enforce one-draft-per-submission rule in `src/services/draft_service.js`
- [ ] T038 [US3] Update controller logic to call update vs. create in `src/controllers/draft_controller.js`
- [ ] T039 [US3] Add duplicate-prevention UI feedback in `src/views/submission_form.html`

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T040 [P] Review `specs/001-uc-06-specs/contracts/draft-submission.openapi.yml` against implemented endpoints and adjust if needed
- [ ] T041 [P] Ensure `specs/001-uc-06-specs/quickstart.md` steps still match implemented behavior
- [ ] T042 [P] Documentation updates in `/root/493-lab/Lab2/specs/001-uc-06-specs/spec.md` if behavior changed during implementation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: Depend on Foundational phase completion
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - no dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational - may integrate with US1 but independently testable
- **User Story 3 (P3)**: Can start after Foundational - depends on draft save flow from US1

### Parallel Opportunities

- Setup tasks T002 and T003 can run in parallel
- Foundational tasks T004, T005, T006, T007, T009, T010 can run in parallel
- Acceptance test updates for each story are parallelizable within their phase

---

## Parallel Example: User Story 1

```text
Task: T011 Update UC-06-AT.md for draft save rules
Task: T015 Define Draft Submission fields in src/models/draft_submission.js
Task: T016 Implement minimal validation rules in src/services/validation_service.js
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate UC-06-AT scenarios for save success/validation failure/storage failure

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. User Story 1 → Test independently → Demo
3. User Story 2 → Test independently → Demo
4. User Story 3 → Test independently → Demo
