---

description: "Task list for paper submission implementation"
---

# Tasks: Paper Submission

**Input**: Design documents from `/specs/001-paper-submission/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Acceptance tests in `UC-04-AT.md` are REQUIRED for any behavior change or new functionality. Update documentation before implementation tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create/verify MVC and public asset directories per plan in `/root/493-lab/Lab2/src/` and `/root/493-lab/Lab2/public/`
- [X] T002 [P] Create submission constraints config in `/root/493-lab/Lab2/src/lib/submission_constraints.js`
- [X] T003 [P] Create shared error/response helpers in `/root/493-lab/Lab2/src/lib/response_helpers.js`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Implement Author model in `/root/493-lab/Lab2/src/models/author.js`
- [X] T005 [P] Implement PaperSubmission model in `/root/493-lab/Lab2/src/models/paper_submission.js`
- [X] T006 [P] Implement ManuscriptFile model in `/root/493-lab/Lab2/src/models/manuscript_file.js`
- [X] T007 [P] Implement SubmissionWindow model or adapter in `/root/493-lab/Lab2/src/models/submission_window.js`
- [X] T008 Implement submission repository interface in `/root/493-lab/Lab2/src/services/submission_repository.js`
- [X] T009 Implement manuscript storage interface in `/root/493-lab/Lab2/src/services/manuscript_storage.js`
- [X] T010 Create submission controller scaffold in `/root/493-lab/Lab2/src/controllers/submission_controller.js`
- [X] T011 Create submission routes wiring in `/root/493-lab/Lab2/src/controllers/routes.js`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Submit a new paper (Priority: P1) 🎯 MVP

**Goal**: Allow a logged-in author to submit required metadata and a valid manuscript to create a submission.

**Independent Test**: Complete a valid submission and confirm the paper is marked submitted and a confirmation is shown.

### Acceptance Tests for User Story 1 (REQUIRED) ⚠️

- [X] T012 [P] [US1] Review/update UC-04 main success path in `/root/493-lab/Lab2/UC-04.md`
- [X] T013 [P] [US1] Review/update main success path in `/root/493-lab/Lab2/UC-04-AT.md` for required metadata and accepted formats

### Implementation for User Story 1

- [X] T014 [P] [US1] Implement submission form view in `/root/493-lab/Lab2/src/views/submission_form.html` (presentation only)
- [X] T015 [P] [US1] Implement confirmation view in `/root/493-lab/Lab2/src/views/submission_confirm.html` (presentation only)
- [X] T016 [P] [US1] Add form styling in `/root/493-lab/Lab2/public/css/submission.css`
- [X] T017 [P] [US1] Add client-side form wiring in `/root/493-lab/Lab2/public/js/submission.js` (no business logic)
- [X] T018 [US1] Implement submission creation service in `/root/493-lab/Lab2/src/services/submission_service.js`
- [X] T019 [US1] Implement POST handler for `/submissions` in `/root/493-lab/Lab2/src/controllers/submission_controller.js`
- [X] T020 [US1] Implement GET confirmation handler in `/root/493-lab/Lab2/src/controllers/submission_controller.js`

**Checkpoint**: User Story 1 is fully functional and independently testable

---

## Phase 4: User Story 2 - Resolve validation issues and resubmit (Priority: P2)

**Goal**: Provide clear validation feedback for missing/invalid metadata, invalid files, and duplicates.

**Independent Test**: Trigger each validation error, correct inputs, and complete a successful submission without restarting.

### Acceptance Tests for User Story 2 (REQUIRED) ⚠️

- [X] T021 [P] [US2] Review/update UC-04 extensions for validation, duplicates, and save failures in `/root/493-lab/Lab2/UC-04.md`
- [X] T022 [P] [US2] Review/update validation, duplicate, and file-size cases in `/root/493-lab/Lab2/UC-04-AT.md`

### Implementation for User Story 2

- [X] T023 [US2] Implement metadata validation rules in `/root/493-lab/Lab2/src/services/submission_service.js` (service-layer logic)
- [X] T024 [US2] Implement file validation (format + 7 MB max) in `/root/493-lab/Lab2/src/services/submission_service.js` (service-layer logic)
- [X] T025 [US2] Implement duplicate detection using {author + title} and/or manuscript hash within submission window in `/root/493-lab/Lab2/src/services/submission_service.js`
- [X] T026 [US2] Implement validation error mapping to fields in `/root/493-lab/Lab2/src/lib/response_helpers.js`
- [X] T027 [US2] Implement user-safe save-failure message composition in `/root/493-lab/Lab2/src/lib/response_helpers.js`
- [X] T028 [US2] Implement controller-side validation/duplicate error handling in `/root/493-lab/Lab2/src/controllers/submission_controller.js`
- [X] T029 [US2] Implement UI field highlight + inline error label rendering in `/root/493-lab/Lab2/public/js/submission.js` (wiring only)
- [X] T030 [US2] Add error placeholders for inline field labels and save-failure message in `/root/493-lab/Lab2/src/views/submission_form.html`

### Edge Case Coverage for User Story 2

- [X] T031 [US2] Define session-expiry behavior and messaging in `/root/493-lab/Lab2/src/controllers/submission_controller.js`
- [X] T032 [US2] Define upload interruption/network loss handling in `/root/493-lab/Lab2/src/controllers/submission_controller.js`
- [X] T033 [US2] Define invalid LaTeX ZIP handling in `/root/493-lab/Lab2/src/services/submission_service.js`

**Checkpoint**: User Story 2 behavior is fully functional and independently testable

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T034 [P] Document post-release verification approach for SC-001..SC-004 in `/root/493-lab/Lab2/specs/001-paper-submission/quickstart.md`
- [X] T035 [P] Align contracts with implementation notes in `/root/493-lab/Lab2/specs/001-paper-submission/contracts/submissions.yaml`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can proceed in parallel after Phase 2
- **Polish (Final Phase)**: Depends on desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2)
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) and should integrate with US1 submission flow

### Dependency Graph

- Phase 1 → Phase 2 → US1 → US2 → Polish

---

## Parallel Execution Examples

### User Story 1

- T014, T015, T016, T017 can run in parallel (separate view/CSS/JS files)
- T012 and T013 can run in parallel with T014–T017 (doc updates)

### User Story 2

- T021 and T022 can run in parallel with T023–T033 (doc updates)
- T023–T025 should be sequenced within `/root/493-lab/Lab2/src/services/submission_service.js`
- T026 and T027 can run in parallel (helpers)
- T028 can run after T023–T027 (controller handling)
- T029 and T030 can run in parallel (client wiring + view placeholders)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate UC-04-AT main success path

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Validate independently
3. Add User Story 2 → Validate independently
4. Complete Polish phase updates

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Update acceptance test documentation before implementing behavior changes
