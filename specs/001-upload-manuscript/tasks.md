---

description: "Task list for Upload Manuscript File"
---

# Tasks: Upload Manuscript File

**Input**: Design documents from `/root/493-lab/Lab2/specs/001-upload-manuscript/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Acceptance tests in `UC-05-AT.md` are REQUIRED for any behavior change or new functionality. Include tasks to add/update those files before implementation tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Update use case narrative for manuscript upload in `/root/493-lab/Lab2/UC-05.md`
- [ ] T002 Update acceptance tests for manuscript upload in `/root/493-lab/Lab2/UC-05-AT.md`
**Checkpoint**: UC-05.md and UC-05-AT.md updated before any implementation tasks
- [ ] T003 Create MVC folders and public assets structure in `/root/493-lab/Lab2/src/` and `/root/493-lab/Lab2/public/`
- [ ] T004 [P] Add placeholder README for upload module in `/root/493-lab/Lab2/src/README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [ ] T005 Define manuscript storage configuration (outside public web root) and retention posture (no TTL/auto-deletion) in `/root/493-lab/Lab2/src/services/storage_config.js`
- [ ] T006 [P] Add shared upload validation helper (format + size) in `/root/493-lab/Lab2/src/services/upload_validation.js`
- [ ] T007 [P] Add authorization helper with CMS roles (Program Chair, Track Chair, Admin) in `/root/493-lab/Lab2/src/services/authz.js`
- [ ] T008 Create skeleton controller in `/root/493-lab/Lab2/src/controllers/manuscript_controller.js`
- [ ] T009 Create skeleton storage service in `/root/493-lab/Lab2/src/services/manuscript_storage.js`
- [ ] T010 Create skeleton routes file in `/root/493-lab/Lab2/src/routes/manuscripts.js`
- [ ] T011 Add access-control enforcement for manuscript retrieval in `/root/493-lab/Lab2/src/controllers/manuscript_controller.js`
- [ ] T012 Ensure direct URL access to manuscripts is blocked in `/root/493-lab/Lab2/src/services/manuscript_storage.js`
- [ ] T013 Add error mapping for inline upload errors in `/root/493-lab/Lab2/src/services/upload_errors.js`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Upload a valid manuscript (Priority: P1) 🎯 MVP

**Goal**: Allow authenticated authors to upload a valid manuscript and attach it to their submission with confirmation.

**Independent Test**: Upload a valid PDF/Word/LaTeX `.zip` for an active submission and confirm the attached manuscript is shown.

### Acceptance Tests for User Story 1 (REQUIRED) ⚠️

- [ ] T014 [P] [US1] Align success scenarios and replacement behavior in `/root/493-lab/Lab2/UC-05-AT.md`

### Implementation for User Story 1

- [ ] T015 [P] [US1] Add ManuscriptFile model fields to `/root/493-lab/Lab2/src/models/manuscript_file.js`
- [ ] T016 [P] [US1] Add Submission linkage updates in `/root/493-lab/Lab2/src/models/submission.js`
- [ ] T017 [US1] Implement upload controller action in `/root/493-lab/Lab2/src/controllers/manuscript_controller.js`
- [ ] T018 [US1] Implement file storage service integration (non-public path) in `/root/493-lab/Lab2/src/services/manuscript_storage.js`
- [ ] T019 [US1] Implement upload route wiring in `/root/493-lab/Lab2/src/routes/manuscripts.js`
- [ ] T020 [US1] Add upload view and form in `/root/493-lab/Lab2/src/views/manuscripts/upload.html`
- [ ] T021 [US1] Add client-side helper for upload form feedback in `/root/493-lab/Lab2/public/js/manuscript_upload.js`
- [ ] T022 [US1] Add idempotency token / rapid double-submit guard to prevent duplicate attachments in `/root/493-lab/Lab2/public/js/manuscript_upload.js` and `/root/493-lab/Lab2/src/controllers/manuscript_controller.js`

**Checkpoint**: User Story 1 should be fully functional and independently testable

---

## Phase 4: User Story 2 - Correct invalid file selections (Priority: P2)

**Goal**: Prevent invalid/oversized uploads and present inline guidance for correction.

**Independent Test**: Attempt invalid format and oversized uploads and confirm inline error messages with accepted formats and size limits.

### Acceptance Tests for User Story 2 (REQUIRED) ⚠️

- [ ] T023 [P] [US2] Align invalid format/size expectations in `/root/493-lab/Lab2/UC-05-AT.md`

### Implementation for User Story 2

- [ ] T024 [US2] Enforce format + size validation in `/root/493-lab/Lab2/src/services/upload_validation.js`
- [ ] T025 [US2] Render inline error messages listing accepted formats and max size in `/root/493-lab/Lab2/src/views/manuscripts/upload.html`
- [ ] T026 [US2] Map validation errors to inline messages in `/root/493-lab/Lab2/src/controllers/manuscript_controller.js`

**Checkpoint**: User Story 2 should be independently testable with invalid inputs

---

## Phase 5: User Story 3 - Recover from upload failures (Priority: P3)

**Goal**: Provide safe failure handling and unlimited retries for interrupted uploads.

**Independent Test**: Simulate upload failure and confirm no partial attachment plus retry success.

### Acceptance Tests for User Story 3 (REQUIRED) ⚠️

- [ ] T027 [P] [US3] Align failure/retry expectations in `/root/493-lab/Lab2/UC-05-AT.md`

### Implementation for User Story 3

- [ ] T028 [US3] Add failure handling and cleanup in `/root/493-lab/Lab2/src/services/manuscript_storage.js`
- [ ] T029 [US3] Add retry flow messaging in `/root/493-lab/Lab2/src/controllers/manuscript_controller.js`
- [ ] T030 [US3] Add retry UI state in `/root/493-lab/Lab2/src/views/manuscripts/upload.html`

**Checkpoint**: User Story 3 should be independently testable with failure simulation

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T031 Update quickstart to verify no auto-deletion and access control in `/root/493-lab/Lab2/specs/001-upload-manuscript/quickstart.md`
- [ ] T032 Run manual validation steps in `/root/493-lab/Lab2/specs/001-upload-manuscript/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational; no dependency on other stories
- **User Story 2 (P2)**: Starts after Foundational; independent of US1
- **User Story 3 (P3)**: Starts after Foundational; independent of US1/US2

### Parallel Execution Examples

- **US1**: T015 and T016 can run in parallel; T017 depends on T015/T016
- **US2**: T024 can run in parallel with T025
- **US3**: T028 and T029 can run in parallel

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate User Story 1 independently

### Incremental Delivery

1. Setup + Foundational
2. User Story 1 → Validate
3. User Story 2 → Validate
4. User Story 3 → Validate
5. Polish & cross-cutting
