---

description: "Task list for View Conference Registration Prices"
---

# Tasks: View Conference Registration Prices

**Input**: Design documents from `/specs/001-view-registration-prices/`
**Prerequisites**: /root/493-lab/Lab2/specs/001-view-registration-prices/plan.md, /root/493-lab/Lab2/specs/001-view-registration-prices/spec.md
**Supporting Docs**: /root/493-lab/Lab2/specs/001-view-registration-prices/data-model.md, /root/493-lab/Lab2/specs/001-view-registration-prices/contracts/registration-prices.yaml, /root/493-lab/Lab2/specs/001-view-registration-prices/research.md, /root/493-lab/Lab2/specs/001-view-registration-prices/quickstart.md

**Tests**: Acceptance tests in /root/493-lab/Lab2/UC-20-AT.md are required for behavior changes. No additional automated tests requested.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create MVC directories in /root/493-lab/Lab2/src/models, /root/493-lab/Lab2/src/controllers, /root/493-lab/Lab2/src/views, /root/493-lab/Lab2/src/services
- [X] T002 Create public assets directory at /root/493-lab/Lab2/public/assets
- [X] T003 [P] Add baseline registration prices view shell at /root/493-lab/Lab2/src/views/registration-prices.html
- [X] T004 [P] Add base styles file at /root/493-lab/Lab2/public/assets/registration-prices.css

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [X] T005 Define pricing data model mapping in /root/493-lab/Lab2/src/models/registration-price.js
- [X] T006 Implement pricing data access service (read-only) in /root/493-lab/Lab2/src/services/pricing-service.js
- [X] T007 Implement controller scaffold and view wiring in /root/493-lab/Lab2/src/controllers/registration-prices-controller.js
- [X] T008 Add view initialization script in /root/493-lab/Lab2/src/views/registration-prices.js
- [X] T009 Update /root/493-lab/Lab2/UC-20.md to reflect current requirements before implementation
- [X] T010 Update /root/493-lab/Lab2/UC-20-AT.md to reflect current acceptance criteria before implementation

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - View Current Registration Prices (Priority: P1) 🎯 MVP

**Goal**: Display current active registration prices to attendees without login.

**Independent Test**: Open the registration prices view and confirm active categories with amounts are visible and labeled.

### Acceptance Tests for User Story 1 (REQUIRED)

- [X] T011 [P] [US1] Review and update /root/493-lab/Lab2/UC-20-AT.md as needed for P1 alignment

### Implementation for User Story 1

- [X] T012 [P] [US1] Implement pricing list rendering in /root/493-lab/Lab2/src/views/registration-prices.js
- [X] T013 [US1] Wire controller to fetch and render prices in /root/493-lab/Lab2/src/controllers/registration-prices-controller.js
- [X] T014 [US1] Ensure displayed prices match stored values in /root/493-lab/Lab2/src/controllers/registration-prices-controller.js and /root/493-lab/Lab2/src/views/registration-prices.js
- [X] T015 [P] [US1] Ensure public access (no auth gating) in /root/493-lab/Lab2/src/controllers/registration-prices-controller.js
- [X] T016 [P] [US1] Apply layout and labels in /root/493-lab/Lab2/src/views/registration-prices.html
- [X] T017 [P] [US1] Add styling for price list in /root/493-lab/Lab2/public/assets/registration-prices.css

**Checkpoint**: User Story 1 is functional and independently testable

---

## Phase 4: User Story 2 - Handle Missing Pricing Information (Priority: P2)

**Goal**: Show empty-state messaging when no active priced categories exist.

**Independent Test**: Remove/disable all active priced categories and confirm the empty-state message appears.

### Acceptance Tests for User Story 2 (REQUIRED)

- [X] T018 [P] [US2] Review and update /root/493-lab/Lab2/UC-20-AT.md as needed for empty-state alignment

### Implementation for User Story 2

- [X] T019 [US2] Implement unavailable state handling for none defined/all inactive/all amounts missing in /root/493-lab/Lab2/src/controllers/registration-prices-controller.js
- [X] T020 [P] [US2] Render “Pricing is not available.” empty-state text in /root/493-lab/Lab2/src/views/registration-prices.html
- [X] T021 [P] [US2] Apply missing-amount handling in /root/493-lab/Lab2/src/controllers/registration-prices-controller.js
- [X] T022 [P] [US2] Filter inactive categories in /root/493-lab/Lab2/src/controllers/registration-prices-controller.js

**Checkpoint**: User Story 2 is functional and independently testable

---

## Phase 5: User Story 3 - Handle Retrieval Failures Safely (Priority: P3)

**Goal**: Show a friendly error message on retrieval/service failures without exposing technical details.

**Independent Test**: Simulate a retrieval failure and confirm a friendly error message is shown.

### Acceptance Tests for User Story 3 (REQUIRED)

- [X] T023 [P] [US3] Review and update /root/493-lab/Lab2/UC-20-AT.md as needed for retrieval error alignment

### Implementation for User Story 3

- [X] T024 [US3] Implement retrieval failure handling in /root/493-lab/Lab2/src/controllers/registration-prices-controller.js
- [X] T025 [P] [US3] Render friendly error message state in /root/493-lab/Lab2/src/views/registration-prices.html

**Checkpoint**: User Story 3 is functional and independently testable

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T026 [P] Validate MVC separation across /root/493-lab/Lab2/src/models, /root/493-lab/Lab2/src/controllers, /root/493-lab/Lab2/src/views
- [X] T027 [P] Confirm messages are English-only and exact strings match spec in /root/493-lab/Lab2/src/views/registration-prices.html and /root/493-lab/Lab2/src/views/registration-prices.js
- [X] T028 [P] Validate timing against SC-001/SC-002 using /root/493-lab/Lab2/specs/001-view-registration-prices/quickstart.md
- [X] T029 [P] Run quickstart validation steps in /root/493-lab/Lab2/specs/001-view-registration-prices/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup
- **User Stories (Phase 3–5)**: Depend on Foundational
- **Polish (Phase 6)**: Depends on desired user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies beyond Foundational
- **User Story 2 (P2)**: No dependencies beyond Foundational
- **User Story 3 (P3)**: No dependencies beyond Foundational

### Parallel Opportunities

- Setup tasks T003–T004 can run in parallel
- User story implementation tasks marked [P] can run in parallel within a story
- Different user stories can run in parallel after Foundational completion

---

## Parallel Example: User Story 1

```text
T012 [P] [US1] Implement pricing list rendering in /root/493-lab/Lab2/src/views/registration-prices.js
T016 [P] [US1] Apply layout and labels in /root/493-lab/Lab2/src/views/registration-prices.html
T017 [P] [US1] Add styling for price list in /root/493-lab/Lab2/public/assets/registration-prices.css
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup + Foundational
2. Implement User Story 1
3. Validate independently against UC-20-AT P1 expectations

### Incremental Delivery

1. US1 → validate
2. US2 → validate
3. US3 → validate

### Parallel Team Strategy

- After Foundational, one developer per story (US1/US2/US3) can proceed in parallel
