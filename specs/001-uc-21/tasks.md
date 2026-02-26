---

description: "Task list for Pay Conference Registration Fee Online"
---

# Tasks: Pay Conference Registration Fee Online

**Input**: Design documents from `/specs/001-uc-21/`
**Prerequisites**: `plan.md`, `spec.md`, `data-model.md`, `contracts/payment-api.yaml`

**Tests**: Acceptance tests in `UC-21-AT.md` are REQUIRED for any behavior change or new functionality. Include tasks to update them before implementation tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create MVC directories per plan in `src/models/`, `src/controllers/`, `src/views/`, `src/services/`
- [X] T002 [P] Add base routing/controller entry in `src/controllers/index.js`
- [X] T003 [P] Add base view layout/shell for attendee pages in `src/views/layout.html`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [X] T004 [P] Define status code enums and labels in `src/models/status_codes.js` (registration + payment status)
- [X] T005 [P] Define payment record shape in `src/models/payment_transaction.js` (no PAN/CVV fields)
- [X] T006 [P] Define registration model accessors in `src/models/registration.js`
- [X] T007 Implement datastore access layer with atomic/ordered write helpers in `src/services/datastore_service.js`
- [X] T008 [P] Implement auth guard for payment routes in `src/controllers/auth_guard.js`
- [X] T009 [P] Implement error/message helper for plain-language responses in `src/services/message_service.js`
- [X] T010 Implement audit logging hook for payment events in `src/services/audit_service.js`
- [X] T011 [P] Implement log redaction rules for payment-related logs in `src/services/logging_service.js`
- [X] T012 [P] Enforce gateway reference uniqueness in `src/services/datastore_service.js`
- [X] T013 Document eventual consistency expectations in `specs/001-uc-21/quickstart.md`
- [X] T013a Define authoritative clock source + timezone for the “>24 hours pending” rule in `specs/001-uc-21/quickstart.md`
- [X] T033 [P] Align OpenAPI responses with controllers in `specs/001-uc-21/contracts/payment-api.yaml`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Pay Registration Fee Online (Priority: P1) 🎯 MVP

**Goal**: Allow a logged-in attendee to initiate and complete card payment with confirmation and status update.

**Independent Test**: Complete a payment and observe `pending_confirmation` during delay, then `paid_confirmed` with a confirmation message and payment record.

### Acceptance Tests for User Story 1 (REQUIRED) ⚠️

- [X] T014 [P] [US1] Review/update acceptance tests in `UC-21-AT.md` for initiation → pending → confirm → paid_confirmed
- [X] T015 [P] [US1] Verify acceptance criteria for US1 against implementation

Dependency note: T014 depends on T013 + T013a.

### Implementation for User Story 1

- [X] T016 [P] [US1] Implement payment initiation service in `src/services/payment_service.js` (create transaction, set `pending_confirmation`)
- [X] T017 [US1] Implement payment initiation endpoint in `src/controllers/payment_controller.js` for `POST /registrations/{id}/payment/initiate`
- [X] T018 [P] [US1] Add payment initiation view with fee + card option in `src/views/payment_initiate.html`
- [X] T019 [US1] Implement confirmation handler in `src/controllers/payment_controller.js` for `POST /payments/confirm` with idempotent outcome
- [X] T020 [US1] Persist successful payment record and update registration status in `src/services/payment_service.js`
- [X] T021 [US1] Add confirmation/pending UI messages in `src/views/payment_status.html`

Dependency note: T017 and T019 depend on T002 + T008 + T004. T019 and T020 depend on T007 + T012. T030 depends on T013a.

**Checkpoint**: User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - View Payment Status and Record (Priority: P2)

**Goal**: Allow an attendee to view payment status and payment record details.

**Independent Test**: After payment, status page shows `paid_confirmed` and payment record summary (amount, date/time, reference).

### Acceptance Tests for User Story 2 (REQUIRED) ⚠️

- [X] T022 [P] [US2] Review/update acceptance tests in `UC-21-AT.md` for status and payment record visibility
- [X] T023 [P] [US2] Verify acceptance criteria for US2 against implementation

Dependency note: T022 depends on T013 + T013a.

### Implementation for User Story 2

- [X] T024 [US2] Implement status endpoint in `src/controllers/payment_controller.js` for `GET /registrations/{id}/payment-status`
- [X] T025 [US2] Implement records endpoint in `src/controllers/payment_controller.js` for `GET /registrations/{id}/payment-records`
- [X] T026 [P] [US2] Render status and record summary in `src/views/payment_status.html`

Dependency note: T024 and T025 depend on T002 + T008 + T004.

**Checkpoint**: User Story 2 should be functional and testable independently

---

## Phase 5: User Story 3 - Handle Failed or Unavailable Payments (Priority: P3)

**Goal**: Provide clear user messaging for invalid/declined/unavailable payments without changing paid state.

**Independent Test**: Trigger invalid/declined/unavailable flows and confirm `unpaid` status with clear message and retry guidance.

### Acceptance Tests for User Story 3 (REQUIRED) ⚠️

- [X] T027 [P] [US3] Review/update acceptance tests in `UC-21-AT.md` for invalid/declined/unavailable/pending-timeout handling
- [X] T028 [P] [US3] Verify acceptance criteria for US3 against implementation

Dependency note: T027 depends on T013 + T013a.

### Implementation for User Story 3

- [X] T029 [US3] Map gateway errors to user-safe messages in `src/services/message_service.js` (invalid_details, declined, service_unavailable, pending_timeout)
- [X] T030 [US3] Implement pending timeout evaluation in `src/services/payment_service.js`
- [X] T031 [US3] Ensure initiation endpoint returns already-paid conflict with status + record in `src/controllers/payment_controller.js`
- [X] T032 [P] [US3] Add error/pending messaging in `src/views/payment_status.html`

Dependency note: T031 depends on T002 + T008 + T004.

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T034 [P] Update quickstart validation steps in `specs/001-uc-21/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: Depend on Foundational phase completion
- **Polish (Final Phase)**: Depends on desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational - no dependencies on other stories
- **User Story 2 (P2)**: Starts after Foundational - depends on US1 data (payment record exists)
- **User Story 3 (P3)**: Starts after Foundational - integrates with US1 endpoints

### Parallel Opportunities

- Phase 1: T002, T003 can run in parallel
- Phase 2: T004, T005, T006, T008, T009, T011, T012, T033 can run in parallel
- US1: T016, T018 can run in parallel after foundation
- US2: T024, T025, T026 can run in parallel after foundation
- US3: T029, T030, T032 can run in parallel after foundation

---

## Parallel Example: User Story 1

```bash
# Update acceptance tests for User Story 1 first:
Task: "Review/update acceptance tests in UC-21-AT.md"

# Parallel implementation tasks:
Task: "Implement payment initiation service in src/services/payment_service.js"
Task: "Add payment initiation view and messaging in src/views/payment_initiate.html"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify acceptance criteria are defined before implementing
