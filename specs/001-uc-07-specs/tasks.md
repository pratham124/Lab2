---

description: "Task list for Receive Final Paper Decision"
---

# Tasks: Receive Final Paper Decision

**Input**: Design documents from `/specs/001-uc-07-specs/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Acceptance tests in `UC-07-AT.md` are REQUIRED for any behavior change
or new functionality. Include tasks to add/update those files before
implementation tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create MVC directories in `src/models/`, `src/controllers/`, `src/views/`, `src/services/`, `src/lib/` to support decision visibility implementation (Acceptance: directories exist in repo) (Maps to: FR-001)
- [ ] T002 Create test directories in `tests/unit/`, `tests/integration/`, `tests/contract/` to support decision visibility validation (Acceptance: directories exist in repo) (Maps to: FR-001)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [ ] T003 [P] Define decision visibility rules in `src/lib/decision-visibility.js` (Acceptance: module exports visibility predicate based on `published_at` and author ownership) (Maps to: FR-001)
- [ ] T004 [P] Define decision retrieval error message copy in `src/lib/error-messages.js` (Acceptance: message text matches research decision and contains no internal IDs) (Maps to: FR-007)
- [ ] T005 Create controller skeleton in `src/controllers/decision-controller.js` with MVC boundaries documented (Acceptance: routing/stub handlers only; no business logic; visibility rules live in services/lib) (Maps to: FR-001)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Final Decision in CMS (Priority: P1) 🎯 MVP

**Goal**: Submitting author can view the final decision only after official publication.

**Independent Test**: Publish a decision and verify it appears for the submitting author; verify it does not appear before publish.

### Acceptance Tests for User Story 1 (REQUIRED) ⚠️

- [ ] T006 [P] [US1] Update `UC-07.md` trigger wording to “decision officially published to authors” and align flows (Acceptance: UC-07 reflects publish-based visibility) (Maps to: FR-001)
- [ ] T007 [P] [US1] Update `UC-07-AT.md` to cover publish-gated visibility and decision correctness (Acceptance: new/updated scenarios exist and are testable) (Maps to: FR-002)

### Implementation for User Story 1

- [ ] T008 [P] [US1] Add decision visibility query in `src/services/decision-service.js` by reusing the predicate from `src/lib/decision-visibility.js` (T003) rather than reimplementing the rules (Acceptance: service calls shared predicate and returns decisions only when predicate passes) (Maps to: FR-001)
- [ ] T009 [US1] Render decision status in `src/views/submissions-view.js` without reviewer comments (Acceptance: view shows Accepted/Rejected only when allowed) (Maps to: FR-001)
- [ ] T010 [US1] Wire controller to view in `src/controllers/decision-controller.js` using visibility service (Acceptance: controller supplies decision data only after publish) (Maps to: FR-002)

**Checkpoint**: User Story 1 fully functional and independently testable

---

## Phase 4: User Story 2 - Receive Decision Notification (Priority: P2)

**Goal**: Submitting author receives an email at publish time, and decision remains visible even if notification fails.

**Independent Test**: Publish a decision and confirm email goes only to submitting author; simulate notification failure and confirm decision still visible.

### Acceptance Tests for User Story 2 (REQUIRED) ⚠️

- [ ] T011 [P] [US2] Update `UC-07-AT.md` to include notification-to-submitting-author-only and failure-does-not-block-visibility (Acceptance: scenarios explicitly cover email recipient and failure case) (Maps to: FR-003)

### Implementation for User Story 2

- [ ] T012 [P] [US2] Update notification dispatch in `src/services/notification-service.js` to target only submitting author at publish time (Acceptance: recipient list resolves to single submitting author) (Maps to: FR-003)
- [ ] T013 [US2] Ensure decision visibility path ignores notification status in `src/services/decision-service.js` (Acceptance: decision is visible even when notification status is failed) (Maps to: FR-004)
- [ ] T014 [US2] Persist and expose decision for delayed login in `src/services/decision-service.js` (Acceptance: decision remains visible for the submitting author on later login) (Maps to: FR-005)

**Checkpoint**: User Stories 1 and 2 both work independently

---

## Phase 5: User Story 3 - Handle Access and Retrieval Failures (Priority: P3)

**Goal**: Unauthorized access is blocked; retrieval failures show safe error and no decision is shown.

**Independent Test**: Attempt access as non-submitting author and simulate retrieval error; verify error message and no decision content.

### Acceptance Tests for User Story 3 (REQUIRED) ⚠️

- [ ] T015 [P] [US3] Update `UC-07-AT.md` to include retrieval failure message and no decision exposure (Acceptance: scenarios assert message content and absence of decision value) (Maps to: FR-008)

### Implementation for User Story 3

- [ ] T016 [P] [US3] Enforce author-only access in `src/services/decision-service.js` (Acceptance: non-submitting author receives access denied and no decision data) (Maps to: FR-006)
- [ ] T017 [US3] Handle retrieval errors in `src/controllers/decision-controller.js` using the approved message from `src/lib/error-messages.js` (depends on T004) (Acceptance: error response uses approved message and hides internal IDs) (Maps to: FR-007)
- [ ] T018 [US3] Ensure no decision value is rendered on retrieval error in `src/views/submissions-view.js` (Acceptance: view shows error state with no decision value or cached content) (Maps to: FR-008)
- [ ] T019 [US3] Ensure reviewer comments are never returned or displayed in `src/views/submissions-view.js` and any response mapping in `src/services/decision-service.js` (Acceptance: reviewer comments never returned or displayed) (Maps to: FR-009)

**Checkpoint**: All user stories independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T020 [P] Update `specs/001-uc-07-specs/quickstart.md` with steps for notification failure and retrieval failure checks (Acceptance: quickstart includes both scenarios) (Maps to: FR-004)
- [ ] T021 [P] Validate `UC-07.md` and `UC-07-AT.md` consistency for publish timing and visibility rules (Acceptance: no conflicting wording remains) (Maps to: FR-001)
- [ ] T022 [P] Add a manual performance check to `specs/001-uc-07-specs/quickstart.md` for decision view load time (Acceptance: quickstart includes timing step for decision visibility) (Maps to: FR-001)

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
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent of US1 for notification, but shares decision service
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Independent of US1/US2, uses shared controller/service

### Within Each User Story

- Acceptance test updates in `UC-07-AT.md` must be completed before implementation tasks
- Services before controllers
- Controllers before views
- Story complete before moving to next priority

### Parallel Opportunities

- T003 and T004 can run in parallel (different files)
- T006 and T007 can run in parallel (different files)
- T012 can run in parallel with T013/T014 (different files, after acceptance updates)
- T016 can run in parallel with T017 and T018 (different files, after acceptance updates)

---

## Parallel Example: User Story 1

```bash
Task: "Update UC-07.md trigger wording"
Task: "Update UC-07-AT.md for publish-gated visibility"
Task: "Add decision visibility query in decision-service"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate User Story 1 independently

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Demo
3. Add User Story 2 → Test independently → Demo
4. Add User Story 3 → Test independently → Demo
5. Polish phase
