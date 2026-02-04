---

description: "Task list template for feature implementation"
---

# Tasks: Receive Payment Confirmation Ticket

**Input**: Design documents from `/specs/001-payment-confirmation-ticket/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Acceptance tests in `UC-22-AT.md` are REQUIRED for any behavior change or new functionality. Include tasks to add/update those files before implementation tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create feature implementation folders per plan in `backend/src/` and `frontend/src/`
- [ ] T002 [P] Create placeholder README for feature docs in `specs/001-payment-confirmation-ticket/README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Update UC-22 use case for clarified behaviors in `UC-22.md`
- [ ] T004 Establish base MVC wiring for ticket feature in `backend/src/controllers/` and `backend/src/views/`
- [ ] T005 [P] Add base model placeholders for ticket domain in `backend/src/models/`
- [ ] T006 [P] Add base service placeholders for ticket domain in `backend/src/services/`
- [ ] T007 [P] Add shared error response shape constants in `backend/src/controllers/error_responses.js`
- [ ] T008 [P] Add logging utility for ticket events in `backend/src/services/ticket_audit_log.js`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Access Confirmation Ticket After Payment (Priority: P1) 🎯 MVP

**Goal**: Generate and store a confirmation ticket after payment confirmation and allow the attendee to access it in their account.

**Independent Test**: Trigger a successful payment confirmation and verify ticket creation, storage, visibility, and required fields in the attendee account.

### Acceptance Tests for User Story 1 (REQUIRED) ⚠️

- [ ] T009 [P] [US1] Update acceptance tests for ticket creation/storage and required fields in `UC-22-AT.md`
- [ ] T010 [P] [US1] Verify UC-22-AT coverage for FR-001, FR-002, FR-003, FR-004 in `UC-22-AT.md`

### Implementation for User Story 1

- [ ] T011 [P] [US1] Define ConfirmationTicket model in `backend/src/models/confirmation_ticket.js`
- [ ] T012 [P] [US1] Define PaymentConfirmation model in `backend/src/models/payment_confirmation.js`
- [ ] T013 [P] [US1] Define AttendeeAccount model references for tickets in `backend/src/models/attendee_account.js`
- [ ] T014 [US1] Implement ticket creation service in `backend/src/services/confirmation_ticket_service.js`
- [ ] T015 [US1] Implement payment confirmation handler (idempotent) in `backend/src/controllers/payment_confirmations_controller.js`
- [ ] T016 [US1] Implement attendee ticket list view/controller in `backend/src/controllers/attendee_tickets_controller.js`
- [ ] T017 [US1] Add ticket list view template in `backend/src/views/attendee_tickets.html`
- [ ] T018 [US1] Add confirmation message display in `backend/src/views/payment_confirmation_result.html`
- [ ] T019 [US1] Enforce retention expiry on ticket access in `backend/src/services/confirmation_ticket_service.js`
- [ ] T020 [US1] Implement retention-ended messaging on ticket access in `backend/src/controllers/attendee_tickets_controller.js`

**Checkpoint**: User Story 1 fully functional and independently testable

---

## Phase 4: User Story 2 - Receive Ticket Delivery Notification (Priority: P2)

**Goal**: Deliver confirmation tickets via email only and log delivery attempts.

**Independent Test**: Trigger a successful payment confirmation and verify an email delivery attempt is recorded and sent to the attendee.

### Acceptance Tests for User Story 2 (REQUIRED) ⚠️

- [ ] T021 [P] [US2] Update acceptance tests for email-only delivery and delivery failure handling in `UC-22-AT.md`
- [ ] T022 [P] [US2] Verify UC-22-AT coverage for FR-005 and FR-006 in `UC-22-AT.md`

### Implementation for User Story 2

- [ ] T023 [P] [US2] Define DeliveryAttempt model in `backend/src/models/delivery_attempt.js`
- [ ] T024 [US2] Implement email delivery service in `backend/src/services/ticket_email_delivery_service.js`
- [ ] T025 [US2] Implement delivery attempt logging in `backend/src/services/delivery_attempt_service.js`
- [ ] T026 [US2] Enforce email-only delivery channel restriction in `backend/src/services/ticket_email_delivery_service.js`
- [ ] T027 [US2] Integrate delivery into ticket creation flow in `backend/src/services/confirmation_ticket_service.js`
- [ ] T028 [US2] Add delivery failure handling to keep ticket accessible in `backend/src/services/confirmation_ticket_service.js`

**Checkpoint**: User Story 2 fully functional and independently testable

---

## Phase 5: User Story 3 - Protect Ticket Access (Priority: P3)

**Goal**: Prevent attendees from accessing tickets that do not belong to them.

**Independent Test**: Attempt to access another attendee’s ticket and confirm access is denied without data leakage.

### Acceptance Tests for User Story 3 (REQUIRED) ⚠️

- [ ] T029 [P] [US3] Update acceptance tests for unauthorized ticket access in `UC-22-AT.md`
- [ ] T030 [P] [US3] Verify UC-22-AT coverage for FR-008 in `UC-22-AT.md`

### Implementation for User Story 3

- [ ] T031 [US3] Enforce ownership checks in `backend/src/controllers/attendee_tickets_controller.js`
- [ ] T032 [US3] Add access denied handling in `backend/src/views/access_denied.html`

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T033 [P] Update `specs/001-payment-confirmation-ticket/quickstart.md` with any implementation-specific notes
- [ ] T034 Add cross-cutting error response mapping for 500/404/410 in `backend/src/controllers/error_responses.js`
- [ ] T035 Add standardized error message content for ticket generation/storage failure in `backend/src/views/error_generic.html`
- [ ] T036 Add duplicate confirmation event logging in `backend/src/controllers/payment_confirmations_controller.js`
- [ ] T037 [P] Run quickstart validation steps in `specs/001-payment-confirmation-ticket/quickstart.md`

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
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Integrates with US1 ticket creation flow
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Depends on ticket retrieval endpoints

### Parallel Opportunities

- [P] tasks within Setup and Foundational phases can be split across team members
- [P] model and service tasks within a user story can be done in parallel
- [P] acceptance test updates can be parallel to model/service tasks once the scope is agreed

---

## Parallel Example: User Story 1

- Parallel Group A: T011, T012, T013 (models)
- Parallel Group B: T014 (service) after models
- Parallel Group C: T015, T016 (controllers) after service
- Parallel Group D: T017, T018 (views) after controllers
