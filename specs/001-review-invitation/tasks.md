---

description: "Task list template for feature implementation"
---

# Tasks: Receive Review Invitation

**Input**: Design documents from `/specs/001-review-invitation/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Acceptance tests in `UC-11-AT.md` are REQUIRED for any behavior change
or new functionality. Include tasks to add/update those files before
implementation tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- Paths shown below assume single project - adjust based on plan.md structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create MVC folders and base module stubs in src/models/index.js, src/services/index.js, src/controllers/router.js
- [X] T002 Review UC-11.md for alignment with scope, ordering, pagination, and keyboard accessibility requirements (no edits yet)
- [X] T003 Create base layout and shared styles in src/views/layout.html and src/views/styles/base.css
- [X] T004 [P] Add shared DOM helpers in src/views/scripts/dom.js

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Implement authentication gate in src/controllers/auth_controller.js and wire into src/controllers/router.js
- [X] T006 [P] Implement API client wrapper in src/services/api_client.js for GET /api/review-invitations and POST/PATCH for accept/reject actions
- [X] T007 [P] Implement pagination helpers in src/services/pagination.js
- [X] T008 Implement invitation creation on editor assignment in src/services/invitation_creation_service.js and src/controllers/editor_assignments_controller.js
- [X] T009 Implement invitation status updater (auto-decline on response_due_at) in src/services/invitation_status_service.js
- [X] T010 [P] Implement generic error banner component in src/views/components/error-banner.html and styles in src/views/styles/base.css

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Pending Review Invitation (Priority: P1) 🎯 MVP

**Goal**: Show pending invitations with title, status, ordering, pagination, and Accept/Reject options.

**Independent Test**: Assign a reviewer to multiple papers and confirm the list shows only pending invitations by default, newest first, with pagination and action buttons.

### Acceptance Tests for User Story 1 (REQUIRED) ⚠️

- [X] T011 [P] [US1] Update acceptance tests in UC-11-AT.md for list fields, ordering, pagination, default pending filter, keyboard access, and accept/reject state changes
- [X] T037 [P] [US1] Update UC-11.md to reflect acceptance test changes and final UC-11 scope

### Implementation for User Story 1

- [X] T012 [P] [US1] Update OpenAPI contract in specs/001-review-invitation/contracts/review-invitations.openapi.yaml to add accept/reject action endpoint
- [X] T013 [P] [US1] Create ReviewInvitation model in src/models/review_invitation.js
- [X] T014 [P] [US1] Create Paper model in src/models/paper.js
- [X] T015 [US1] Implement review invitation list service in src/services/review_invitation_service.js (default pending, newest-first sort, pagination, status refresh; depends on T009)
- [X] T016 [US1] Implement invitations list controller in src/controllers/review_invitations_controller.js (auth guard, fetch, empty-state handling; depends on T005)
- [X] T017 [US1] Implement accept/reject action service in src/services/review_invitation_action_service.js (update status)
- [X] T018 [US1] Add accept/reject handlers in src/controllers/review_invitations_controller.js (invoke action service)
- [X] T019 [US1] Build invitations list view in src/views/review-invitations.html (title-only display, status, Accept/Reject buttons, filters, pagination controls)
- [X] T020 [US1] Add list rendering and interaction logic in src/views/scripts/review-invitations.js (fetch, render, filter, pagination, retry, accept/reject actions, auto-refresh for 1-minute visibility)
- [X] T021 [US1] Add page-specific styles and focus states in src/views/styles/review-invitations.css
- [X] T022 [US1] Wire invitations route and view entry in src/controllers/router.js and src/views/index.html

**Checkpoint**: User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Receive Invitation Notification (Priority: P2)

**Goal**: Send a notification when an invitation is created, with clear content.

**Independent Test**: Create an invitation and verify a notification record is created and delivered (or failed) with the correct content.

### Acceptance Tests for User Story 2 (REQUIRED) ⚠️

- [X] T023 [P] [US2] Update acceptance tests in UC-11-AT.md for notification delivery and required content

### Implementation for User Story 2

- [X] T024 [P] [US2] Create Notification model in src/models/notification.js
- [X] T025 [US2] Implement notification service in src/services/notification_service.js (send + record delivery status)
- [X] T026 [US2] Add invitation creation hook to trigger notification in src/services/invitation_creation_service.js (non-blocking)
- [X] T027 [US2] Create notification template content in src/views/templates/review-invitation-notification.txt
- [X] T028 [US2] Include paper title and response due date in notification payload in src/services/notification_service.js

**Checkpoint**: User Story 2 should be fully functional and testable independently

---

## Phase 5: User Story 3 - Secure and Resilient Access (Priority: P3)

**Goal**: Ensure only invited reviewers can view invitations and errors are safe and retryable.

**Independent Test**: Attempt access as a different reviewer, simulate notification failure, and simulate invitation retrieval errors to confirm correct behavior.

### Acceptance Tests for User Story 3 (REQUIRED) ⚠️

- [X] T029 [P] [US3] Update acceptance tests in UC-11-AT.md for authorization, notification failure resilience, and generic retry messaging

### Implementation for User Story 3

- [X] T030 [US3] Enforce reviewer authorization in src/services/authorization_service.js (invited reviewer only)
- [X] T031 [US3] Handle 401/403/500 responses with generic retry messaging in src/controllers/review_invitations_controller.js and src/views/components/error-banner.html
- [X] T032 [US3] Ensure invitation retrieval proceeds when notification fails in src/services/invitation_creation_service.js (do not block on failure)
- [X] T033 [US3] Add audit logging for unauthorized access attempts in src/services/security_log_service.js

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T034 [P] Add loading/empty state copy in src/views/review-invitations.html and styles in src/views/review-invitations.css
- [X] T035 [P] Add performance timing log and warning in src/views/scripts/review-invitations.js for 2-second load target
- [X] T036 [P] Validate and update quickstart steps in specs/001-review-invitation/quickstart.md for performance, 1-minute visibility, and keyboard checks

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent of US1 but uses shared foundation
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Independent of US1/US2 but uses shared foundation

### Within Each User Story

- Acceptance tests in `UC-11-AT.md` before implementation
- Models before services
- Services before controllers/views
- Core implementation before integration

### Parallel Opportunities

- Phase 1 tasks marked [P]
- Phase 2 tasks marked [P]
- Acceptance test updates per user story
- Model creation within a user story
- Different user stories can run in parallel after Phase 2

---

## Parallel Example: User Story 1

```bash
# Update acceptance tests for User Story 1 first:
Task: "Update acceptance tests in UC-11-AT.md for list fields, ordering, pagination, default pending filter, and action buttons"

# Launch models for User Story 1 together:
Task: "Create ReviewInvitation model in src/models/review_invitation.js"
Task: "Create Paper model in src/models/paper.js"
```

---

## Parallel Example: User Story 2

```bash
# Update acceptance tests for User Story 2 first:
Task: "Update acceptance tests in UC-11-AT.md for notification delivery and content"

# Run model and template work together:
Task: "Create Notification model in src/models/notification.js"
Task: "Create notification template content in src/views/templates/review-invitation-notification.txt"
```

---

## Parallel Example: User Story 3

```bash
# Update acceptance tests for User Story 3 first:
Task: "Update acceptance tests in UC-11-AT.md for authorization, notification failure resilience, and generic retry messaging"

# Parallelize auth + logging:
Task: "Enforce reviewer authorization in src/services/authorization_service.js"
Task: "Add audit logging for unauthorized access attempts in src/services/security_log_service.js"
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
- Avoid vague tasks and cross-story dependencies
