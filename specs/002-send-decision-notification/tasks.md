# Tasks: Send Decision Notification

**Input**: Design documents from `/specs/002-send-decision-notification/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Acceptance tests in `UC-15-AT.md` are REQUIRED for any behavior change or new functionality. Update before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create project structure per plan in `src/models/`, `src/services/`, `src/controllers/`, `src/views/`, `tests/acceptance/`, `tests/integration/`
- [X] T002 [P] Add base MVC placeholders in `src/models/.keep`, `src/services/.keep`, `src/controllers/.keep`, `src/views/.keep`
- [X] T003 [P] Add acceptance test folder notes in `tests/acceptance/README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [X] T004 Define shared validation helpers in `src/services/validation.js` for required review completeness and role checks
- [X] T005 [P] Define shared error/response helpers in `src/controllers/response.js` for standard decision/notification responses
- [X] T006 [P] Define shared notification status constants in `src/services/notification_status.js`
- [X] T007 Define base data access interfaces in `src/services/repository.js` for papers, decisions, assignments, and notification attempts
- [X] T008 Create DecisionService skeleton in `src/services/decision_service.js` for later story-specific logic

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Send Final Decision to Authors (Priority: P1) 🎯 MVP

**Goal**: Editor records a final decision and sends notifications with duplicate-send protection and finality enforced.

**Independent Test**: An editor can record accept/reject, decision becomes final, authors are notified once, and editor receives confirmation.

### Acceptance Tests for User Story 1 (REQUIRED) ⚠️

- [X] T009 [US1] Update `UC-15-AT.md` to cover decision finality, duplicate send handling, and required review completeness definition
- [X] T010 [US1] Add acceptance test notes for notificationStatus values (sent/partial/failed) in `UC-15-AT.md`
- [X] T011 [US1] Add acceptance test notes in `UC-15-AT.md` for timing metrics (SC-001..SC-004)
- [X] T012 [US1] Update `UC-15.md` to reflect any behavior changes introduced in UC-15-AT updates

### Implementation for User Story 1

- [X] T013 [P] [US1] Create Decision model in `src/models/decision.js`
- [X] T014 [P] [US1] Create NotificationAttempt model in `src/models/notification_attempt.js`
- [X] T015 [P] [US1] Create ReviewAssignment model in `src/models/review_assignment.js`
- [X] T016 [US1] Implement DecisionService in `src/services/decision_service.js` (record decision, enforce finality, prevent duplicates)
- [X] T017 [US1] Implement NotificationService in `src/services/notification_service.js` (send notifications, set notificationStatus, no auto-retry)
- [X] T018 [US1] Implement DecisionController POST in `src/controllers/decision_controller.js` (record + notify, return decisionId/final/status)
- [X] T019 [US1] Add editor decision view in `src/views/decision_send.html` with confirmation display for sent/failed/partial statuses

**Checkpoint**: User Story 1 fully functional and independently testable

---

## Phase 4: User Story 2 - Block Decisions When Reviews Are Incomplete (Priority: P2)

**Goal**: Prevent decision sending until all required reviews are submitted and no required assignment remains pending.

**Independent Test**: Attempting to send a decision with incomplete reviews is blocked with a clear message and no state change.

### Acceptance Tests for User Story 2 (REQUIRED) ⚠️

- [X] T020 [US2] Update `UC-15-AT.md` to specify assignment-status gating for required reviews

### Implementation for User Story 2

- [X] T021 [P] [US2] Implement ReviewStatus computation in `src/services/review_status_service.js`
- [X] T022 [US2] Integrate review completeness gating into `src/services/decision_service.js`
- [X] T023 [US2] Add blocked-state messaging in `src/views/decision_send.html`

**Checkpoint**: User Stories 1 and 2 work independently

---

## Phase 5: User Story 3 - Preserve Decisions Despite Notification Failures (Priority: P3)

**Goal**: Keep decisions recorded and visible even when notification delivery fails; allow resend to failed recipients only.

**Independent Test**: Notification failure leaves decision stored, editor informed, and resend targets only failed authors.

### Acceptance Tests for User Story 3 (REQUIRED) ⚠️

- [X] T024 [US3] Update `UC-15-AT.md` for notification failure, partial delivery, resend-only-failed behavior, and no auto-retry confirmation

### Implementation for User Story 3

- [X] T025 [P] [US3] Add notification attempt tracking in `src/services/notification_service.js`
- [X] T026 [US3] Implement resend endpoint in `src/controllers/notification_resend_controller.js` (only failed recipients)
- [X] T027 [US3] Add partial-success UI messaging in `src/views/decision_send.html`

**Checkpoint**: User Stories 1–3 fully functional

---

## Phase 6: User Story 4 - Authors Can View Recorded Decisions (Priority: P3)

**Goal**: Authors can view recorded decision details (outcome, paper id/title, timestamp) without review content.

**Independent Test**: Author view shows decision fields and excludes reviewer content regardless of notification outcome.

### Acceptance Tests for User Story 4 (REQUIRED) ⚠️

- [X] T028 [US4] Update `UC-15-AT.md` to include author decision view fields and exclusions

### Implementation for User Story 4

- [X] T029 [P] [US4] Implement author decision view model in `src/models/decision_view.js`
- [X] T030 [US4] Add paper title lookup in `src/services/repository.js` for DecisionController GET
- [X] T031 [US4] Implement DecisionController GET in `src/controllers/decision_controller.js` (paperId, paperTitle, outcome, recordedAt, final)
- [X] T032 [US4] Add author decision view UI in `src/views/decision_view.html`

**Checkpoint**: All user stories independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T033 [P] Update `specs/002-send-decision-notification/quickstart.md` with execution notes for acceptance checks (cross-cutting)
- [X] T034 Add integration wiring notes in `src/controllers/README.md` (cross-cutting)

---

## Dependencies & Execution Order

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational phase completion only
- **US2 (P2)**: Depends on Foundational phase completion; updates shared DecisionService logic
- **US3 (P3)**: Depends on Foundational phase completion; extends notification handling
- **US4 (P3)**: Depends on Foundational phase completion; can proceed in parallel with US3

### Story Completion Order

US1 → US2 → US3 → US4

## Parallel Execution Examples

- US1: T013, T014, T015 can run in parallel (distinct model files)
- US3: T025 can run in parallel with US4 model/view tasks (T029, T032)

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2
2. Complete US1 tasks (T009–T019)
3. Validate against `UC-15-AT.md` updates

### Incremental Delivery

1. Deliver US1 → validate
2. Add US2 → validate
3. Add US3 → validate
4. Add US4 → validate
