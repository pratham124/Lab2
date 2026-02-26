---

description: "Task list for Receive Final Conference Schedule"
---

# Tasks: Receive Final Conference Schedule

**Input**: Design documents from `/specs/001-receive-final-schedule/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Acceptance tests in `UC-18-AT.md` are REQUIRED for behavior changes. Update/confirm before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Confirm MVC directory structure exists per plan in `src/models/`, `src/controllers/`, `src/views/`, `src/services/`, `src/lib/` (cross-cutting)
- [X] T002 [P] Update UC-18 use case if needed to match spec changes in `UC-18.md` (cross-cutting)
- [X] T003 [P] Update acceptance tests for UC-18 in `UC-18-AT.md` (cross-cutting)
- [X] T004 [P] Review contracts for final schedule endpoints in `specs/001-receive-final-schedule/contracts/final-schedule.openapi.yaml` (cross-cutting)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [X] T005 Add or extend schedule-related models in `src/models/final_schedule.js`
- [X] T006 Add or extend presentation details model in `src/models/presentation_details.js`
- [X] T007 Add or extend notification model (including retry tracking) in `src/models/notification.js`
- [X] T008 Add authorization service stub for ownership checks in `src/services/authorization_service.js`
- [X] T009 Add audit log service stub (append-only logging) in `src/services/audit_log_service.js`
- [X] T010 Implement schedule publication state checks in `src/services/schedule_service.js`
- [X] T011 Implement notification enqueue/logging helper in `src/services/notification_service.js`
- [X] T012 Implement notification retry policy and attempt tracking in `src/services/notification_service.js`
- [X] T013 Implement shared error message builder (cause category + next step + optional report) in `src/lib/error_messages.js`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Final Schedule Details (Priority: P1) 🎯 MVP

**Goal**: Authors can view final presentation details for their accepted papers after publication.

**Independent Test**: Publish schedule, log in as an accepted author, and view details with required fields and correct timezone.

### Acceptance Tests for User Story 1 (REQUIRED)

- [X] T014 [US1] Update UC-18 acceptance tests for User Story 1 in `UC-18-AT.md`

### Implementation for User Story 1

- [X] T015 [P] [US1] Implement author submissions controller to fetch accepted papers in `src/controllers/author_submissions_controller.js`
- [X] T016 [P] [US1] Implement presentation detail fetch in `src/services/presentation_details_service.js`
- [X] T017 [US1] Enforce access control for paper ownership in `src/services/authorization_service.js`
- [X] T018 [US1] Enforce “published only” visibility in `src/services/schedule_service.js`
- [X] T019 [US1] Ensure access is independent of notification delivery status in `src/services/schedule_service.js`
- [X] T020 [US1] Ensure post-publication access regardless of login timing in `src/services/schedule_service.js`
- [X] T021 [US1] Render presentation details view with required fields + timezone in `src/views/author_presentation_details_view.js`
- [X] T022 [US1] Handle retrieval error UX using shared error messages in `src/controllers/author_presentation_details_controller.js`
- [X] T023 [US1] Log retrieval errors in `src/services/audit_log_service.js`

**Checkpoint**: User Story 1 is fully functional and testable independently

---

## Phase 4: User Story 2 - Receive Schedule Availability Notification (Priority: P2)

**Goal**: Authors with accepted papers are notified immediately when the final schedule is published.

**Independent Test**: Publish schedule and verify notifications are enqueued only for accepted-paper authors with publishedAt and count reported.

### Acceptance Tests for User Story 2 (REQUIRED)

- [X] T024 [US2] Update UC-18 acceptance tests for User Story 2 in `UC-18-AT.md`

### Implementation for User Story 2

- [X] T025 [US2] Implement publish action (state change to published) in `src/controllers/admin_schedule_controller.js`
- [X] T026 [US2] Enqueue notifications for accepted authors only in `src/services/notification_service.js`
- [X] T027 [US2] Define publish response shape then return `publishedAt` and `notificationsEnqueuedCount` in `src/controllers/admin_schedule_controller.js` (depends on T025, T026)
- [X] T028 [US2] Ensure in-app notification records created in `src/services/notification_service.js`
- [X] T029 [US2] Ensure email notification dispatch path invoked in `src/services/notification_service.js`
- [X] T030 [US2] Log notification failures in `src/services/audit_log_service.js`

**Checkpoint**: User Story 2 is independently functional and testable

---

## Phase 5: User Story 3 - View Details for Multiple Accepted Papers (Priority: P3)

**Goal**: Authors with multiple accepted papers can view correct details for each.

**Independent Test**: Assign two accepted papers, confirm each displays its own schedule details.

### Acceptance Tests for User Story 3 (REQUIRED)

- [X] T031 [US3] Update UC-18 acceptance tests for User Story 3 in `UC-18-AT.md`

### Implementation for User Story 3

- [X] T032 [US3] Extend submissions list to show multiple accepted papers in `src/views/author_submissions_view.js`
- [X] T033 [US3] Ensure per-paper details are retrieved and displayed correctly in `src/controllers/author_submissions_controller.js`
- [X] T034 [US3] Validate per-paper schedule mapping in `src/services/presentation_details_service.js`

**Checkpoint**: All user stories are independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T035 [P] Validate quickstart steps reflect implemented behavior in `specs/001-receive-final-schedule/quickstart.md` (cross-cutting)
- [X] T036 [P] Verify contracts remain consistent with behavior in `specs/001-receive-final-schedule/contracts/final-schedule.openapi.yaml` (cross-cutting)
- [X] T037 Review updated acceptance tests for completeness in `UC-18-AT.md` (cross-cutting)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent of US1
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Independent of US1/US2

### Parallel Opportunities

- T005–T007 can run in parallel (different model files)
- T015–T016 can run in parallel (controller/service)
- T025–T027 can run in parallel once publish action structure is in place
- T032–T034 can run in parallel across view/controller/service

---

## Parallel Example: User Story 1

```bash
Task: "Implement author submissions controller in src/controllers/author_submissions_controller.js"
Task: "Implement presentation detail fetch in src/services/presentation_details_service.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate User Story 1 independently (per spec + UC-18-AT)

### Incremental Delivery

1. Complete Setup + Foundational
2. Add User Story 1 → validate
3. Add User Story 2 → validate
4. Add User Story 3 → validate
5. Finish Polish phase
